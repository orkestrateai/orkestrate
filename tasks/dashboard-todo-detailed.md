# Dashboard Detailed TODO List

## Scope
- App routes under `src/app/dashboard/**`
- Supporting dashboard UI/components under `src/components/**`
- Dashboard-facing APIs/libs (`workspaces`, `room-content`, `telemetry-history`, `agent-control`, telemetry ingest, identity helpers)

## Progress Update (2026-02-28)
- Command lifecycle and ack are now implemented end-to-end for OpenCode prompt dispatch.
- Agent chat now shows live command status (`queued`/`pulled`/`dispatched`/`failed`/`expired`) for the selected agent.
- Tool cards in agent chat now merge `before`/`after` events by `callID` for coherent rendering.
- Build in this environment is blocked by Google Fonts fetch, but type-check is passing.
- **(2026-02-28)**: Wired Inbox, Global Sidebar, Projects, and Archives pages with real data APIs. Standardized on `workspaceId`.

---

## New Follow-Ups (2026-03-01)

## 0) Empty-Folder Repo Bootstrap (Claude + OpenCode)
- [ ] Add opt-in local bootstrap for brand-new folders with no `.git`.
  - Add config flags:
  - `Orkestrate_AUTO_INIT_REPO=true|false`
  - `Orkestrate_REPO_REMOTE=<remote-url>`
  - `Orkestrate_REPO_BRANCH=<branch>`
- [ ] On session start/plugin init, if no repo and auto-init is enabled:
  - run `git init` (or `git init -b <branch>` where supported),
  - create/set branch,
  - add `origin` remote if provided,
  - fetch/track remote branch when available.
- [ ] Emit `repo_init_observed` telemetry event and immediately publish updated repo snapshot/state.
- [ ] Keep MCP tool surface unchanged (no extra bootstrap MCP tools).

Acceptance:
- Starting Claude/OpenCode in an empty folder can self-bootstrap into a Git repo when enabled.
- Workspace codebase binding works immediately after bootstrap.

## 0.1) Codex Compatibility Parity
- [ ] Wire Codex-side orchestration compatibility (same state contract + activity ingestion expectations).
- [ ] Ensure Codex identity/scoping matches `scoped_agent_id` conventions used by Claude/OpenCode.
- [ ] Ensure Codex events (file edit, commit, lifecycle) normalize to the same backend event schema.
- [ ] Add setup/docs parity so Codex can be validated with the same smoke script.

Acceptance:
- Claude/OpenCode/Codex all participate in the same workspace with consistent state/activity behavior.

## P0 - Must Fix First (Core Functionality + Reliability)

## 1) Command Delivery Reliability (Web -> Plugin)
- [x] Keep command queue DB-backed and remove all memory-only assumptions.
  - Files:
  - `src/lib/agent-control.ts`
  - `src/app/api/agent-control/send/route.ts`
  - `src/app/api/agent-control/pull/route.ts`
- [x] Add command lifecycle states (`queued`, `pulled`, `dispatched`, `failed`, `expired`) so delivery can be audited instead of fire-and-forget.
- [x] Add ack endpoint from plugin after dispatch result.
- [x] Add TTL cleanup job/path for stale commands.
- [x] Add dashboard-visible status for last N commands per agent.

Acceptance:
- Sending from dashboard always creates a persisted command row.
- Pull returns and consumes expected commands for exact scoped agent.
- Dispatched vs failed is visible in UI and persisted.

## 2) Canonical ID Consistency
- [x] Enforce one canonical `scoped_agent_id` format everywhere: `<client_base_id>::<agent_id>`.
  - File: `src/lib/agent-identity.ts`
- [x] Eliminate mixed naming in API contracts (`room` vs `workspace`) at dashboard boundaries.
  - Keep compatibility in backend internals where needed, but dashboard contracts should be `workspaceId`.
  - Files:
  - `src/pages/api/workspaces.ts`
  - `src/pages/api/room-content.ts`
  - `src/pages/api/telemetry-history.ts`

