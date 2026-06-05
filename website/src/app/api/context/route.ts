import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPENCODE_URL = process.env.ORKY_OPENCODE_URL ?? "http://127.0.0.1:4106";
const DEFAULT_WORKSPACE_DIR =
  process.platform === "win32" ? "C:\\tmp\\orky-runs\\orky-growth" : "/tmp/orky-runs/orky-growth";
const LOCAL_CONTEXT_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.ORKY_ENABLE_LOCAL_CONTEXT === "1";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type ContextPayload = {
  active: boolean;
  sessionId: string | null;
  state?: Record<string, unknown> | null;
  messages: Message[];
  goal: string | null;
  files: Record<string, string> | null;
  totals?: { tokens: number; cost: number } | null;
};

async function readTextFile(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

async function joinPath(...segments: string[]): Promise<string> {
  const { join } = await import("node:path");
  return join(...segments);
}

function getWorkspaceDir(state?: Record<string, unknown> | null): string {
  return (process.env.ORKY_WORKSPACE_DIR || (state?.workspaceDir as string) || DEFAULT_WORKSPACE_DIR);
}

function getDirParam(state?: Record<string, unknown> | null): string {
  const dir = getWorkspaceDir(state);
  return `?directory=${encodeURIComponent(dir.replace(/\\/g, "/"))}`;
}

async function readGoalFile(state?: Record<string, unknown> | null): Promise<string | null> {
  const dir = getWorkspaceDir(state);
  try {
    return await readTextFile(await joinPath(dir, "GOAL.md"));
  } catch {
    return null;
  }
}

async function readWorkspaceFiles(state?: Record<string, unknown> | null): Promise<Record<string, string> | null> {
  const dir = getWorkspaceDir(state);
  const files: Record<string, string> = {};
  for (const name of [
    "TARGETS.md",
    "OUTREACH.md",
    "INVESTORS.md",
    "POSTS.md",
    "CONTACTS.md",
    "MAIL_REVIEW.md",
    "ORKY_REVIEW.md",
    "SENT.md",
    "REJECTED.md",
    "DIGEST.md",
    "NOTES.md",
    "ORKY.md",
    "ORKY_CHECKS.jsonl",
    "ORKY_SENDS.jsonl",
  ]) {
    const fp = await joinPath(dir, name);
    try {
      files[name] = await readTextFile(fp);
    } catch {
      /* not present */
    }
  }
  return Object.keys(files).length > 0 ? files : null;
}

async function readStateFile(): Promise<Record<string, unknown> | null> {
  const statePath =
    process.env.ORKY_RUN_STATE_PATH ??
    (await joinPath(process.cwd(), "..", "agent-runner", "state", "run.json"));
  try {
    return JSON.parse(await readTextFile(statePath));
  } catch {
    return null;
  }
}

async function readActivityMessages(): Promise<Message[]> {
  const logPath =
    process.env.ORKY_ACTIVITY_LOG_PATH ??
    (await joinPath(process.cwd(), "..", "agent-runner", "logs", "activity.jsonl"));
  try {
    const raw = await readTextFile(logPath);
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { msg?: Message })
      .map((entry) => entry.msg)
      .filter((message): message is Message => Boolean(message?.info && message.parts))
      .slice(-80);
  } catch {
    return [];
  }
}

async function readSupabaseContext(): Promise<ContextPayload | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("orky_public_context")
      .select("status, session_id, payload, last_event_at")
      .eq("id", "public")
      .maybeSingle();

    if (error || !data) return null;

    const stale =
      data.status === "live" && data.last_event_at
        ? Date.now() - new Date(data.last_event_at).getTime() > 5 * 60 * 1000
        : false;

    const payload = data.payload as Partial<ContextPayload>;
    return {
      active: stale ? false : data.status === "live",
      sessionId: data.session_id ?? payload.sessionId ?? null,
      state: payload.state ?? null,
      messages: Array.isArray(payload.messages) ? payload.messages : [],
      goal: typeof payload.goal === "string" ? payload.goal : null,
      files: payload.files && typeof payload.files === "object"
        ? (payload.files as Record<string, string>)
        : null,
      totals: payload.totals ?? null,
    };
  } catch {
    return null;
  }
}

interface Part {
  type: string;
  text?: string;
  tool?: string;
  state?: Record<string, unknown>;
  filename?: string;
  prompt?: string;
  reason?: string;
  cost?: number;
  attempt?: string;
  error?: string;
  ignored?: boolean;
}

interface MessageInfo {
  role: "user" | "assistant";
  time: { created: number };
  tokens?: { input: number; output: number };
  cost?: number;
  step?: number;
}

interface Message {
  info: MessageInfo;
  parts: Part[];
}

function computeTotals(messages: Message[]) {
  const tokens = messages.reduce((sum, msg) => {
    const usage = msg.info?.tokens;
    return sum + (usage?.input ?? 0) + (usage?.output ?? 0);
  }, 0);
  const cost = messages.reduce((sum, msg) => sum + (msg.info?.cost ?? 0), 0);
  return { tokens, cost };
}

function isStale(messages: Message[]): boolean {
  const latest = messages.reduce(
    (latest, msg) => Math.max(latest, msg.info?.time?.created ?? 0),
    0,
  );
  return latest === 0 || Date.now() - latest > 5 * 60 * 1000;
}

export async function GET() {
  if (!LOCAL_CONTEXT_ENABLED) {
    const supabaseContext = await readSupabaseContext();
    return NextResponse.json(
      supabaseContext ?? {
        active: false,
        sessionId: null,
        messages: [],
        goal: null,
        files: null,
        totals: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const state = await readStateFile();
  const sessionId = state?.sessionID as string | undefined;

  if (!sessionId) {
    const [goal, files, messages] = await Promise.all([
      readGoalFile(state),
      readWorkspaceFiles(state),
      readActivityMessages(),
    ]);
    return NextResponse.json(
      {
        active: false,
        sessionId: null,
        messages,
        goal,
        files,
        totals: computeTotals(messages),
      },
      NO_STORE,
    );
  }

  const dirParam = getDirParam(state);

  try {
    const [messagesRes, goal, files] = await Promise.all([
      fetch(`${OPENCODE_URL}/session/${sessionId}/message${dirParam}`, {
        signal: AbortSignal.timeout(5000),
      }),
      readGoalFile(state),
      readWorkspaceFiles(state),
    ]);

    if (!messagesRes.ok) {
      const messages = await readActivityMessages();
      return NextResponse.json(
        {
          active: false,
          sessionId,
          state,
          messages,
          goal,
          files,
          totals: computeTotals(messages),
        },
        NO_STORE,
      );
    }

    const body = await messagesRes.json();
    const messages: Message[] = Array.isArray(body) ? body : (body.items ?? body.messages ?? []);

    const active = !isStale(messages);
    return NextResponse.json({ active, sessionId, state, messages, goal, files, totals: computeTotals(messages) }, NO_STORE);
  } catch {
    const [goal, files, messages] = await Promise.all([
      readGoalFile(state),
      readWorkspaceFiles(state),
      readActivityMessages(),
    ]);
    return NextResponse.json(
      { active: false, sessionId, state, messages, goal, files, totals: computeTotals(messages) },
      NO_STORE,
    );
  }
}
