# MCP / Telemetry / agentalk.js Review Findings
Date: 2026-02-23
Scope: MCP server code, telemetry pipeline, public telemetry scripts (`telemetry.js`, `agentalk.js`)

## Findings (ordered by severity)

### 1) [P0] Unauthenticated remote command execution path
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\app\api\telemetry\commands\route.ts#L9`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\app\api\telemetry\commands\route.ts#L45`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\public\agentalk.js#L123`

`/api/telemetry/commands` accepts and serves commands without authentication, and `agentalk.js` writes fetched message content directly into the PTY. Any network caller reaching that endpoint can inject commands into a wrapped agent session.

### 2) [P1] OAuth authorization can be approved as arbitrary `user_id`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\pages\api\oauth\authorize.ts#L78`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\pages\api\oauth\authorize.ts#L94`

`user_id` is accepted from query params and used to mint auth codes, but the API route does not verify a logged-in server-side session before approval.

### 3) [P1] Telemetry ingest endpoint is unauthenticated and publicly writable
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\app\api\telemetry\ingest\route.ts#L9`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\app\api\telemetry\ingest\route.ts#L22`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\app\api\telemetry\ingest\route.ts#L36`

The endpoint accepts unauthenticated writes and forwards payloads to DB + realtime broadcast. This allows spoofed telemetry, potential DB spam/cost amplification, and dashboard poisoning.

### 4) [P1] Team state optimistic concurrency check is race-prone
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\lib\shared-workspace.ts#L53`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\lib\shared-workspace.ts#L72`

`expectedStateHash` is checked before update, but not in a transactional/locked write path. Concurrent writers can both pass validation and both commit.

### 5) [P2] Missing uniqueness constraint for logical agent identity
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\db\schema.ts#L8`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\lib\shared-workspace.ts#L24`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\lib\shared-workspace.ts#L76`

No unique key exists on `(user_id, project_id, client_id)`. Read-then-insert upsert logic can create duplicate rows under concurrency.

### 6) [P2] Target-agent parsing fails with hyphenated agent names
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\app\api\telemetry\commands\route.ts#L21`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\public\telemetry.js#L291`

Parsing `targetAgent` by last hyphen breaks agent types like `claude-code`, risking wrong route target.

### 7) [P2] `agentalk.js` is presented as generic but hardcodes Codex
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\public\agentalk.js#L76`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\src\pages\api\mcp.ts#L192`

Runtime behavior always spawns `codex`, despite user-facing instruction implying command replacement support.

### 8) [P3] PID reuse/spoof risk in telemetry singleton handling
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\public\telemetry.js#L21`
- `C:\Users\pracu\OneDrive\Desktop\2026\Agentalk\public\telemetry.js#L33`

Process termination logic trusts a predictable pidfile and can signal unrelated processes if PID is stale/reused/tampered.

## Assumptions
- Assumed telemetry endpoints are publicly reachable without upstream auth/WAF constraints.
- Assumed OAuth approval must be session-bound to the authenticated user identity.

## Suggested Work Order (later)
1. Lock down `/api/telemetry/commands` and `/api/telemetry/ingest` with authn/authz and target ownership checks.
2. Fix OAuth approval binding (derive user from session, not query param).
3. Make team-state updates atomic (transaction + version/hash guard) and add DB uniqueness constraints.
4. Fix command target parsing and wrapper command handling in `agentalk.js`.
