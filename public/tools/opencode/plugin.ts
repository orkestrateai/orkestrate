/**
 * Orkestrate Telemetry + Control Plugin for OpenCode
 *
 * Simple model:
 * 1) Send OpenCode events to Orkestrate telemetry
 * 2) Poll queued prompts and submit them into OpenCode TUI
 */

import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { execFileSync } from "child_process"
import { createHash } from "crypto"

function loadConfig(): Record<string, string> {
  const config: Record<string, string> = {}
  try {
    const configPath = join(homedir(), ".config", "opencode", ".Orkestrate.env")
    const content = readFileSync(configPath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      config[key] = val
    }
  } catch {
    // file missing is fine; fallback to process env below
  }
  return config
}

const fileConfig = loadConfig()
const HOST = fileConfig.Orkestrate_HOST || process.env.Orkestrate_HOST || "orkestrate.vercel.app"
const AGENT_ID = fileConfig.Orkestrate_AGENT_ID || process.env.Orkestrate_AGENT_ID || ""
const CLIENT_ID = fileConfig.Orkestrate_CLIENT || process.env.Orkestrate_CLIENT || ""
const ROOM_ID = fileConfig.Orkestrate_ROOM || process.env.Orkestrate_ROOM || ""

const INGEST_URL = `https://${HOST}/api/telemetry/ingest`
const CONTROL_PULL_URL = `https://${HOST}/api/agent-control/pull`
const CONTROL_ACK_URL = `https://${HOST}/api/agent-control/ack`
const HEARTBEAT_INTERVAL_MS = 30_000
const CONTROL_POLL_INTERVAL_MS = 3_000

let activeSessionId: string | null = null
let repoSnapshotCache:
  | {
    key: string
    at: number
    value: { canonicalRemote?: string; branch?: string; headSha?: string; dirty?: boolean }
  }
  | null = null

function buildTelemetryUrl(): string {
  const params = new URLSearchParams({
    clientId: CLIENT_ID,
    agent: AGENT_ID,
    roomId: ROOM_ID,
  })
  return `${INGEST_URL}?${params.toString()}`
}

async function sendTelemetry(payload: Record<string, unknown>, event = "log"): Promise<void> {
  if (!AGENT_ID || !CLIENT_ID || !ROOM_ID) return
  try {
    await fetch(buildTelemetryUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        ...payload,
        sessionID: activeSessionId,
      }),
    })
  } catch {
    // never break OpenCode for telemetry failures
  }
}

