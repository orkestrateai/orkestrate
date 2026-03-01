# Orkestrate Backend Contract (Workspace, Project, Task, Session)

## Purpose
Define the canonical backend model before adding more UI behavior.

This contract covers:
1. Core entities and relationships.
2. Canonical ID rules and invariants.
3. Access roles (owner/mod/member).
4. Session-centric API surface for dashboard and plugin communication.

---

## Current Snapshot (As-Is)
Existing tables already in use:
- `rooms` (workspace container)
- `room_memberships` (workspace membership + role)
- `user_room_preferences` (active workspace)
- `agent_states` (latest per-agent state in workspace)
- `agent_telemetry` (event stream)
- `agent_commands` (web -> plugin command queue)

Current naming mismatch:
- DB uses `room*` in many places.
- Product language should be `workspace`.

Contract decision:
- Keep DB compatibility where needed.
- Treat `room_id` as `workspace_id` in all API/domain contracts going forward.

---

## Canonical IDs (Hard Rules)

## 1) Workspace ID
- Format: `ws_<12-24 lowercase alnum>`
- Example: `ws_4e96c9cd7683`
- Immutable.

## 2) Project ID
- Format: `prj_<12-24 lowercase alnum>`
- Example: `prj_a19f3a4c9910`
- Immutable.

## 3) Task ID
- Format: `tsk_<12-24 lowercase alnum>`
- Example: `tsk_810ff38e2d14`
- Immutable.

## 4) Session ID
- Source of truth: client-generated session ID if available (`ses_*` etc).
- Fallback: server-generated `sess_<uuid-short>` only when client does not provide one.
- Must be stable for the life of a chat session.

## 5) Scoped Agent ID
- Canonical format: `<client_base_id>::<agent_id>`
- Example: `agentalk_KUlQuD0WX5_ZhIQSmMogNw::opencode-8x23`
- Must be produced by shared normalization function everywhere.
- Never hand-build with string concat outside shared helper.

## 6) External Client ID
- Keep raw client id as provided by OpenCode/Claude/Codex.
- Derive `client_base_id` + `scoped_agent_id` through helper.

---

## Domain Model (Target)

## Workspace
- Owner/mod/member ACL container.
- Contains projects, tasks, sessions, telemetry.

## Project
- A planning/execution grouping inside a workspace.
- Contains tasks and linked agent sessions.

## Task
- Unit of intent/outcome.
- Linked to project.
- Can be linked to one or many sessions over time.

## Agent Session
- A concrete execution conversation for one agent.
- Linked to workspace + optional project + optional task.
- Holds session status, started/ended timestamps.

## Chat Message
- Logical message stream for a session.
- Can be derived from telemetry initially, later persisted first-class.

## Telemetry Event
- Operational event stream (tool calls, parts, status, lifecycle).
- Must always include `workspace_id`, `scoped_agent_id`, and best-effort `session_id`.

---

## Role Model (Workspace ACL)

Roles:
- `owner`
- `mod`
- `member`

Permissions matrix:
- Owner:
  - Manage workspace settings
  - Invite/remove users
  - Promote/demote roles
  - Delete workspace
- Mod:
  - Invite/remove members (not owner)
  - Create/update projects/tasks
  - Manage task assignment/session links
- Member:
  - Read workspace/project/task/session data
  - Create and update tasks they own/are assigned
  - Send prompts to online agents (subject to workspace policy)

Minimum enforcement:
- Every write endpoint checks membership.
- Role-guard admin actions (`owner`/`mod`).

---

## Data Contract (New Tables to Add)

## 1) `projects`
Fields:
- `id` text pk
- `workspace_id` text not null
- `name` text not null
- `description` text nullable
- `status` text not null default `active`
- `created_by` uuid not null
- `created_at`, `updated_at`

Indexes:
- `(workspace_id, updated_at desc)`

