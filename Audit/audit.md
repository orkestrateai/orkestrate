# Security and Logic Audit (Consolidated)

Date: 2026-03-03
Project: `Agentalk` / `Orkestrate`
Primary Focus (this pass): agent connections, session handling, telemetry trust boundaries
Method: direct source verification + parallel explore/librarian sweeps + Oracle consultation attempt

---

## Executive Summary

This pass confirms critical weaknesses in control-plane authentication, telemetry identity attribution, and OAuth approval binding. The most dangerous attack chain remains: unauthenticated telemetry ingest -> stored event poisoning -> unsanitized markdown render (XSS), plus unauthenticated command pull/ack that allows command interception and state tampering.

---

## Verified Findings (Prioritized)

## P0 - Critical

### 1) OAuth consent/code issuance trusts client-supplied `user_id`

- Evidence:
  - `src/pages/api/oauth/authorize.ts:78` reads `user_id` from query.
  - `src/pages/api/oauth/authorize.ts:94` issues auth code for that user.
  - `src/app/oauth/authorize/page.tsx:61` submits approval via GET.
  - `src/app/oauth/authorize/page.tsx:70` includes hidden `user_id` field.
- Impact: forged approval request can mint authorization code for victim identity.
- Fix: derive user from server-authenticated session only; switch to POST + CSRF token.

### 2) Unauthenticated command pull endpoint

- Evidence:
  - `src/app/api/agent-control/pull/route.ts:10` no auth check.
  - `src/app/api/agent-control/pull/route.ts:41` dequeues commands directly.
- Impact: attacker can steal/drain commands with guessed IDs (`roomId`, `clientId`, `agent`).
- Fix: require bearer auth + workspace membership + scoped-agent authorization.

### 3) Unauthenticated command ack endpoint

- Evidence:
  - `src/app/api/agent-control/ack/route.ts:7` no auth check.
  - `src/app/api/agent-control/ack/route.ts:27` updates command status from caller input.
- Impact: unauthorized status tampering (`dispatched`/`failed`) and audit corruption.
- Fix: same authz model as `send/status`, plus idempotent ack keying.

### 4) Stored XSS sink in chat renderer

- Evidence:
  - `src/components/dashboard/ChatRenderer.tsx:94` uses `marked.parse(msg.text)` inside `dangerouslySetInnerHTML` without sanitization.
- Impact: attacker-controlled markdown/HTML executes in dashboard origin.
- Fix: sanitize with `DOMPurify`/`isomorphic-dompurify`; add CSP as defense in depth.

### 5) Telemetry ingest allows unauthenticated identity attribution fallback

- Evidence:
  - `src/app/api/telemetry/ingest/route.ts:145` auth is optional.
  - `src/app/api/telemetry/ingest/route.ts:156` fallback infers user via `clientId`/state heuristics.
  - `src/app/api/telemetry/ingest/route.ts:189` fallback to single-member room inference.
- Impact: spoofed telemetry attribution, event poisoning, and forged activity/session linkage.
- Fix: require auth for attributable telemetry; remove user inference fallback.

## P1 - High

### 6) Telemetry ingest does not verify room membership for attributed writes

- Evidence:
  - `src/app/api/telemetry/ingest/route.ts:372` accepts caller-provided `roomId`.
  - `src/app/api/telemetry/ingest/route.ts:467` writes telemetry without membership gate.
- Impact: cross-workspace telemetry pollution for arbitrary room IDs.
- Fix: enforce `canAccessWorkspace`/membership before insert and activity recording.

### 7) OAuth scopes advertised but not enforced in MCP actions

- Evidence:
  - `src/pages/api/oauth/authorization-server.ts:19` advertises `mcp:read`, `mcp:write`.
  - `src/pages/api/mcp.ts:291` validates token only; no per-action scope checks.
- Impact: read-only token may still perform write operations.
- Fix: add explicit action-to-scope matrix before `tools/call` handling.

### 8) Optimistic locking TOCTOU in shared state writes

