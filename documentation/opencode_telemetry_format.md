# OpenCode Telemetry Format

OpenCode stores telemetry in a centralized SQLite database at `~/.local/share/opencode/opencode.db`.

## Database Schema

### `session` Table
High-level session metadata.
- [id](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/public/tools/codex/telemetry.js#67-75): Unique session identifier.
- `title`: User-facing title.
- `directory`: Project path.
- `time_created` / `time_updated`: Epoch timestamps.

### `message` Table
Represents individual turns in the conversation.
- [id](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/public/tools/codex/telemetry.js#67-75): Message UUID.
- `session_id`: Link to parent session.
- `data`: JSON string containing role and timing.
  - `{"role": "user/assistant", "modelID": "...", "providerID": "...", "finish": "tool-calls/stop"}`

### `part` Table
Granular events within a message (thinking, tool calls, text chunks).
- [id](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/public/tools/codex/telemetry.js#67-75): Part UUID.
- `message_id`: Link to parent message.
- `data`: JSON string containing the actual event content.

## "Part" JSON Types (`data.type`)

- `step-start`: Marks the beginning of an agent step.
- `reasoning`: The agent's thought process (`data.text`).
- `text`: Incremental text output.
- `tool-call`: Tool invocation with `name`, `args`, and [id](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/public/tools/codex/telemetry.js#67-75).
- `tool-result`: Result of a tool link by [id](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/public/tools/codex/telemetry.js#67-75).
- `step-finish`: Marks the end of a step with token/cost stats.

## Rendering Strategy
To render an OpenCode chat:
1. Fetch all `message` records for a `session_id`.
2. For each message, fetch all associated `part` records ordered by `time_created`.
3. Reconstruct the UI by mapping `part` types to chat components (e.g., `reasoning` -> [ReasoningBlock](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/src/components/dashboard/CodexRenderer.tsx#286-311)).

