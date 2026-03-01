# Raw Telemetry JSON — Actual Samples from Each Tool

Pulled directly from your machine's session files.

---

## 1. Codex (`~/.codex/sessions/*.jsonl`)

Each line in the JSONL has a consistent `{ timestamp, type, payload }` envelope.

### Session metadata
```json
{
  "timestamp": "2026-02-21T19:21:57.089Z",
  "type": "session_meta",
  "payload": {
    "id": "019c81a3-a982...",
    "cwd": "C:\\Users\\pracu\\OneDrive\\Desktop\\2026\\testing",
    "cli_version": "0.104.0",
    "model_provider": "openai",
    "base_instructions": { "text": "You are Codex..." }
  }
}
```

### User message
```json
{
  "timestamp": "...",
  "type": "response_item",
  "payload": {
    "type": "message",
    "role": "user",
    "content": [{ "type": "input_text", "text": "ok collaborate with other agents..." }]
  }
}
```

### Assistant message (with phase)
```json
{
  "timestamp": "...",
  "type": "response_item",
  "payload": {
    "type": "message",
    "role": "assistant",
    "content": [{ "type": "output_text", "text": "Two explorer agents are running..." }],
    "phase": "commentary"
  }
}
```

### Reasoning (with encrypted content)
```json
{
  "timestamp": "...",
  "type": "response_item",
  "payload": {
    "type": "reasoning",
    "summary": [{ "type": "summary_text", "text": "**Planning agent collaboration**" }],
    "content": null,
    "encrypted_content": "gAAAAABpmg..."
  }
}
```

### Agent reasoning (event_msg variant)
```json
{
  "timestamp": "...",
  "type": "event_msg",
  "payload": { "type": "agent_reasoning", "text": "**Initiating collaboration by reading shared workspace**" }
}
```

### Tool call (function_call)
```json
{
  "timestamp": "...",
  "type": "response_item",
  "payload": {
    "type": "function_call",
    "name": "mcp__Orkestrate__read_shared_workspace",
    "arguments": "{}",
    "call_id": "call_97VJMZtUh3qcMaExJIBHhLSH"
  }
}
```

### Tool output (function_call_output)
```json
{
  "timestamp": "...",
  "type": "response_item",
  "payload": {
    "type": "function_call_output",
    "call_id": "call_97VJMZtUh3qcMaExJIBHhLSH",
    "output": "[{\"type\":\"text\",\"text\":\"## Current State\\n...\"}]"
  }
}
```

### Task lifecycle
```json
{ "timestamp": "...", "type": "event_msg", "payload": { "type": "task_started", "turn_id": "019c81a6..." } }
{ "timestamp": "...", "type": "event_msg", "payload": { "type": "turn_aborted", "turn_id": "...", "reason": "interrupted" } }
```

### Noisy events (dropped by telemetry.js)
```json
{ "timestamp": "...", "type": "turn_context", "payload": { "turn_id": "...", "cwd": "...", "model": "gpt-5.3-codex", ... } }
{ "timestamp": "...", "type": "event_msg", "payload": { "type": "token_count", "info": { "total_token_usage": {...} } } }
{ "timestamp": "...", "type": "event_msg", "payload": { "type": "agent_message", "message": "..." } }
```

---

## 2. Claude Code (`~/.claude/projects/*.jsonl`)

> [!CAUTION]
> **Completely different schema from Codex.** Claude Code uses a flat conversation-log format with `parentUuid` chaining, NOT the `{ type, payload }` envelope.

### User message
```json
{
  "parentUuid": "3a6d88a2-...",
  "type": "user",
  "sessionId": "00e332a9-...",
  "version": "2.1.50",
  "cwd": "C:\\Users\\pracu\\OneDrive\\Desktop\\2026\\testing",
  "gitBranch": "HEAD",
  "message": { "role": "user", "content": "hi whats ur name" },
  "uuid": "c0eee532-...",
  "timestamp": "2026-02-25T17:17:43.122Z"
}
```

### Assistant message
```json
{
  "parentUuid": "c0eee532-...",
  "type": "assistant",
  "sessionId": "00e332a9-...",
  "version": "2.1.50",
  "message": {
    "id": "1772039866155",
    "type": "message",
    "role": "assistant",
    "model": "claude-haiku-4.5",
    "content": [{ "type": "text", "text": "I'm Claude, Anthropic's AI assistant..." }],
    "usage": { "input_tokens": 24556, "output_tokens": 49 }
  },
  "uuid": "0b640df5-...",
  "timestamp": "2026-02-25T17:17:46.653Z"
}
```

