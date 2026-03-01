# Dashboard Backend Wiring Tasks

## 1. Cross-Cutting Foundation (Do First)
1. Standardize API surface for App Router (`src/app/api/...`) or keep Pages Router (`src/pages/api/...`) consistently.
2. Add typed client fetch layer (`/dashboard` pages currently call nothing).
3. Add auth/session guard for all dashboard routes (redirect if unauthenticated).
4. Define shared response contracts (`Room`, `Agent`, `Task`, `Session`, `Archive`, `Document`, `WorkspaceSettings`).
5. Replace all hardcoded avatar/name/task constants with fetched state.
6. Add loading/empty/error states for every screen (currently mostly static render only).

## 2. Sidebar / Global Navigation
1. `src/components/navigation/GlobalSidebar.tsx`: replace `globalViews/workspaceContext/activeTasks/historyItems` constants with live data.
2. Wire workspace dropdown (workspace info, members, switch workspace).
3. Hook `New Task`, `Search`, `Log out`, `Invite members` actions.
4. Replace `#` placeholder task links with real route targets.

## 3. Route-by-Route Wiring

### Inbox
File: `src/app/dashboard/page.tsx`
1. Replace `INBOX_ITEMS` with notifications/activity feed API.
2. Implement filter tabs (`All/Unread/Mentions/Errors`) server-side or client-side over real data.
3. Hook "mark read" actions.

### Agents Directory
File: `src/app/dashboard/agents/page.tsx`
1. Replace `AGENTS` with live agent presence from room + telemetry.
2. Hook search + tab filtering over real fields (`local/team` source needs backend model).
3. Link each agent card to the correct chat/session.

### Projects
File: `src/app/dashboard/projects/page.tsx`
1. Replace `PROJECTS` mock with project/task models.
2. Implement create project action.
3. Compute progress/status from tasks.
4. Wire task click-through to correct chat/task context.

### Knowledge Base
File: `src/app/dashboard/knowledge-base/page.tsx`
1. Replace `DOCUMENT_TREE` + static editor content with document APIs.
2. Implement open/select/search/create/history actions.
3. Persist "read indicators" from actual activity.

### State Registry
File: `src/app/dashboard/agent-state/page.tsx`
1. Replace `AGENT_DATA` mock with live state snapshots from agent state table.
2. Agent selector dropdown should load available active agents.
3. Refresh action should actually refetch.
4. Raw JSON / Parsed Tree should render real payload.

### Agent Chat
Files: `src/app/dashboard/agent-chat/page.tsx`, `src/app/dashboard/agent-chat/mock-data.ts`
1. Remove mock streams (`openCodeMockParts/codexMockItems/claudeMockLog`).
2. Fetch live timeline from telemetry/history endpoints per selected agent/session.
3. Wire prompt input/send flow to command/task endpoint (or disable until implemented).
4. Keep renderer mapping by tool type (OpenCode/Codex/Claude).

### Past Sessions
File: `src/app/dashboard/history/page.tsx`
1. Replace `PAST_SESSIONS` with historical sessions API.
2. Implement transcript view + resume session actions.

### Archived Tasks
File: `src/app/dashboard/archives/page.tsx`
1. Replace `ARCHIVED_TASKS` with archive store query.
2. Hook search/filter.

### Settings
File: `src/app/dashboard/settings/page.tsx`
1. Persist general settings (workspace name/url/logo) to backend.
2. Wire tab content to real setting domains (API keys, notifications, billing, etc.).
3. Implement destructive workspace delete flow with confirmation + server action.

## 4. Existing Backend You Can Reuse Immediately
1. `src/pages/api/rooms.ts`
2. `src/pages/api/room-content.ts`
3. `src/pages/api/telemetry-history.ts`
4. `src/lib/shared-workspace.ts`
5. `src/lib/rooms.ts`

## 5. Gaps (Need New Backend Endpoints/Models)
1. Inbox/activity feed model and API.
2. Project/task CRUD and progress aggregation APIs.
3. Knowledge base docs tree/content/versioning APIs.
4. Archived tasks and past session transcript APIs (if not derived from telemetry).
5. Settings persistence APIs (workspace profile, preferences, billing/security stubs).

## 6. Cleanup / QA
1. Clean encoding artifacts like `·` in copied UI text.
2. Add per-route skeleton/loading states before live fetches to avoid layout jumps.
3. Decide canonical backend route style (`/api/*` in App Router vs Pages Router) before building new endpoints.

## Suggested Execution Order
1. Wire `GlobalSidebar + Inbox + Agents` using existing `rooms/room-content/telemetry-history`.
2. Build new `projects` + `sessions/archives` APIs.
3. Finish `knowledge-base` + `settings`.