- Evidence:
  - `src/lib/shared-workspace.ts:205` reads team hash.
  - `src/lib/shared-workspace.ts:219` writes in separate statement.
- Impact: concurrent writes can both pass expected hash check.
- Fix: atomic compare-and-swap (single SQL op/transaction).

### 9) OAuth code/refresh consume-then-delete is non-atomic

- Evidence:
  - `src/lib/oauth-store.ts:92` read then `src/lib/oauth-store.ts:95` delete for auth code.
  - `src/lib/oauth-store.ts:148` read then `src/lib/oauth-store.ts:160` delete for refresh token.
- Impact: token/code replay windows under concurrency.
- Fix: move to DB/Redis atomic consume (`DELETE ... RETURNING` / `GETDEL`).

### 10) Refresh token flow allows missing `client_id`

- Evidence:
  - `src/pages/api/oauth/token.ts:94` reads optional `client_id`.
  - `src/pages/api/oauth/token.ts:100` passes `clientId || ""`.
  - `src/lib/oauth-store.ts:156` only enforces client match when request value is truthy.
- Impact: stolen refresh token can rotate without proving client binding.
- Fix: require `client_id` and enforce exact match always.

### 11) Workspace rename/delete allowed for any member

- Evidence:
  - `src/lib/workspaces.ts:166` rename checks membership, not owner role.
  - `src/lib/workspaces.ts:192` delete checks membership, not owner role.
- Impact: non-owner members can mutate/delete workspace unexpectedly.
- Fix: enforce role-based authorization (`owner` only for destructive ops).

## P2 - Medium

### 12) `stateHash` uses `Math.random()`

- Evidence:
  - `src/lib/shared-workspace.ts:214`, `src/lib/shared-workspace.ts:228`.
- Impact: weak unpredictability; easier collision/prediction than cryptographic hash.
- Fix: `crypto.randomUUID()` or content-derived SHA-256.

### 13) Tasks API fetches broad result then filters in memory

- Evidence:
  - `src/pages/api/tasks.ts:45` queries tasks without project ID filter.
  - `src/pages/api/tasks.ts:54` filters in JS (`projectIds.includes`).
- Impact: avoidable data load / scalability degradation.
- Fix: push project filtering to SQL (`inArray(tasks.projectId, projectIds)`).

### 14) Redirect URI scheme/quality validation is weak at registration

- Evidence:
  - `src/pages/api/oauth/register.ts:13` only checks non-empty array.
- Impact: unsafe/invalid schemes can be registered (policy bypass risk).
- Fix: strict scheme/host/path validation policy at registration time.

### 15) Base URL trusts forwarded headers directly

- Evidence:
  - `src/lib/http.ts:11`, `src/lib/http.ts:12` trust `x-forwarded-*` values.
- Impact: malformed Host/Proto can taint generated URLs/challenges behind misconfigured proxy.
- Fix: canonical URL allowlist/env-based origin for OAuth metadata/challenges.

### 16) Knowledge APIs have weak payload validation and limits

- Evidence:
  - `src/pages/api/knowledge.ts:63` accepts body fields directly.
  - `src/pages/api/knowledge.ts:90` updates with unbounded content/title/description.
- Impact: oversized payloads and schema abuse risk.
- Fix: schema validation (zod), size caps, field allowlist.

### 17) No centralized CSP configured

- Evidence:
  - no CSP header setting found in route responses/config.
- Impact: reduced defense-in-depth against XSS.
- Fix: deploy strict CSP with nonce/hash strategy.

### 18) Verbose error detail is returned in many APIs

- Evidence:
  - pattern present in multiple routes, e.g. `detail: error.message`.
- Impact: internal error leakage to clients.
- Fix: return generic public errors; log detailed diagnostics server-side only.

### 19) Knowledge folder delete does not cascade to children

- Evidence:
  - `src/pages/api/mcp.ts:801-827` deletes folder row via `DELETE ... WHERE id = args.id`.
  - No recursive delete or re-parenting of child docs with `parentId` referencing the deleted folder.
  - `src/db/schema.ts:142` defines `parentId` as a self-reference with no `ON DELETE CASCADE`.
