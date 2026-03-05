# Auth + Rooms Architecture (V2 Foundation)

## Scope
This first redesign slice only covers:
- user authentication at API boundary
- room lifecycle and membership invariants
- active-room preference resolution

Telemetry, sessions, plugins, and agent runtime orchestration stay unchanged in this phase.

## Goals
- One canonical room domain service used by all room APIs.
- One reusable bearer-token auth resolver for API routes.
- Preserve existing `/api/workspaces` and `/api/rooms` behavior while removing internal duplication.
- Harden room data model with role constraint and critical indexes.

## Data Model

### `members`
- `user_id` (`auth.users.id`, pk)
- `active_room_id` (nullable, must match a membership pair of `room_id + user_id`)
- `created_at`, `updated_at`

### `rooms`
- `id` (text, pk)
- `name` (text, required)
- `owner_user_id` (`auth.users.id`, required)
- `created_at`, `updated_at`

### `room_memberships`
- `room_id` (`rooms.id`, required)
- `user_id` (`auth.users.id`, required)
- `role` (`owner | admin | member`)
- `created_at`
- unique `(room_id, user_id)`

## Invariants
- A room is visible only if user has membership.
- Room rename requires `owner` or `admin`.
- Owner cannot delete a room while other members still exist.
- If current active room is removed/left, `members.active_room_id` is reassigned to a fallback; if none exists, a new room is created.
- Every API request must resolve user identity from bearer token before room operations.

## API Boundary
- Auth helper: `src/lib/auth-user.ts`
  - `authenticateBearerToken(...)`
  - `authenticateApiRequest(req)`
- Room domain service: `src/lib/rooms-core.ts`
- Compatibility adapter: `src/lib/workspaces.ts`
  - Keeps current workspace-named functions intact for existing UI/pages.

## Progressive Rollout Plan
1. Phase 1 (this change): Auth + Rooms foundation.
2. Phase 2: Agent identity model (`member -> agents`) with strict ownership rules.
3. Phase 3: Session model (`agent -> sessions`) and lifecycle state machine.
4. Phase 4: Telemetry ingest contract + dashboard read models rebuilt on top of phase 2/3 primitives.

## Why This Is Safe
- Existing frontend endpoints remain unchanged (`/api/workspaces`, `/api/rooms`).
- Existing telemetry/session code paths are not touched.
- DB changes are additive and idempotent (indexes + check constraint).
