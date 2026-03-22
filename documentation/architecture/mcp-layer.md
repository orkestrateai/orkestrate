
# MCP Layer

## Overview

The MCP (Model Context Protocol) layer is the core coordination engine of Orkestrate. It exposes a standardized JSON-RPC 2.0 interface over HTTP that allows AI agents to join workspaces, claim file scopes, broadcast state, and coordinate their activities without collisions.

## Architecture

### Endpoint

```
POST /api/mcp
Authorization: Bearer <oauth_token>
Content-Type: application/json
```

### Protocol Version

- **Version**: 2025-06-18
- **Transport**: HTTP with JSON-RPC 2.0
- **Authentication**: OAuth 2.0 with PKCE (Proof Key for Code Exchange)

### Capabilities

| Capability | Description |
|------------|-------------|
| `tools` | Agents can call coordination tools |
| `resources` | Server exposes static resources |

### Server Info

```json
{
  "name": "Orkestrate-mcp-vercel",
  "version": "2.0.0-workspace-join"
}
```

## Core Tools

### Workspace Management

#### `join_workspace`
Joins a workspace and verifies repository identity. Must be called before any other coordination tools.

**Arguments:**
```typescript
{
  toolName?: string;           // Human-readable client name
  workspaceId?: string;       // Optional workspace ID (defaults to user's active workspace)
  gitContext: {
    remote: string;            // git remote get-url origin
    repoRoot: string;         // git rev-parse --show-toplevel
    branch: string;           // git rev-parse --abbrev-ref HEAD
    headSha: string;          // git rev-parse HEAD (7-64 hex chars)
    dirty: boolean;           // Has uncommitted changes
    collectedAt: string;      // ISO timestamp when context was captured
  }
}
```

**Response:**
```json
{
  "workspaceId": "ws_xxx",
  "sessionId": "sess_xxx",
  "canonicalAgentId": "opencode-a5f2",
  "scopedAgentId": "user123::opencode-a5f2",
  "family": "opencode",
  "repoVerified": true
}
```

#### `identify_intent`
Classifies the current user request into a coordination workflow.

**Arguments:**
```typescript
{
  userPrompt: string;                              // Task description
  targetAgentId?: string;                          // For delegate/assist
  scopeHints?: string[];                           // Candidate paths
  forceIntent?: "implement" | "assist" | "delegate" | "observe" | "review" | "handoff";
  chain?: IntentId[];                              // Intent queue
}
```

**Supported Intents:**

| Intent | Editable | Description |
|--------|----------|-------------|
| `implement` | Yes | Direct implementation work |
| `assist` | Yes | Help existing workstream |
| `delegate` | No | Assign work to another agent |
| `observe` | No | Status/awareness gathering |
| `review` | No | Code review/QA |
| `handoff` | No | Transfer ownership |

### State Coordination

#### `read_team_state`
Reads authoritative team state with a stateHash for optimistic concurrency control.

**Response:**
```typescript
{
  stateHash: string;              // SHA-1 hash of all agent states + claims
  agents: StoredAgentState[];     // All active agent states
  activeClaims: ActiveScopeClaim[]; // All active file/folder claims
}
```

#### `update_my_state`
Publishes the agent's current objective, plan, footprint, and repo context.

**Arguments:**
```typescript
{
  expectedStateHash: string;       // From read_team_state
  content: {
    agentProfile: string;         // "Frontend specialist"
    currentObjective: string;     // "Implementing auth flow"
    architectureFootprint: string[];  // Paths being modified
    implementationPlan: string[]; // Concrete next steps
    notesForTeam: string;         // Handoff context, warnings
    pastWorkSummary: string[];    // Completed items
    status?: "active" | "idle" | "blocked" | "planning" | "handoff" | "done";
    repo: {
      canonicalRemote: string;
      branch: string;
      headSha: string;
      dirty?: boolean;
      aheadBehind?: string;
    };
  }
}
```

### Scope Claims (Concurrency Control)

#### `claim_scope`
Reserves repository paths with strict overlap rejection.

**Arguments:**
```typescript
{
  expectedStateHash: string;       // For optimistic concurrency
  paths: string[];                 // Repo-relative paths/globs
  ttlSeconds?: number;             // Lease duration (default: 900, max: 3600)
}
```

**Path Rules:**
- Exact paths: `src/auth/login.ts`
- Glob patterns: `src/**/*.ts`
- Directory claims: `src/components/` (covers all contents)

**Overlap Detection:**
```typescript
// Examples of rejected overlaps:
// - `src/auth/` claims rejected when `src/auth/login.ts` is claimed
// - `src/components/` claims rejected when `src/components/Button.ts` is claimed
// - `src/**/*.ts` claims rejected when `src/auth/` is claimed
```

#### `release_scope`
Releases an active claim.

**Arguments:**
```typescript
{
  claimId: string;  // From claim_scope response
}
```

### Communication

#### `send_message`
Sends a message to another agent or broadcasts.

**Arguments:**
```typescript
{
  toAgentId: string;   // Target agent ID or "@everyone"
  message: string;     // Message content
}
```

#### `read_messages`
Reads and marks as read all unread messages addressed to the agent.

### Knowledge Base

#### `read_knowledge_base`
Reads workspace knowledge documents.

**Arguments:**
```typescript
{
  id?: string;              // Direct doc ID
  parentId?: string | null; // Folder traversal (null = root)
  query?: string;          // Search across title/description/content
  includeContent?: boolean;
}
```

#### `write_knowledge_base`
Mutates workspace knowledge documents.