- Impact: orphaned knowledge documents become inaccessible through folder hierarchy but remain in DB and are still returned by flat/search queries, causing data integrity issues and user confusion.
- Fix: implement recursive delete (or re-parent children to root) before deleting folder; add `ON DELETE CASCADE` or `ON DELETE SET NULL` to the `parentId` FK.

### 20) Missing DB cascade deletes for workspace foreign keys

- Evidence:
  - `src/db/schema.ts` — `rooms` table is referenced by `roomMemberships`, `projects`, `agentSessions`, `workspaceCodebases`, `knowledgeDocs`, `agentActivity`. No FK specifies `ON DELETE CASCADE`.
  - `src/lib/workspaces.ts:195-202` — `deleteWorkspaceForUser` only deletes `roomMemberships` before deleting the room, leaving orphaned rows in all other tables.
- Impact: orphaned records accumulate over time; queries against deleted workspaces may return stale or confusing data.
- Fix: add `ON DELETE CASCADE` to all FKs referencing `rooms.id`; or implement application-level cascade in `deleteWorkspaceForUser`.

### 21) `agentStates.projectId` lacks foreign key constraint

- Evidence:
  - `src/db/schema.ts:11` — `projectId: text('project_id').default('default').notNull()` is a plain text field, not a FK to `rooms.id`.
- Impact: agent states can reference non-existent workspaces; no referential integrity enforcement.
- Fix: add FK reference to `rooms.id` with appropriate cascade behavior.

### 22) OAuth tokens stored as plaintext filenames in Supabase Storage

- Evidence:
  - `src/lib/oauth-store.ts:44-46` — `accessFile(accessToken)` uses the raw token as the filename.
  - Token lookup in `validateAccessToken` (line 136) reads the file by raw token path.
- Impact: if Supabase storage bucket is compromised, all tokens are immediately usable. No hashing layer.
- Fix: hash tokens (SHA-256) before using as storage keys; store the hash mapping.

### 23) No rate limiting on OAuth endpoints

- Evidence:
  - `src/pages/api/oauth/register.ts`, `authorize.ts`, `token.ts` — no rate limit middleware or checks.
- Impact: brute-force auth code guessing, mass client registration, storage exhaustion.
- Fix: add rate limiting (IP-based or token-bucket) on all OAuth endpoints.

### 24) Redirect URI disclosure in OAuth error messages

- Evidence:
  - `src/pages/api/oauth/authorize.ts:75` — error message includes full list of registered redirect URIs.
- Impact: attacker can enumerate valid redirect URIs for any client.
- Fix: return generic error without disclosing allowed URIs; log details server-side.

### 25) ILIKE wildcard characters not escaped in knowledge base search

- Evidence:
  - `src/pages/api/mcp.ts:661-664` — `%${query}%` interpolated into `ilike()` without escaping `%` and `_`.
- Impact: query broadening/data probing via crafted wildcard patterns.
- Fix: escape `%` → `\%` and `_` → `\_` in query before interpolation.

### 26) Unbounded JSONB payload sizes on write endpoints

- Evidence:
  - `src/pages/api/mcp.ts:505-516` — `stateContent` accepts arbitrarily large objects.
  - `src/lib/agent-activity.ts:53-64` — `payload` and `repo` JSONB fields have no size validation.
  - `src/pages/api/knowledge.ts:70-77` — `content` is unbounded text.
- Impact: storage exhaustion, degraded query performance.
- Fix: add payload size limits (zod validation or explicit byte-length checks).

### 27) HTTP header injection in OAuth challenge helper

- Evidence:
  - `src/lib/http.ts:26` — `description` and `resourceMeta` interpolated into `WWW-Authenticate` header without escaping quotes.
- Impact: HTTP response header manipulation via spoofed `x-forwarded-host`.
- Fix: escape double-quote characters in interpolated header values.

---

## Consolidation of External Findings (Verification Status)

