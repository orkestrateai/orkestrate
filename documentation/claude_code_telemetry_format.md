# Claude Code Telemetry Format

Claude Code generates JSONL files located at `~/.claude/projects/*.jsonl`. It uses a "Conversation Log" style structure rather than a generic envelope.

## Event Structure
Events are flat objects with metadata and a `message` or `content` field.
```json
{
  "uuid": "unique-id",
  "parentUuid": "id-of-previous-turn",
  "type": "user | assistant | system | file-history-snapshot | queue-operation",
  "sessionId": "session-id",
  "timestamp": "2026-02-25T17:14:31.379Z",
  "message": { "role": "user/assistant", "content": [...] }
}
```

## Content Types

Unlike Codex, Claude Code maps directly to the Anthropic API structure. Tool calls and results are **inline** within the `content` array of a message.

### 1. `user` / `assistant` Messages
- **Payload**: `message.content[]`
- **Item Types**:
    - `text`: Plain text content.
    - `thinking`: The `<thinking>` blocks (reasoning).
    - `tool_use`: Request to run a tool (name, input, id).
    - `tool_result`: The output of a tool (id, content).

### 2. `system` Messages
Used for internal signals or low-level logs.
- `subtype: "local_command"`: Logs of CLI commands like `/model`.

### 3. Meta Events
- `file-history-snapshot`: Snapshots of files for undo/redo or context.
- `queue-operation`: Internal task management logs.

## Chaining Logic
Turns are liked via `parentUuid`. To reconstruct a chat, you must follow the UUID chain from the latest event back to the root (`parentUuid: null`).