Acceptance:
- [x] No dashboard code has to branch on `rooms` vs `workspaces`.
- [x] Same agent/session resolves to same IDs across pages and APIs.

## 3) Agent Chat Stability
- [x] Keep agent chat non-blocking under SWR polling (no loader flicker on refresh).
  - File: `src/app/dashboard/agent-chat/page.tsx`
- [x] Ensure selected session defaults to latest when sessions load.
- [x] Ensure send errors are handled via local state only (no accidental function calls on SWR error objects).
- [x] Ensure prompt input is disabled only when expected (`offline/disconnected`), with clear reason text.

Acceptance:
- Page never crashes on send attempts.
- [x] Latest session auto-opens.
- Prompt input states are predictable.

## 4) Telemetry Presence Correctness
- [ ] Keep `disconnected` logic consistent with heartbeat recency and lifecycle ordering.
  - File: `src/pages/api/room-content.ts`
- [ ] Prevent stale disconnect events from overriding newer heartbeats.
- [ ] Ensure absent disconnect still degrades to `idle/offline` by timeout.

Acceptance:
- Kill session -> status degrades correctly.
- Reconnect same agent -> status recovers to online.

---

## P1 - Route-by-Route Wiring (Remove Mocks, Make Features Real)

## 5) Inbox (`/dashboard`)
- [x] Replace `INBOX_ITEMS` mock with real backend feed.
  - File: `src/app/dashboard/page.tsx`
- [x] Make filter chips (`All/Unread/Mentions/Errors`) actually filter data.
- [ ] Wire `Mark all as read` and filter options.
- [x] Onboarding should depend on real signals (`agent connected`, `session activity`) with visible errors/retries on fetch failure.

Acceptance:
- Inbox content reflects workspace data, not hardcoded examples.
- Filter chips change visible items.

## 6) Agents (`/dashboard/agents`)
- [ ] React to active workspace changes immediately (not only first mount).
  - File: `src/app/dashboard/agents/page.tsx`
- [ ] Replace placeholder metrics (`memoryUsage: "--"`) with real values or remove metric until supported.
- [ ] Add pagination/virtualization for large agent lists.

Acceptance:
- Switching workspace updates agents list without manual refresh.

## 7) Agent Chat (`/dashboard/agent-chat`)
- [ ] Keep session-first UX:
  - left: sessions list
  - main: renderer output
  - optional right debug/telemetry pane toggle
- [ ] Keep OpenCode renderer as primary for OpenCode sessions.
- [ ] Add renderer parity plan for Claude/Codex sessions.
- [x] Remove dead mock dependencies once live path is stable.

Acceptance:
- [x] Session click always opens corresponding transcript.
- [x] OpenCode sessions render coherent chat, not raw JSON blobs.

## 8) Projects (`/dashboard/projects`)
- [x] Replace `PROJECTS` static array with real projects API.
  - File: `src/app/dashboard/projects/page.tsx`
- [x] Wire `New Project` button.
- [x] Wire search input.
- [ ] Task links must include context (project/task/session) instead of generic agent chat link.

Acceptance:
- Create/search/list projects works with backend data.

## 9) Knowledge Base (`/dashboard/knowledge-base`)
- [ ] Replace static tree/content with real docs source.
  - File: `src/app/dashboard/knowledge-base/page.tsx`
- [ ] Wire search to content filter.
- [ ] Wire create doc/folder actions.

Acceptance:
- Tree and content are dynamic and persist.

## 10) Agent State (`/dashboard/agent-state`)
- [ ] Replace hardcoded `AGENT_DATA` with live agent state API.
  - File: `src/app/dashboard/agent-state/page.tsx`
- [ ] Implement agent selector dropdown.
- [ ] Render real JSON/state history per selected agent.

Acceptance:
- Any selected agent shows current real state.

