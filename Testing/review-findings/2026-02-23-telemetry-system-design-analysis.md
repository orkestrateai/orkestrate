# Telemetry System Design Analysis (Main Branch)

Date: 2026-02-23

## Scope
- One-way telemetry reliability and persistence
- Room-scoped dashboard consistency after refresh
- Failure modes under transport and file-tailing edge cases

## Current Pipeline
1. Agent runtime writes local logs (`codex` JSONL, `claude` JSONL, `opencode` SQLite).
2. `public/telemetry.js` tails source data and sends events to `/api/telemetry/ingest`.
3. Ingest route writes to `agent_telemetry` and broadcasts to `telemetry:live`.
4. Dashboard consumes both:
   - Realtime broadcast stream for low latency.
   - `/api/telemetry-history` for persistence replay.

## High-Risk Failure Modes Found
1. Room selection leak/fallback bug in history API
- `roomId` query param was accepted even when room switch failed, allowing wrong-room history reads.

2. Dashboard race + stale state on room switches
- In-flight history responses could overwrite newer room state.
- Agent details/log pane could remain focused on prior room.

3. Agent online/offline misclassification
- Historical agents could appear online indefinitely after refresh.

4. Telemetry script process collision
- PID file was keyed only by `agentType`; concurrent sessions could kill each other.

5. Telemetry transport burst pressure
- Script fired a request per log line without queue controls, causing drops/noise under high throughput.

6. Tail source rollover gap
- Script tailed only the startup-selected newest file and did not switch when a newer session file appeared.

## Changes Implemented

### API hardening
- `src/pages/api/telemetry-history.ts`
  - Room ID is now validated via `setActiveRoomForUser`; invalid room requests fall back to the actual active room.
  - Message serialization now handles non-string payloads safely.

- `src/app/api/telemetry/ingest/route.ts`
  - Added payload validation.
  - Added message-size guard/truncation for oversized events.
  - Improved event type derivation (`event`, `type`, nested message type fallback).
  - Unified timestamp use for DB + broadcast.
  - DB insert + broadcast run as best-effort tasks with explicit rejection logging.

### Dashboard state reliability
- `src/app/dashboard/page.tsx`
  - Added bounded dedupe merge for telemetry logs.
  - Added stale history response guard (`requestId` ref) to prevent out-of-order overwrite.
  - Clears room-specific telemetry/selection state on room switch/delete.
  - Reverts optimistic room switch on API failure.
  - Auto-creates a room once if room list is unexpectedly empty.
  - Online/offline status now falls back to event timestamps when heartbeat map is empty.
  - DB fallback agents now become offline when `lastPingAt` is stale.
  - Auto-deselects missing selected agent.

### Telemetry script robustness
- `public/telemetry.js`
  - Added host endpoint normalization.
  - PID file now scoped by `(agent, client, room, host)` hash.
  - Added bounded async send queue with concurrency control and drop reporting.
  - Added transport error throttling.
  - Added file-tail rollover support: periodic rescans attach to newer session files.
  - Preserved graceful disconnect behavior.

- `public/agentalk.js`
  - Kept in one-way mode on `main` by mirroring telemetry script behavior.

## Remaining Known Constraints (Not Yet Solved)
1. No user_id column in `agent_telemetry`
- Room scoping is payload-based. Cross-user isolation relies on room IDs and membership flow, not row-level ownership on telemetry rows.

2. No explicit DB indexing migration for telemetry filters
- History queries use JSONB expression filtering (`payload->>'roomId'`) and `created_at`; indexes should be added for high-volume scale.

3. Best-effort ingest semantics
- Failures are logged; there is no durable retry queue on server-side ingest.

## Recommended Next Hardening Steps
1. Add DB indexes:
- `created_at DESC`
- expression composite: `(payload->>'roomId', created_at DESC)`

2. Add `user_id` or `workspace_id` columns on `agent_telemetry` and enforce RLS/policy-safe filtering.

3. Add ingest metrics endpoint (drop rate, queue depth, broadcast failure count).

4. Add end-to-end smoke tests:
- refresh persistence
- room switch isolation
- stale agent transitions
- tail rollover into new log files
