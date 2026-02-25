/**
 * Agentalk Telemetry Plugin for OpenCode
 *
 * Replaces the hacky telemetry.js file-tailing approach with structured
 * event-driven telemetry using OpenCode's native plugin system.
 *
 * Installation:
 *   Drop this file into ~/.config/opencode/plugins/agentalk.ts
 *
 * Configuration:
 *   The MCP `agentalk_initialize` tool writes a config file at:
 *   ~/.config/opencode/.agentalk.env
 *
 *   The plugin reads this file automatically on startup.
 *   Falls back to process.env if the file is missing.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

// --- Configuration -----------------------------------------------------------

function loadConfig(): Record<string, string> {
    const config: Record<string, string> = {}
    try {
        const configPath = join(homedir(), ".config", "opencode", ".agentalk.env")
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
        // File doesn't exist — fall back to process.env
    }
    return config
}

const fileConfig = loadConfig()
const HOST = fileConfig.AGENTALK_HOST || process.env.AGENTALK_HOST || "agentalk.vercel.app"
const AGENT_ID = fileConfig.AGENTALK_AGENT_ID || process.env.AGENTALK_AGENT_ID || ""
const CLIENT_ID = fileConfig.AGENTALK_CLIENT || process.env.AGENTALK_CLIENT || ""
const ROOM_ID = fileConfig.AGENTALK_ROOM || process.env.AGENTALK_ROOM || ""

const INGEST_URL = `https://${HOST}/api/telemetry/ingest`
const HEARTBEAT_INTERVAL_MS = 15_000
const MAX_MESSAGE_LENGTH = 100_000

// --- Helpers -----------------------------------------------------------------

function buildUrl(): string {
    const params = new URLSearchParams({
        clientId: CLIENT_ID,
        agent: AGENT_ID,
        roomId: ROOM_ID,
    })
    return `${INGEST_URL}?${params.toString()}`
}

async function sendTelemetry(
    message: string | object,
    event: string = "log",
): Promise<void> {
    if (!AGENT_ID || !CLIENT_ID || !ROOM_ID) return

    try {
        const msgStr =
            typeof message === "string" ? message : JSON.stringify(message)
        const truncated =
            msgStr.length > MAX_MESSAGE_LENGTH
                ? msgStr.slice(0, MAX_MESSAGE_LENGTH) +
                `\n...[truncated ${msgStr.length - MAX_MESSAGE_LENGTH} chars]`
                : msgStr

        await fetch(buildUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: truncated, event }),
        })
    } catch {
        // Silently ignore — telemetry should never break the agent
    }
}

// --- Plugin ------------------------------------------------------------------

export const AgentalkTelemetry: Plugin = async ({ directory }) => {
    // Skip if not configured (MCP hasn't initialized yet)
    if (!AGENT_ID || !CLIENT_ID || !ROOM_ID) {
        console.log("[Agentalk] Not configured — skipping telemetry plugin.")
        return {}
    }

    console.log(
        `[Agentalk] Telemetry plugin active for ${AGENT_ID} in room ${ROOM_ID}`,
    )

    // Send connect event
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

    // Heartbeat timer
    const heartbeatTimer = setInterval(() => {
        sendTelemetry(
            {
                type: "heartbeat",
                payload: { agent: AGENT_ID, uptime: process.uptime() },
            },
            "system",
        )
    }, HEARTBEAT_INTERVAL_MS)

    // Unref so the timer doesn't prevent the process from exiting naturally
    heartbeatTimer.unref()

    // Clean up on exit — use signals instead of beforeExit (which is unreliable
    // and keeps the event loop alive via the interval timer)
    const onExit = (signal: NodeJS.Signals) => {
        clearInterval(heartbeatTimer)
        // Note: async sendTelemetry won't complete on process exit — this is
        // best-effort. The heartbeat timeout on the server will detect the
        // disconnect within HEARTBEAT_INTERVAL_MS anyway.
        sendTelemetry(
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
        // Re-emit the signal to preserve default termination behavior
        process.kill(process.pid, signal)
    }
    process.once("SIGTERM", () => onExit("SIGTERM"))
    process.once("SIGINT", () => onExit("SIGINT"))

    return {
        // --- Event-based telemetry -----------------------------------------------
        event: async ({ event }) => {
            // Session lifecycle
            if (event.type === "session.created") {
                await sendTelemetry({ type: "session_created", payload: event })
            }

            if (event.type === "session.idle") {
                await sendTelemetry({ type: "session_idle", payload: event })
            }

            if (event.type === "session.error") {
                await sendTelemetry({ type: "session_error", payload: event })
            }

            // Message updates — the core telemetry stream
            if (event.type === "message.part.updated") {
                await sendTelemetry({ type: "message_part", payload: event })
            }

            if (event.type === "message.updated") {
                await sendTelemetry({ type: "message_updated", payload: event })
            }

            // File edits — architecture footprint tracking
            if (event.type === "file.edited") {
                await sendTelemetry({ type: "file_edited", payload: event })
            }

            // Command execution
            if (event.type === "command.executed") {
                await sendTelemetry({ type: "command_executed", payload: event })
            }
        },

        // --- Tool call hooks -----------------------------------------------------

        "tool.execute.before": async (input, output) => {
            await sendTelemetry({
                type: "response_item",
                payload: {
                    type: "function_call",
                    name: input.tool,
                    arguments: JSON.stringify(output.args).slice(0, 2000),
                },
            })
        },

        "tool.execute.after": async (input, output) => {
            await sendTelemetry({
                type: "tool_result",
                payload: {
                    tool: input.tool,
                    title: output.title,
                    output: (output.output || "").slice(0, 2000),
                },
            })
        },

        // --- Compaction hook — persist Agentalk context across compactions --------

        "experimental.session.compacting": async (_input, output) => {
            output.context.push(
                `## Agentalk Team Coordination\n` +
                `You are agent \`${AGENT_ID}\` connected to room \`${ROOM_ID}\` via the Agentalk MCP.\n` +
                `After compaction, call \`read_team_state\` to re-sync with the team before resuming work.\n` +
                `Your canonical agent id is: \`${AGENT_ID}\`. Use this exact id in all MCP tool calls.`,
            )
        },
    }
}
