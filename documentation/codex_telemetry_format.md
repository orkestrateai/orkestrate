# Codex Telemetry Format

Codex generates JSONL files located at `~/.codex/sessions/*.jsonl`. Each line is a standalone JSON object.

## Envelope Structure
All events follow a consistent header:
```json
{
  "timestamp": "2026-02-21T19:21:57.089Z",
  "type": "session_meta | response_item | event_msg | turn_context",
  "payload": { ... }
}
```

## Event Types

### 1. `session_meta`
Emitted at the start of a session. Contains environment and model info.
- **Payload fields**: [id](file:///c:/Users/pracu/OneDrive/Desktop/2026/Orkestrate/public/tools/codex/telemetry.js#67-75), `cwd`, `cli_version`, `model_provider`, `base_instructions`.

### 2. `response_item`
The most critical type for the chat view. It contains the actual conversation turns and tool interactions.
- `payload.type`:
    - `message`: A chat message. Check `role` (user/assistant) and `content[].text`.
    - `function_call`: A tool invocation. Contains `name`, `arguments`, and a unique `call_id`.
    - `function_call_output`: The result of a tool. Links back to the call via `call_id`.
    - `reasoning`: The agent's thought process. Contains a text `summary` and `encrypted_content`.

### 3. `event_msg`
Signal events for state changes or metadata.
- `payload.type`:
    - `task_started` / `task_complete` / `turn_aborted`: Marks boundaries for turns (grouping tool calls and messages).
    - `agent_reasoning`: High-level reasoning steps shown *during* generation.
    - `token_count`: Usage statistics.

### 4. `turn_context`
Low-level context used by the model for the current turn. Usually contains `cwd`, `model`, and history references. Typically skipped in UI rendering.

## Tool Chain Example
1. `response_item` (`function_call`) -> `call_id: "123"`
2. `response_item` (`function_call_output`) -> `call_id: "123"`
3. `response_item` (`message`) -> Final assistant response.