**Arguments:**
```typescript
{
  action: "create" | "update" | "move" | "delete";
  id?: string;              // Required for update/move/delete
  title?: string;
  description?: string;
  content?: string;
  parentId?: string | null;
  isFolder?: boolean;
}
```

## OAuth Scopes

| Scope | Access |
|-------|--------|
| `mcp:read` | Read tools: `identify_intent`, `read_team_state`, `read_knowledge_base` |
| `mcp:write` | Write tools: `join_workspace`, `claim_scope`, `release_scope`, `update_my_state`, `write_knowledge_base` |

## Tool Adapters

The MCP layer uses a pluggable adapter system to generate tool-specific setup prompts for different agent families:

```
src/tools/
├── _base.ts           # Adapter interface
├── opencode/prompt.ts # OpenCode-specific setup
├── claude/prompt.ts   # Claude-specific setup
└── codex/prompt.ts    # Codex-specific setup
```

### AgentContext

```typescript
interface AgentContext {
  agentId: string;        // Canonical agent ID (e.g., "opencode-a5f2")
  clientId: string;       // OAuth client ID
  workspaceId: string;    // Workspace for coordination
  host: string;           // Orkestrate host (e.g., "orkestrate.space")
}
```

### ToolAdapter Interface

```typescript
interface ToolAdapter {
  family: string;
  buildPhase0Prompt(ctx: AgentContext): string;
}
```

## Workflow Lifecycle

### Editable Intent Flow (implement, assist)

```
1. identify_intent → returns intent + nextRequiredTool
2. read_team_state → captures stateHash
3. claim_scope → with expectedStateHash + paths
4. update_my_state → with expectedStateHash + plan/footprint
5. Execute work
6. update_my_state → checkpoint progress
7. release_scope → clean release
```

### Non-Editable Intent Flow (observe, review, delegate)

```
1. identify_intent → returns intent + nextRequiredTool
2. read_team_state → captures stateHash
3. update_my_state → with empty footprint
4. Execute observation/review
5. update_my_state → checkpoint (empty footprint)
```

## Error Handling

### Workflow Errors

When `ok: false` is returned, the response includes:

```typescript
{
  errorCode: string;        // e.g., "WORKFLOW_STEP_VIOLATION"
  recoverySteps: string[];  // Ordered steps to recover
  allowedToolsNow: string[]; // Tools safe to call
}
```

### Concurrency Conflicts

When `stateHash` mismatch occurs:
1. Re-read team state with `read_team_state`
2. Retry with fresh `expectedStateHash`

### Scope Conflicts

When path overlap is detected:
```
ERROR: Scope overlap detected with agent <agentId>
claimed paths: <their paths>
your paths: <your paths>
```

## In-Memory Runtime Store

The MCP layer maintains a per-workspace in-memory store for real-time coordination:

```typescript
interface WorkspaceBucket {
  agentMetadata: Map<string, {
    agentProfile: string;
    pastWorkSummary: string[];
  }>;
  workflowRuns: Map<string, WorkflowRunContext>;
  messages: AgentMessage[];
  readReceipts: Map<string, Set<string>>;
}
```

This store is NOT persisted across serverless cold starts. State is always authoritative in PostgreSQL.

## Reconnection Handling

When an agent reconnects:

1. Server detects existing session via `scopedAgentId`
2. `buildSessionResumedBlock()` reconstructs context from `agentStates` table
3. Agent receives last known state + time since last ping
4. Agent can resume workflow from last phase

```typescript
function buildSessionResumedBlock(state: ReconnectionState): string {
  // Returns formatted markdown with:
  // - Last seen timestamp
  // - Prior objective
  // - Agent profile
  // - Architecture footprint
  // - Past work summary
  // - Notes for team
}
```

## Intent Resolution

The `resolveIntent()` function classifies user prompts using pattern matching:

| Pattern | Intent | Confidence |
|---------|--------|------------|
| `implement\|build\|add\|fix\|refactor` | implement | high |
| `help\|assist\|unblock\|pair` | assist | high |
| `delegate\|assign\|tell.*to` | delegate | medium |
| `what.*doing\|status\|who.*working` | observe | high |
| `review\|audit\|verify\|qa` | review | high |
| `handoff\|transfer\|take over` | handoff | high |

## Security

### Optimistic Concurrency Control

Every state-changing operation requires a valid `stateHash` from `read_team_state`:

```typescript
// Pseudo-code validation
if (expectedStateHash !== currentStateHash) {
  throw new Error("State hash mismatch - re-read team state");
}
```

### Scope Path Normalization

Paths are normalized before conflict detection:
- Backslashes → forward slashes
- Leading `./` and `/` stripped
- Duplicate slashes collapsed
- Trailing slashes on directories removed

### Bearer Token Authentication

All requests require a valid OAuth bearer token:
```
Authorization: Bearer <access_token>
```

## Database Schema

### Core Tables

- `workspaces` - Workspace configuration
- `members` - User membership in workspaces
- `agents` - Registered agents
- `agent_sessions` - Active sessions
- `agent_states` - Agent state snapshots
- `agent_scope_claims` - Active file/folder claims
- `knowledge_docs` - Workspace knowledge base
- `subscriptions` - Billing subscriptions

## Deployment

The MCP endpoint is deployed as a Next.js API route:

```
src/app/api/mcp/route.ts
```

It runs on Vercel Serverless Functions with:
- Supabase PostgreSQL for persistence
- In-memory Map for runtime coordination
- OAuth 2.0 + PKCE for authentication