function normalizeRemote(raw: string): string {
  const value = raw.trim()
  const scp = value.match(/^([^@]+)@([^:]+):(.+)$/)
  if (scp) {
    return `${scp[2].toLowerCase()}/${scp[3].replace(/\.git$/i, "").replace(/^\/+/, "")}`
  }
  try {
    const parsed = new URL(value)
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\.git$/i, "").replace(/\/+$/, "")}`
  } catch {
    return value.replace(/\.git$/i, "").toLowerCase()
  }
}

function runGit(directory: string, args: string[]): string {
  return execFileSync("git", args, { cwd: directory, stdio: ["ignore", "pipe", "ignore"] })
    .toString("utf-8")
    .trim()
}

function readRepoSnapshot(directory: string): { canonicalRemote?: string; branch?: string; headSha?: string; dirty?: boolean } {
  const cacheKey = directory
  if (repoSnapshotCache && repoSnapshotCache.key === cacheKey && Date.now() - repoSnapshotCache.at < 4000) {
    return repoSnapshotCache.value
  }

  try {
    const remote = runGit(directory, ["config", "--get", "remote.origin.url"])
    const branch = runGit(directory, ["rev-parse", "--abbrev-ref", "HEAD"])
    const headSha = runGit(directory, ["rev-parse", "HEAD"])
    const dirty = runGit(directory, ["status", "--porcelain", "-uno"]).length > 0
    const value = {
      canonicalRemote: remote ? normalizeRemote(remote) : undefined,
      branch: branch || undefined,
      headSha: headSha || undefined,
      dirty,
    }
    repoSnapshotCache = { key: cacheKey, at: Date.now(), value }
    return value
  } catch {
    const value = {}
    repoSnapshotCache = { key: cacheKey, at: Date.now(), value }
    return value
  }
}

function maybeString(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input.trim() : null
}

function extractPath(input: Record<string, unknown>): string | null {
  return (
    maybeString(input.path) ||
    maybeString(input.file) ||
    maybeString(input.targetFile) ||
    maybeString(input.TargetFile) ||
    maybeString(input.AbsolutePath) ||
    maybeString(input.newPath) ||
    maybeString(input.destination) ||
    null
  )
}

function extractLine(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function inferEditOperation(toolName: string): "create" | "update" | "delete" | "move" | "unknown" {
  const n = toolName.toLowerCase()
  if (n.includes("delete") || n.includes("remove")) return "delete"
  if (n.includes("move") || n.includes("rename")) return "move"
  if (n.includes("create")) return "create"
  if (n.includes("write") || n.includes("edit") || n.includes("replace")) return "update"
  return "unknown"
}

function buildPatchHash(input: unknown): string {
  return createHash("sha1").update(JSON.stringify(input ?? {})).digest("hex").slice(0, 16)
}

function extractFileEditActivity(toolName: string, input: Record<string, unknown>, output: any) {
  const lower = toolName.toLowerCase()
  const mutating = [
    "edit",
    "replace_file_content",
    "multi_replace_file_content",
    "write",
    "write_file",
    "create_file",
    "delete",
    "delete_file",
    "move_file",
    "rename",
  ]
  if (!mutating.some((token) => lower.includes(token))) return null

  const path = extractPath(input)
  if (!path) return null

  const snippet =
    typeof output?.output === "string"
      ? output.output.slice(0, 300)
      : typeof output?.title === "string"
        ? output.title.slice(0, 300)
        : undefined

  const lineStart = extractLine((input as any).lineStart ?? (input as any).startLine ?? (input as any).line)
  const lineEnd = extractLine((input as any).lineEnd ?? (input as any).endLine)
  const operation = inferEditOperation(toolName)

  return {
    type: "file_edit_observed",
    payload: {
      edit: {
        path,
        operation,
        lineStart,
        lineEnd,
        snippet,
        patchHash: buildPatchHash({
          toolName,
          path,
          operation,
          lineStart,
          lineEnd,
          snippet,
          args: input,
        }),
      },
    },
  }
}

function extractCommitActivity(toolName: string, input: Record<string, unknown>, directory: string) {
  const lower = toolName.toLowerCase()
  if (!(lower.includes("bash") || lower.includes("run_command") || lower.includes("execute"))) {
    return null
  }

  const command =
    maybeString(input.command) ||
    maybeString(input.cmd) ||
    maybeString((input as any).CommandLine)
  if (!command || !/git\s+commit\b/i.test(command)) return null

  const repo = readRepoSnapshot(directory)
  let changedPaths: string[] = []
  try {
    const output = runGit(directory, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
    changedPaths = output.split("\n").map((line) => line.trim()).filter((line) => Boolean(line)).slice(0, 200)
  } catch {
    // ignore
  }

  const messageMatch = command.match(/-m\s+["']([^"']+)["']/i)
  const message = messageMatch?.[1] || "git commit"

  return {
    type: "commit_observed",
    payload: {
      commit: {
        sha: repo.headSha || "",
        message,
        changedPaths,
      },
    },
    repo,
  }
}

async function submitPromptToTui(client: any, directory: string, text: string) {
  if (typeof client?.tui?.appendPrompt !== "function" || typeof client?.tui?.submitPrompt !== "function") {
    throw new Error("OpenCode TUI API unavailable (appendPrompt/submitPrompt)")
  }

  await client.tui.appendPrompt({
    query: { directory },
    body: { text },
  } as any)

  await client.tui.submitPrompt({
    query: { directory },
  } as any)
}

async function acknowledgeCommand(
  commandId: string,
  status: "dispatched" | "failed",
  failureReason?: string,
) {
  try {
    const params = new URLSearchParams({
      clientId: CLIENT_ID,
      agent: AGENT_ID,
      roomId: ROOM_ID,
    })
    await fetch(`${CONTROL_ACK_URL}?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commandId,
        status,
        failureReason: failureReason || null,
      }),
    })
  } catch {
    // best effort; telemetry still captures dispatch result
  }
}