Status legend: `CONFIRMED`, `PARTIAL`, `REJECTED`.

1. OAuth `user_id` takeover: `CONFIRMED`
2. Unauth `pull/ack`: `CONFIRMED`
3. Stored XSS in `ChatRenderer`: `CONFIRMED`
4. Unauth telemetry + impersonation fallback: `CONFIRMED`
5. `void userId` in shared-state readers: `PARTIAL` (code smell; exploitable cross-tenant path not directly proven in current call graph)
6. stateHash TOCTOU: `CONFIRMED`
7. OAuth storage TOCTOU: `CONFIRMED`
8. `agentId` spoofing in MCP args: `PARTIAL` (integrity issue inside same OAuth client boundary)
9. `Math.random()` stateHash: `CONFIRMED`
10. Tasks in-memory filtering: `CONFIRMED`
11. Scopes not enforced: `CONFIRMED`
12. Auth callback open redirect: `REJECTED` (current code prefixes with trusted `origin`; not a direct external redirect sink)
13. No OAuth endpoint rate limiting: `CONFIRMED`
14. Ping rate-limit race: `CONFIRMED`
15. ILIKE wildcard behavior in KB search: `PARTIAL` (query broadening/abuse, not SQL injection)
16. Optional `client_id` in refresh: `CONFIRMED`
17. Knowledge mass-assignment/validation gaps: `CONFIRMED`
18. Host header injection risk in `baseUrl`: `CONFIRMED`
19. Missing cascade delete constraints: `CONFIRMED`
20. `agentStates.projectId` not FK: `CONFIRMED`
21. Header injection in OAuth challenge helper: `PARTIAL` (helper unsafe; current caller input mostly controlled)
22. Workspace rename/delete not owner-restricted: `CONFIRMED`
23. Missing CSP: `CONFIRMED`
24. Missing centralized middleware guard: `CONFIRMED`
25. Verbose internal errors: `CONFIRMED`
26. OAuth tokens stored plaintext-addressable in storage: `CONFIRMED`
27. Service role key for OAuth ops: `CONFIRMED` (architectural risk)
28. `DATABASE_URL!` startup assertion: `CONFIRMED`
29. Redirect URI disclosure in OAuth errors: `CONFIRMED`
30. Redirect URI scheme validation weak: `CONFIRMED`
31. Workspace ID entropy (12 hex): `CONFIRMED`
32. Collision checks advisory-only: `CONFIRMED`
33. Knowledge folder delete orphan risk: `CONFIRMED`
34. `node-pty` dependency appears unused in app code: `CONFIRMED`

---

## Focused Improvements (Agent Connections, Sessions, Telemetry)

1. Introduce agent-facing auth for `pull/ack` (JWT claim for `scopedAgentId` or mTLS/signed requests).
2. Add DB-level policies/constraints for command ownership transitions (`queued -> pulled -> dispatched/failed`) with idempotent ack keys.
3. Split telemetry ingestion into:
   - authenticated, user-attributed channel
   - anonymous, non-authoritative channel (separate storage/index)
4. Enforce membership check before telemetry/session/activity writes.
5. Add anti-replay controls for telemetry/command APIs (timestamp window + nonce/jti cache).
6. Add centralized security middleware and consistent error redaction policy.
7. Add structured validation layer (zod) and payload size limits on write endpoints.

---

## Suggested Fix Order

1. Lock down `pull/ack` with authn/authz and ownership checks.
2. Remove telemetry user inference fallback; require auth for attributed telemetry.
3. Patch OAuth approval flow (`user_id` trust + GET approval + CSRF).
4. Sanitize markdown rendering and deploy CSP.
5. Enforce OAuth scope checks in MCP tools.
6. Fix atomicity issues (state hash CAS and token consumption).
7. Tighten validation/rate limits and workspace role authorization.

---

## Notes

- Oracle was invoked for focused validation, but Oracle session output in this environment returned empty/timeout content; final determinations are based on direct source verification and completed explore/librarian results.
