/**
 * Orkestrate OpenCode Plugin
 *
 * OUT → sends structured events to /api/telemetry/ingest
 * IN  ← polls /api/agent-control/pull, injects prompts into TUI
 */
import type { Plugin } from "@opencode-ai/plugin";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHmac } from "crypto";

// ── Config ──────────────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  try {
    const raw = readFileSync(join(homedir(), ".config", "opencode", ".Orkestrate.env"), "utf-8");
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq > 0) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return out;
  } catch { return {}; }
}

const env = loadEnv();
const AGENT_ID = env.Orkestrate_AGENT_ID || process.env.Orkestrate_AGENT_ID || "";
const SECRET = env.Orkestrate_SECRET || process.env.Orkestrate_SECRET || "";
const HOST = env.Orkestrate_HOST || process.env.Orkestrate_HOST || "orkestrate.vercel.app";
const BASE = /^https?:\/\//i.test(HOST) ? HOST
  : HOST.includes("localhost") || HOST.includes("127.0.0.1") ? `http://${HOST}`
    : `https://${HOST}`;
const INGEST = `${BASE}/api/telemetry/ingest`;
const PULL = `${BASE}/api/agent-control/pull`;
const PULL_WAIT_MS = 25000;

// ── Send helper ─────────────────────────────────────────────────────────────────

const MAX_QUEUE_SIZE = 2000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 150;
const REQUEST_TIMEOUT_MS = 8000;

type TelemetryEnvelope = {
  kind: string;
  agentId: string;
  at: string;
  source: string;
  seq: number;
  payload: Record<string, unknown>;
};

type QueuedRequest = {
  kind: string;
  body: string;
  headers: Record<string, string>;
};

const sendQueue: QueuedRequest[] = [];
let inFlight = 0;
let seq = 0;
let droppedEvents = 0;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function post(body: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(INGEST, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

async function postWithRetry(req: QueuedRequest) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await post(req.body, req.headers);
      return;
    } catch {
      if (attempt === MAX_RETRIES) {
        console.warn(`[Orkestrate] Failed to deliver telemetry event '${req.kind}'`);
        return;
      }
      await delay(RETRY_BASE_MS * (2 ** attempt));
    }
  }
}

function pumpQueue() {
  if (inFlight > 0 || sendQueue.length === 0) return;

  const next = sendQueue.shift();
  if (!next) return;

  inFlight += 1;
  void postWithRetry(next).finally(() => {
    inFlight -= 1;
    if (sendQueue.length === 0 && droppedEvents > 0) {
      console.warn(`[Orkestrate] Dropped ${droppedEvents} telemetry events due to local queue pressure.`);
      droppedEvents = 0;
    }
    pumpQueue();
  });
}

async function flushSendQueue(timeoutMs = 1500) {
  const until = Date.now() + timeoutMs;
  while ((sendQueue.length > 0 || inFlight > 0) && Date.now() < until) {
    await delay(20);
  }
}

async function send(kind: string, payload: Record<string, unknown>) {
  if (!AGENT_ID) return;
  const ts = new Date().toISOString();
  const envelope: TelemetryEnvelope = {
    kind,
    agentId: AGENT_ID,
    at: ts,
    source: "opencode-plugin",
    seq: ++seq,
    payload,
  };
  const body = JSON.stringify(envelope);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SECRET) {
    headers["x-orkestrate-ts"] = ts;
    headers["x-orkestrate-signature"] = createHmac("sha256", SECRET).update(body).digest("hex");
  }

  if (sendQueue.length >= MAX_QUEUE_SIZE) {
    sendQueue.shift();
    droppedEvents += 1;
  }
  sendQueue.push({ kind, body, headers });
  pumpQueue();
}

// ── Extract text from parts ─────────────────────────────────────────────────────

function partsToText(parts: any[]): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
    .map((p: any) => p.text)
    .join("\n")
    .trim();
}

// ── Plugin ──────────────────────────────────────────────────────────────────────

export const OrkestrateTelemetry: Plugin = async ({ client, directory }) => {
  if (!AGENT_ID) {
    console.log("[Orkestrate] No Orkestrate_AGENT_ID set");
    return {};
  }

  await send("connect", { directory });

  // ── Command polling (dashboard → TUI) ──
  let activeSessionId: string | null = null;
  let pullAgentId = AGENT_ID;
  let stopPullLoop = false;
  let currentPullAbort: AbortController | null = null;

  const pullLoop = async () => {
    while (!stopPullLoop) {
      try {
        const ac = new AbortController();
        currentPullAbort = ac;
        const url = `${PULL}?agentId=${encodeURIComponent(pullAgentId)}&waitMs=${PULL_WAIT_MS}`;
        const res = await fetch(url, { signal: ac.signal });
        currentPullAbort = null;

        if (!res.ok) {
          await delay(1000);
          continue;
        }

        const data = await (res.json() as Promise<any>);
        if (typeof data?.agentId === "string" && data.agentId.trim()) {
          pullAgentId = data.agentId.trim();
        }

        const commands = Array.isArray(data?.commands) ? data.commands : [];
        for (const cmd of commands) {
          const text = cmd?.text?.trim();
          if (!text) continue;
          try {
            if (activeSessionId && typeof (client as any).session?.prompt === "function") {
              await (client as any).session.prompt({
                path: { id: activeSessionId },
                body: { parts: [{ type: "text", text }] },
              });
            } else if (typeof (client as any).tui?.appendPrompt === "function") {
              await (client as any).tui.appendPrompt({ body: { text } });
              await (client as any).tui.submitPrompt();
            }
            await send("command_ok", { commandId: cmd.id, text });
          } catch (e: any) {
            await send("command_err", { commandId: cmd.id, error: e?.message });
          }
        }
      } catch {
        currentPullAbort = null;
        if (!stopPullLoop) await delay(1000);
      }
    }
  };
  void pullLoop();

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    stopPullLoop = true;
    if (currentPullAbort) {
      try { currentPullAbort.abort(); } catch { }
      currentPullAbort = null;
    }
    await send("disconnect", {});
    await flushSendQueue(1500);
  };
  process.on("beforeExit", () => { void cleanup(); });
  process.once("SIGTERM", () => { void cleanup().finally(() => process.exit(0)); });
  process.once("SIGINT", () => { void cleanup().finally(() => process.exit(0)); });

  // ── Hooks ─────────────────────────────────────────────────────────────────────

  return {
    // User message — the key hook we were missing
    "chat.message": async (input, output) => {
      activeSessionId = input.sessionID;
      const text = partsToText(output.parts);
      await send("user_message", { text, input, output });
    },

    // All events — assistant streaming, session lifecycle, etc.
    event: async ({ event }) => {
      const e = event as any;

      // Track session ID
      const sid = e?.properties?.info?.sessionID || e?.properties?.sessionID;
      if (typeof sid === "string" && sid.startsWith("ses_")) activeSessionId = sid;

      await send("event", { e });
    },

    // Tool execution
    "tool.execute.before": async (input, output) => {
      activeSessionId = input.sessionID;
      await send("tool_start", { input, output });
    },

    "tool.execute.after": async (input, output) => {
      activeSessionId = input.sessionID;
      await send("tool_end", { input, output });
    },

    // Permission requests
    "permission.ask": async (input, output) => {
      await send("permission", { input, output });
    },
  };
};