export const OrkestrateTelemetry: Plugin = async ({ client, directory }) => {
  if (!AGENT_ID || !CLIENT_ID || !ROOM_ID) {
    console.log("[Orkestrate] Not configured - skipping plugin.")
    return {}
  }

  await sendTelemetry(
    {
      type: "connect",
      payload: {
        agent: AGENT_ID,
        client: CLIENT_ID,
        roomId: ROOM_ID,
        source: "opencode-plugin",
        directory,
      },
    },
    "system",
  )

  const heartbeatTimer = setInterval(() => {
    void sendTelemetry(
      {
        type: "heartbeat",
        payload: { agent: AGENT_ID, uptime: process.uptime() },
      },
      "heartbeat",
    )
  }, HEARTBEAT_INTERVAL_MS)
  heartbeatTimer.unref()

  const pollControlCommands = async () => {
    try {
      const params = new URLSearchParams({
        clientId: CLIENT_ID,
        agent: AGENT_ID,
        roomId: ROOM_ID,
      })
      const res = await fetch(`${CONTROL_PULL_URL}?${params.toString()}`)
      if (!res.ok) return

      const data = await res.json()
      const commands = Array.isArray(data?.commands) ? data.commands : []

      for (const command of commands) {
        const commandId = typeof command?.id === "string" ? command.id : ""
        const text = typeof command?.text === "string" ? command.text.trim() : ""
        if (!text || !commandId) continue

        await sendTelemetry(
          {
            type: "dashboard_prompt",
            payload: {
              commandId,
              text,
              source: "dashboard",
            },
          },
          "system",
        )

        try {
          await submitPromptToTui(client, directory, text)
          await acknowledgeCommand(commandId, "dispatched")
          await sendTelemetry(
            {
              type: "dashboard_prompt_dispatched",
              payload: {
                commandId,
                mode: "tui",
              },
            },
            "system",
          )
        } catch (e: any) {
          await acknowledgeCommand(commandId, "failed", e?.message || "TUI prompt dispatch failed")
          await sendTelemetry(
            {
              type: "dashboard_prompt_error",
              payload: {
                commandId,
                reason: e?.message || "TUI prompt dispatch failed",
              },
            },
            "system",
          )
        }
      }
    } catch {
      // best effort polling
    }
  }

  const controlPollTimer = setInterval(() => {
    void pollControlCommands()
  }, CONTROL_POLL_INTERVAL_MS)
  controlPollTimer.unref()

  const cleanup = () => {
    clearInterval(heartbeatTimer)
    clearInterval(controlPollTimer)
    void sendTelemetry(
      {
        type: "disconnect",
        payload: {
          agent: AGENT_ID,
          client: CLIENT_ID,
          roomId: ROOM_ID,
        },
      },
      "system",
    )
  }

  process.on("beforeExit", cleanup)
  process.once("SIGTERM", cleanup)
  process.once("SIGINT", cleanup)

  return {
    event: async ({ event }) => {
      // Track session id for correlation only.
      if (event.type === "session.created") {
        const sid = (event as any)?.properties?.info?.id
        if (typeof sid === "string" && sid) activeSessionId = sid
      }
      if (event.type === "message.updated") {
        const sid = (event as any)?.properties?.info?.sessionID
        if (typeof sid === "string" && sid) activeSessionId = sid
      }
      if (event.type === "session.status" || event.type === "session.idle") {
        const sid = (event as any)?.properties?.sessionID
        if (typeof sid === "string" && sid) activeSessionId = sid
      }

      // Send all OpenCode event JSON through telemetry.
      await sendTelemetry(
        {
          type: event.type,
          payload: event,
        },
        "log",
      )
    },

    "tool.execute.before": async (input, output) => {
      await sendTelemetry(
        {
          type: "tool",
          payload: {
            type: "tool",
            tool: input.tool,
            state: { status: "running", input: (input as any).args },
          },
        },
        "log",
      )
    },

    "tool.execute.after": async (input, output) => {
      const toolName = typeof input?.tool === "string" ? input.tool : "tool"
      const toolInput = ((input as any)?.args && typeof (input as any).args === "object") ? (input as any).args : {}

      await sendTelemetry(
        {
          type: "tool",
          payload: {
            type: "tool",
            tool: toolName,
            state: { status: "completed", output: (output.output || "").slice(0, 2000) },
            title: output.title,
          },
        },
        "log",
      )

      const repo = readRepoSnapshot(directory)
      const editActivity = extractFileEditActivity(toolName, toolInput as Record<string, unknown>, output)
      if (editActivity) {
        await sendTelemetry(
          {
            type: editActivity.type,
            payload: editActivity.payload,
            repo,
          },
          "activity",
        )
      }

      const commitActivity = extractCommitActivity(toolName, toolInput as Record<string, unknown>, directory)
      if (commitActivity) {
        await sendTelemetry(
          {
            type: commitActivity.type,
            payload: commitActivity.payload,
            repo: commitActivity.repo || repo,
          },
          "activity",
        )
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      output.context.push(
        `## Orkestrate Team Coordination\n` +
        `You are agent \`${AGENT_ID}\` connected to room \`${ROOM_ID}\` via the Orkestrate MCP.\n` +
        `After compaction, call \`read_agent_state\` to re-sync with the team before resuming work.\n` +
        `Your canonical agent id is: \`${AGENT_ID}\`. Use this exact id in all MCP tool calls.`,
      )
    },
  }
}
