# Audit Fix Plan

Date: 2026-03-03
Source Audit: `audit.md`
Goal: convert verified findings into an execution-ready remediation backlog with clear ownership, patch order, and measurable verification.

---

## Owner Map

- `Auth/OAuth` - OAuth endpoints, token lifecycle, scope enforcement.
- `Control Plane` - agent command APIs (`pull/ack/send/status`) and command integrity.
- `Telemetry` - ingestion, attribution, session linkage, realtime broadcast hygiene.
- `Frontend` - renderer sanitization and client-side hardening.
- `Data/Schema` - constraints, foreign keys, cascade behavior, atomicity primitives.
- `Platform/Security` - middleware, CSP, rate limits, error handling policy.

---

## Patch Order (Execution Waves)

1. **Wave 0 (P0 blockers)**: findings `F01-F05`.
2. **Wave 1 (P1 abuse paths)**: findings `F06-F11`.
3. **Wave 2 (P2 hardening + scale)**: findings `F12-F18`.
4. **Wave 3 (remaining consolidated backlog)**: all non-priority and partial findings from `audit.md` consolidation matrix.

---

## Per-Finding Execution Checklist

Status legend: `todo` / `in_progress` / `done`.

| ID | Sev | Finding | Primary Files | Suggested Owner | Patch Plan | Verification Criteria | Status |
|---|---|---|---|---|---|---|---|
| F01 | P0 | OAuth approval trusts query `user_id` | `src/pages/api/oauth/authorize.ts`, `src/app/oauth/authorize/page.tsx` | Auth/OAuth | Derive user from server session, remove/ignore client-provided `user_id`, make approval POST-only, add CSRF token/state validation. | Cannot mint code when forging `user_id`; approval without valid session fails `401/403`; CSRF test fails without token and passes with token. | todo |
| F02 | P0 | Unauthenticated command pull | `src/app/api/agent-control/pull/route.ts` | Control Plane | Require bearer auth, verify workspace membership, bind caller to allowed `scopedAgentId`, reject mismatches. | Unauthenticated pull returns `401`; cross-workspace/member pull returns `403`; authorized pull still dequeues valid commands. | todo |
| F03 | P0 | Unauthenticated command ack | `src/app/api/agent-control/ack/route.ts` | Control Plane | Add same authz model as `send/status`; enforce ownership on command ID; add idempotent ack key (or idempotent state transition). | Unauthenticated ack `401`; non-owner ack `403`; duplicate ack does not corrupt state. | todo |
| F04 | P0 | Stored XSS in chat markdown rendering | `src/components/dashboard/ChatRenderer.tsx` | Frontend | Sanitize rendered HTML (`DOMPurify`/`isomorphic-dompurify`), restrict dangerous tags/attrs, keep markdown rendering behavior. | Payloads with `<script>`/event handlers do not execute; rendered text remains visible; regression test for markdown formatting passes. | todo |
| F05 | P0 | Telemetry user attribution fallback is unauthenticated | `src/app/api/telemetry/ingest/route.ts` | Telemetry | Require auth for attributable telemetry; remove `resolveTelemetryUserId` fallback inference path; preserve optional anonymous channel separately. | No user-attributed writes without valid token; spoofed `clientId` cannot attribute to another user; existing authenticated ingest still works. | todo |
| F06 | P1 | Telemetry ingest lacks room membership guard | `src/app/api/telemetry/ingest/route.ts` | Telemetry | Validate caller membership/access to `roomId` before writing telemetry/activity/session records. | Cross-room writes by valid but non-member user return `403`; valid room membership allows ingest. | todo |
| F07 | P1 | OAuth scopes not enforced in MCP tool calls | `src/pages/api/mcp.ts` | Auth/OAuth | Define scope matrix by tool/action (read vs write), enforce before execution, return `insufficient_scope` semantics. | `mcp:read` token cannot call write tools; `mcp:write` token can perform allowed write actions; tests assert expected denial responses. | todo |
| F08 | P1 | Shared-state optimistic lock TOCTOU | `src/lib/shared-workspace.ts` | Data/Schema | Replace read-then-write hash check with transactional CAS update (`WHERE state_hash = expected`). | Concurrent update test: only one writer succeeds, others receive conflict path; no silent overwrite. | todo |
| F09 | P1 | OAuth code/refresh consume is non-atomic | `src/lib/oauth-store.ts` | Auth/OAuth + Data/Schema | Move token/code storage to atomic primitive (DB `DELETE ... RETURNING` or Redis `GETDEL`) and ensure single-use semantics. | Concurrent token/code exchange: one success only; replay attempt returns `invalid_grant`. | todo |
| F10 | P1 | Refresh flow allows missing `client_id` | `src/pages/api/oauth/token.ts`, `src/lib/oauth-store.ts` | Auth/OAuth | Require `client_id` in refresh grant and enforce strict equality with stored token binding. | Refresh request without `client_id` fails `400`; wrong client ID fails `invalid_grant`; valid pair succeeds. | todo |
| F11 | P1 | Workspace rename/delete allowed for any member | `src/lib/workspaces.ts`, `src/pages/api/workspaces.ts` | Control Plane | Enforce role-based checks (`owner` only) for rename/delete; keep read/switch for members. | Member cannot rename/delete owner workspace (`403`); owner can perform both actions; no regression in workspace listing/switching. | todo |
| F12 | P2 | `stateHash` uses `Math.random()` | `src/lib/shared-workspace.ts`, `src/app/api/telemetry/ingest/route.ts` | Data/Schema | Replace with cryptographically strong ID/hash (`crypto.randomUUID` or SHA-256 content hash). | Generated hashes are non-trivial and unique under load test; no reliance on weak RNG remains. | todo |
| F13 | P2 | Tasks API filters in memory | `src/pages/api/tasks.ts` | Control Plane | Push project filter into SQL (`inArray`) and keep status filtering at DB layer. | Query plan no longer loads all tasks; API result parity preserved for sample data. | todo |
| F14 | P2 | OAuth registration lacks strict redirect URI validation | `src/pages/api/oauth/register.ts` | Auth/OAuth | Validate URI scheme/host/path policy; block unsafe schemes and malformed entries. | `javascript:`/`data:` and malformed URIs rejected; valid HTTPS/loopback URIs accepted per policy. | todo |
| F15 | P2 | `baseUrl` trusts forwarded headers | `src/lib/http.ts` | Platform/Security | Use canonical origin from trusted config; optionally allowlist forwarded host/proto only from trusted proxy. | Injected forwarded headers do not alter generated security metadata/challenge URLs unexpectedly. | todo |
| F16 | P2 | Knowledge APIs lack robust input bounds/validation | `src/pages/api/knowledge.ts` | Control Plane | Add schema validation (types/length limits/allowed fields) and explicit payload size guards. | Oversized or malformed payloads return `400`; valid payloads still create/update docs correctly. | todo |
| F17 | P2 | Missing centralized CSP | middleware/config and response headers | Platform/Security + Frontend | Add CSP policy with nonce/hash for scripts; roll out report-only first, then enforce. | Browser response includes CSP header; no inline script execution from injected payloads; app functionality preserved. | todo |
| F18 | P2 | Verbose internal error details exposed | multiple API routes | Platform/Security | Replace client `detail: error.message` with generic messages; log detailed error server-side only with request correlation ID. | Client responses no longer expose internals; server logs retain diagnostics with trace IDs. | todo |
| F19 | P2 | Knowledge folder delete orphans children | `src/pages/api/mcp.ts`, `src/db/schema.ts` | Data/Schema | Implement recursive delete (or re-parent to root) before folder removal; add `ON DELETE CASCADE` or `SET NULL` on `parentId` FK. | Deleting a folder also removes/re-parents its children; no orphaned `parentId` references remain. | todo |
| F20 | P2 | Missing cascade deletes on workspace FKs | `src/db/schema.ts`, `src/lib/workspaces.ts` | Data/Schema | Add `ON DELETE CASCADE` to all FKs referencing `rooms.id`; or add app-level cascade in `deleteWorkspaceForUser`. | Deleting a workspace leaves no orphaned rows in projects, sessions, knowledge, activity tables. | todo |
| F21 | P2 | `agentStates.projectId` not a FK | `src/db/schema.ts` | Data/Schema | Add FK reference to `rooms.id` with appropriate cascade. | Agent states cannot reference non-existent workspaces; constraint violations caught at DB level. | todo |
| F22 | P2 | OAuth tokens stored as plaintext filenames | `src/lib/oauth-store.ts` | Auth/OAuth | Hash tokens (SHA-256) before using as storage keys; lookup via hash. | Raw tokens no longer appear in storage paths; bucket compromise does not yield usable tokens. | todo |
| F23 | P2 | No rate limiting on OAuth endpoints | `src/pages/api/oauth/register.ts`, `authorize.ts`, `token.ts` | Platform/Security | Add IP-based rate limiting middleware to all OAuth endpoints. | Brute-force and mass registration attempts are throttled; legitimate flows unaffected. | todo |
| F24 | P2 | Redirect URI disclosure in OAuth errors | `src/pages/api/oauth/authorize.ts` | Auth/OAuth | Return generic error; log allowed URIs server-side only. | Error responses no longer reveal registered redirect URIs. | todo |
| F25 | P2 | ILIKE wildcard injection in KB search | `src/pages/api/mcp.ts` | Control Plane | Escape `%` and `_` in search query before `ilike()` interpolation. | Queries with `%` or `_` are treated as literal characters; search results match expected behavior. | todo |
| F26 | P2 | Unbounded JSONB payload sizes | `src/pages/api/mcp.ts`, `src/lib/agent-activity.ts`, `src/pages/api/knowledge.ts` | Platform/Security | Add payload size limits via zod or byte-length checks on all JSONB/text write paths. | Oversized payloads rejected with `400`; normal payloads accepted. | todo |
| F27 | P2 | HTTP header injection in OAuth challenge | `src/lib/http.ts` | Platform/Security | Escape double-quotes in interpolated `WWW-Authenticate` header values. | Spoofed headers cannot inject arbitrary values into response headers. | todo |

---

## Wave-Level Verification Gates

- **Gate A (after Wave 0)**
  - Manual abuse tests for forged OAuth approval, unauth pull/ack, telemetry spoof attribution, and XSS payloads.
  - No open critical exploit chain remains.

- **Gate B (after Wave 1)**
  - Concurrency tests pass for state and token single-use guarantees.
  - Scope and role-based authz tests enforce expected denials.

- **Gate C (after Wave 2)**
  - Validation/rate-limit/header hardening is active.
  - Operational observability added (security logs, rate-limit events, denied-action telemetry).

---

## Suggested Delivery Cadence

- **Day 0-1**: `F01-F05`
- **Day 2-3**: `F06-F11`
- **Day 4-5**: `F12-F18`
- **Day 6-7**: `F19-F27` (data integrity, token hardening, input sanitization)
- **Day 8+**: consolidated backlog (remaining `audit.md` matrix items not in F01-F27)

---

## Tracking Notes

- Keep this file updated as patches land (set `Status` to `in_progress`/`done`).
- Link each `done` item to PR/commit and test evidence in a follow-up section.