### Assistant thinking
```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "model": "qwen3.5-plus",
    "content": [{ "type": "thinking", "thinking": "User is asking about MCPs..." }]
  },
  "uuid": "8dcd0d85-...",
  "timestamp": "2026-02-25T17:18:27.028Z"
}
```

### Metadata/noise events
```json
{ "type": "file-history-snapshot", "messageId": "...", "snapshot": { "trackedFileBackups": {} } }
{ "type": "queue-operation", "operation": "enqueue", "content": "/model" }
```

### System / local command
```json
{
  "type": "system",
  "subtype": "local_command",
  "content": "<command-name>/model</command-name>...",
  "level": "info",
  "uuid": "1326892d-..."
}
```

> [!IMPORTANT]
> Claude Code has **no `function_call` / `function_call_output` fields** in the JSONL. Tool use shows up as content blocks within assistant messages with `type: "tool_use"` and `type: "tool_result"`. This session didn't have tool calls, but based on the Anthropic API format, they would appear as content array items inside the `message.content` array.

---

## 3. OpenCode (`~/.local/share/opencode/opencode.db` → SQLite `part` table)

OpenCode migrated from a file-system structure to a centralized SQLite database (`opencode.db`). The [telemetry.js](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/public/tools/codex/telemetry.js) script correctly polls this database, specifically the `part` table, where the `data` column contains a JSON string. 

The telemetry script wraps each row as:

```json
{
  "timestamp": "<ISO string from parsed.time.start or row.time_created>",
  "type": "<parsed.type or 'unknown_event'>",
  "payload": { /* entire parsed row.data object */ }
}
```

The actual internal shapes of the `payload` depend on the `parsed.type` (e.g., `step-start`, `reasoning`, `tool-call`, `tool-result`, `text`).

---

## The Key Finding: These Formats Are Fundamentally Different

| Aspect | Codex | Claude Code | OpenCode |
|---|---|---|---|
| **Storage** | Single `*.jsonl` file per session | Single `*.jsonl` file per session | Centralized `opencode.db` (SQLite) |
| **Envelope** | `{ timestamp, type, payload }` | `{ parentUuid, type, message, uuid, timestamp }` | `{ timestamp, type, payload }` (telemetry-wrapped) |
| **Top-level `type`** | `response_item`, `event_msg`, `session_meta`, `turn_context` | `user`, `assistant`, `system`, `file-history-snapshot` | `step-start`, `reasoning`, `tool-call`, `text`, etc. (from `parsed.type`) |
| **Tool calls** | `function_call` + `function_call_output` | `tool_use` + `tool_result` inside `message.content` | Separate `part` records with `type: "tool-call"` |
| **Reasoning** | `reasoning` / `agent_reasoning` | `thinking` inline in `message.content` | Separate `part` record with `type: "reasoning"` |
| **Turn boundaries** | `task_started` / `task_complete` | None (uuid chaining) | `step-start` / `step-finish` part records |

**Bottom line**: Each tool has a fundamentally different schema. [CodexRenderer](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/src/components/dashboard/CodexRenderer.tsx#481-524) only works for Codex. Claude Code needs a completely different parser. OpenCode's format, while wrapped in `{timestamp, type, payload}` by the telemetry script, has entirely different payload structures (e.g., `step-start` vs `task_started`, `tool-call` vs `function_call`). We need a unified parser or individual renderers to handle these differences.

## Detailed Tool Docs
- [Codex Format](file:///C:/Users/pracu/.gemini/antigravity/brain/4f53fe46-e07d-4626-8476-8e912ebed18b/codex_telemetry_format.md)
- [Claude Code Format](file:///C:/Users/pracu/.gemini/antigravity/brain/4f53fe46-e07d-4626-8476-8e912ebed18b/claude_code_telemetry_format.md)
- [OpenCode (SQLite) Format](file:///C:/Users/pracu/.gemini/antigravity/brain/4f53fe46-e07d-4626-8476-8e912ebed18b/opencode_telemetry_format.md)