## 2) `tasks`
Fields:
- `id` text pk
- `workspace_id` text not null
- `project_id` text not null
- `title` text not null
- `description` text nullable
- `status` text not null (`todo|in_progress|blocked|done|archived`)
- `priority` text nullable (`low|med|high|urgent`)
- `assigned_scoped_agent_id` text nullable
- `created_by` uuid not null
- `created_at`, `updated_at`, `completed_at` nullable

Indexes:
- `(workspace_id, project_id, status)`
- `(workspace_id, assigned_scoped_agent_id, updated_at desc)`

## 3) `agent_sessions`
Fields:
- `id` text pk (client session id when available)
- `workspace_id` text not null
- `project_id` text nullable
- `task_id` text nullable
- `scoped_agent_id` text not null
- `client_base_id` text not null
- `status` text not null (`online|idle|offline|disconnected|error`)
- `started_at` timestamp not null
- `last_event_at` timestamp not null
- `ended_at` timestamp nullable

Indexes:
- `(workspace_id, scoped_agent_id, last_event_at desc)`
- `(workspace_id, project_id, last_event_at desc)`

## 4) `agent_commands` (extend existing)
Current exists; evolve schema to add lifecycle fields:
- `id` uuid pk
- `workspace_id` (currently `room_id`)
- `scoped_agent_id`
- `session_id` nullable
- `text`
- `status` text (`queued|pulled|dispatched|failed|expired`)
- `pulled_at`, `dispatched_at`, `failed_at` nullable
- `failure_reason` nullable
- `created_at`

Important:
- Do not hard-delete on pull once reliability matters.
- Move to ack model when we harden delivery.

---

## API Contract (Session-Centric)

## Workspace
- `GET /api/workspaces`
- `POST /api/workspaces` (actions: create/switch/rename/delete)

## Projects
- `GET /api/projects?workspaceId=...`
- `POST /api/projects` (create)
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id` (role-gated)

## Tasks
- `GET /api/tasks?workspaceId=...&projectId=...`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/assign`

## Agent Sessions
- `GET /api/agents/:scopedAgentId/sessions?workspaceId=...`
- `GET /api/sessions/:sessionId?workspaceId=...`
- `GET /api/sessions/:sessionId/messages?workspaceId=...`
- `GET /api/sessions/:sessionId/telemetry?workspaceId=...`

## Prompt Dispatch
- `POST /api/sessions/:sessionId/prompt`
  - Body: `{ text: string }`
  - Server writes command queue entry for that `session_id` + `scoped_agent_id`.

Short-term compatibility:
- Keep `POST /api/agent-control/send` + `GET /api/agent-control/pull`.
- Treat as transport-level API under the new session API.

---

## Event Invariants
Every telemetry event should contain:
- `workspace_id` (aka current `room_id`)
- `client_id`
- `agent` (raw)
- derived `scoped_agent_id`
- `session_id` when available
- `event_type`
- `created_at`

If `session_id` is missing, backend may infer temporary grouping, but must not overwrite existing explicit `session_id` records.

---

## Next Implementation Steps

## Step A: Canonical ID and naming hardening
- Add typed helpers for `workspace_id`, `project_id`, `task_id`, `session_id`.
- Ensure all API boundaries pass `workspaceId` (not mixed `roomId` naming in UI contract).

## Step B: Add `projects`, `tasks`, `agent_sessions` tables
- Create schema + indexes.
- Add read APIs first.

## Step C: Session-based chat APIs
- Move chat page to `GET /api/agents/:id/sessions` + `GET /api/sessions/:id/messages`.
- Keep telemetry fallback while messages are still derived.

## Step D: Command delivery hardening
- Extend `agent_commands` with statuses and ack endpoint.
- Plugin flow:
  - pull queued commands
  - dispatch to TUI
  - ack dispatched/failed

---

## Non-Goals (for this phase)
- Final UI polish.
- Full historical backfill for legacy telemetry.
- Multi-client renderer parity (we prioritize OpenCode + Claude first).
