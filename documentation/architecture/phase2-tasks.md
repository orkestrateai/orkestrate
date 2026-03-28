# Phase 2 Tasks (Deferred + Active)

## Current Decision
- Keep plugin auth relaxed for now to maximize MVP iteration speed.
- Do not block ingest/pull on shared secret or token during this phase.

## High-Priority Deferred Task: Plugin Token Auth
Reason: prevent spoofed agent activity while avoiding static secrets in user files.

### Architecture to implement
1. `join_workspace` mints short-lived `pluginToken` scoped to:
   - `userId`
   - `agentId`
   - `workspaceId`
   - `exp`
2. OpenCode plugin stores token in memory and sends:
   - `Authorization: Bearer <pluginToken>`
   to:
   - `/api/telemetry/ingest`
   - `/api/agent-control/pull`
3. Add MCP tool: `refresh_plugin_token`
4. Enforce token validation in endpoints above.
5. Remove static secret fallback (`Orkestrate_SECRET` + `ORKESTRATE_PLUGIN_SIGNING_SECRET`) after migration.

### Acceptance criteria
- Unauthenticated ingest request is rejected.
- Token for agent A cannot post as agent B.
- Expired token is rejected.
- Plugin can refresh token without re-authenticating MCP.

## Active Remaining Phase 2 Items
1. Claude activity publishing path (OpenCode-first currently done).
2. Rename `telemetry` endpoint labels/paths to `session-activity` for naming consistency. 
3. Add lightweight automated smoke tests for:
   - join_workspace
   - agent session creation
   - dashboard rendering of active/disconnected agents
