import type { ParsedEvent } from "./types";

/**
 * Converts parsed telemetry events into Claude-renderer-compatible parts.
 * Includes fingerprint-based de-duplication to handle redundant events
 * from HTTP hooks vs JSONL tailing.
 */
export function toClaudeParts(events: ParsedEvent[]) {
    const parts: any[] = [];
    const seenFingerprints = new Set<string>();

    for (const event of events) {
        const p = event.payload || {};
        const raw = event.parsedRaw || p || {};
        const typeStr = (raw.type || raw.hook_event_name || event.parsedType || "").toString();

        let fingerprint = "";
        let newPart: any = null;

        // --- 1. USER PROMPT ---
        if (typeStr === "UserPromptSubmit" || typeStr === "user" || (typeStr === "message" && p?.message?.role === "user")) {
            const text = raw.prompt || p.text || p.message?.content?.[0]?.text || (typeof p.message?.content === "string" ? p.message.content : "");
            if (text) {
                fingerprint = `user:${text}`;
                newPart = { type: "user", message: { content: [{ type: "text", text }] } };
            }
        }
        // --- 2. ASSISTANT / TEXT / THINKING ---
        else if (
            ["AssistantMessage", "assistant", "text", "thinking", "reasoning"].includes(typeStr) ||
            (typeStr === "message" && p?.message?.role === "assistant")
        ) {
            const msgObj = p.message || raw.message;
            const content: any[] = [];
            if (msgObj?.content && Array.isArray(msgObj.content)) {
                content.push(...msgObj.content);
            } else {
                const text = p.text || p.content || (typeof p.message === "string" ? p.message : "");
                const type = typeStr === "thinking" || typeStr === "reasoning" ? "thinking" : "text";
                if (text) content.push({ type, text });
            }
            if (content.length > 0) {
                const firstPart = content.find((c) => c.type === "text")?.text || "";
                fingerprint = `assistant:${firstPart.slice(0, 100)}`;
                newPart = { type: "assistant", message: { content } };
            }
        }
        // --- 3. TOOL USE ---
        else if (["PostToolUse", "PostToolUseFailure", "tool_use", "tool-call"].includes(typeStr)) {
            const callID = raw.tool_use_id || p.id || p.callID || p.toolCallId;
            const toolName = raw.tool_name || p.name || p.tool || "tool";
            const input = raw.tool_input || p.input || {};
            const output = raw.tool_response || p.output;

            fingerprint = `tool:${callID || toolName}`;
            newPart = {
                type: "assistant",
                message: { content: [{ type: "tool_use", id: callID, name: toolName, input }] },
            };

            if (output && callID) {
                parts.push(newPart);
                parts.push({
                    type: "user",
                    message: { content: [{ type: "tool_result", tool_use_id: callID, content: output }] },
                });
                newPart = null;
            }
        }
        // --- 4. OBSERVED ACTIVITY ---
        else if (["file_edit_observed", "commit_observed", "conflict_alert"].includes(typeStr)) {
            const activityText =
                typeStr === "file_edit_observed"
                    ? `Observed edit: ${p?.edit?.path || p?.path || "unknown"} (${p?.edit?.operation || p?.operation || "unknown"})`
                    : typeStr === "commit_observed"
                        ? `Observed commit: ${p?.commit?.sha || "unknown"} ${p?.commit?.message || ""}`.trim()
                        : `Conflict alert: ${p?.path || p?.editPath || "unknown path"}`;

            fingerprint = `activity:${typeStr}:${activityText}`;
            newPart = {
                type: "assistant",
                message: {
                    content: [
                        {
                            type: "text",
                            text: activityText,
                        },
                    ],
                },
            };
        }

        if (newPart) {
            if (fingerprint && seenFingerprints.has(fingerprint)) continue;
            if (fingerprint) seenFingerprints.add(fingerprint);
            parts.push(newPart);
        }
    }
    return parts;
}