## 11) History (`/dashboard/history`)
- [ ] Replace `PAST_SESSIONS` static list with real session history API.
  - File: `src/app/dashboard/history/page.tsx`
- [ ] Wire search and filters.
- [ ] Wire actions (`View Transcript`, `Resume Session`).

Acceptance:
- History is queryable and actionable.

## 12) Archives (`/dashboard/archives`)
- [x] Replace `ARCHIVED_TASKS` static list with backend data.
  - File: `src/app/dashboard/archives/page.tsx`
- [x] Wire search and archive actions (restore/view/export).

Acceptance:
- Archived items are real and restorable.

## 13) Settings (`/dashboard/settings`)
- [ ] Add save handlers + APIs for workspace metadata updates.
  - File: `src/app/dashboard/settings/page.tsx`
- [ ] Implement non-placeholder tabs.
- [ ] Add destructive action confirmation flow for delete.

Acceptance:
- Changes persist and display success/error states.

---

## P1 - Sidebar and Shared UX

## 14) Global Sidebar Real Data
- [x] Replace hardcoded `WORKSPACE`, `NAV_ITEMS`, `activeTasks`.
  - File: `src/components/navigation/GlobalSidebar.tsx`
- [ ] Wire search command/panel.
- [ ] Wire `New Task` to real task creation flow.
- [x] Ensure workspace switch propagates to all routes live.

Acceptance:
- Sidebar reflects actual workspace/projects/tasks.

## 15) Remove/Integrate Orphan Components
- [x] Decide whether to integrate or delete unused dashboard components:
  - `src/components/dashboard/AgentTelemetryPane.tsx`
  - `src/components/dashboard/WorkspaceContentPane.tsx`
- [x] Remove obsolete mock files if no longer needed.

Acceptance:
- No dead dashboard code paths remain.

---

## P2 - Permissions and Multi-User Foundations

## 16) Workspace Roles and Access Control
- [ ] Formalize owner/mod/member permissions in endpoints.
- [ ] Guard admin mutations (role changes, member management, workspace delete).
- [ ] Add workspace members UI and invite/remove/promote/demote flows.

Acceptance:
- Unauthorized actions are blocked with clear API responses.

## 17) Project/Task Data Model
- [ ] Add first-class `projects`, `tasks`, `agent_sessions` tables.
- [ ] Link task <-> session <-> telemetry so timeline is coherent.
- [ ] Add project/task assignment to scoped agent IDs.

Acceptance:
- A task can show all related sessions/messages/events.

---

## P2 - Observability and Debuggability

## 18) Structured Operational Logging
- [ ] Add structured logs for:
  - command send accepted
  - pull delivered
  - plugin dispatched/failed
  - telemetry ingest failures
- [ ] Add dashboard/system diagnostics view (last N command failures + reasons).

Acceptance:
- “Message queued but not delivered” is diagnosable in < 1 minute.

## 19) API Error Surfaces
- [ ] Stop silent catches in dashboard pages; show bounded non-blocking error UI.
- [ ] Add retry controls where polling fails.

Acceptance:
- Users can see and recover from transient failures.

---

## P3 - Performance and UX Polish

## 20) Performance
- [ ] Add list virtualization where needed (agents/history/archives).
- [ ] Cap telemetry window and add incremental load.
- [ ] Optimize polling cadence by page visibility/focus.

## 21) UX Consistency
- [ ] Normalize loading/empty/error states across all dashboard routes.
- [ ] Ensure typography, spacing, and interaction states follow Orkestrate style language.
- [ ] Replace placeholder copy/metrics with real values or hide until available.

---

## Suggested Execution Order
1. P0 command reliability + ID consistency.
2. Agent chat stabilization.
3. Route wiring: Inbox -> Agents -> Projects -> History -> Settings.
4. Role-based access + projects/tasks/sessions schema.
5. Observability + performance polish.
