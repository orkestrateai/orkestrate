
# CLI Layer

## Overview

The CLI layer represents the agent-side tooling that connects AI coding agents (OpenCode, Claude Code, Codex) to the Orkestrate MCP coordination layer. Rather than a single CLI application, Orkestrate uses a plugin/telemetry adapter pattern that integrates with existing agent tools through their extension mechanisms.

## Architecture

### Plugin System

Orkestrate does not ship a monolithic CLI. Instead, it provides lightweight adapter plugins for each supported agent:

```
public/tools/
├── opencode/
│   └── plugin.ts    # OrkestrateTelemetry plugin for OpenCode
├── claude/
│   └── prompt.ts    # Claude-specific setup instructions
└── codex/
    └── prompt.ts    # Codex-specific setup instructions
```

### OpenCode Plugin (`plugin.ts`)

The OpenCode integration uses a custom `Plugin` interface that connects to Orkestrate's real-time command queue:

```typescript
export const OrkestrateTelemetry: Plugin = async ({ client, directory }) => {
  // Connection setup to Orkestrate MCP
  await send("connect", { directory })

  // Command polling (dashboard → TUI)
  let activeSessionId: string | null = null

  // Pull loop for receiving commands from dashboard
  const pullLoop = async () => {
    while (true) {
      const cmd = await pull()
      if (cmd) {
        // Execute command in agent TUI
        await client.session.prompt({ path: { id: activeSessionId }, body: { parts: [{ type: "text", text }] } })
      }
    }
  }
}
```

## Agent Identification

### Canonical Agent ID

Each agent receives a canonical ID derived from multiple sources:

```typescript
interface AgentIdentity {
  id: string           // e.g., "opencode-a5f2"
  family: string       // "opencode" | "claude" | "codex"
  scopedAgentId: string // e.g., "user123::opencode-a5f2"
  clientId: string     // OAuth client ID
}
```

### Identity Resolution

```typescript
function resolveAgentFingerprint({
  explicitAgentId?: string,  // User-specified ID
  clientId: string,         // OAuth client
  userId: string,           // Owner's user ID
  familyHint: string,       // Tool family hint
}): AgentIdentity
```

The ID is generated using a hash of the client + user + explicit ID, ensuring uniqueness while remaining deterministic.

## Session Lifecycle

### 1. Initialization

Each agent plugin performs Phase 0 telemetry setup:

```typescript
// Example: OpenCode Phase 0 prompt
function buildPhase0Prompt(ctx: AgentContext): string {
  return `
# Orkestrate Telemetry Setup

Your Orkestrate configuration:
- Workspace ID: ${ctx.workspaceId}
- Canonical Agent ID: ${ctx.agentId}
- MCP Endpoint: https://orkestrate.space/api/mcp

Required environment variables:
export ORKESTRATE_WORKSPACE_ID="${ctx.workspaceId}"
export ORKESTRATE_AGENT_ID="${ctx.agentId}"
export ORKESTRATE_MCP_URL="https://orkestrate.space/api/mcp"

Next step: Run 'orkestrate mcp' to start the coordination session.
`.trim()
}
```

### 2. Workspace Join

```typescript
// MCP call: join_workspace
await mcp.tools.call({
  name: "join_workspace",
  arguments: {
    toolName: "OpenCode",           // Human-readable name
    workspaceId: "ws_xxx",         // Target workspace
    gitContext: {
      remote: "git@github.com:org/repo.git",
      repoRoot: "/path/to/repo",
      branch: "feature/new-auth",
      headSha: "abc1234",
      dirty: false,
      collectedAt: new Date().toISOString()
    }
  }
})
```

### 3. Active Session

Once joined, the agent:
- Polls for dashboard commands via `pull()`
- Publishes state updates via `update_my_state`
- Claims scopes before file edits via `claim_scope`
- Sends/receives messages via `send_message` / `read_messages`

## MCP Client Connection

### Connecting to the MCP Endpoint

```typescript
import { Client } from "@modelcontextprotocol/sdk/client"

const mcp = new Client({
  name: "orkestrate-opencode",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
})

await mcp.connect(
  new SSEClientTransport({
    url: "https://orkestrate.space/api/mcp",
    // Auth handled via Authorization header
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })
)
```

### Authentication

The MCP endpoint requires OAuth 2.0 bearer tokens:

```typescript
// Token flow
1. Agent initiates OAuth PKCE flow via Orkestrate dashboard
2. User approves access in browser
3. Agent receives access_token + refresh_token
4. Agent includes token in MCP requests:

Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Tool Adapters

### Adapter Interface

```typescript
interface ToolAdapter {
  family: string
  buildPhase0Prompt(ctx: AgentContext): string
}
```

### Registered Adapters

| Family | Adapter | File |
|--------|---------|------|
| `opencode` | OrkestrateTelemetry | `public/tools/opencode/plugin.ts` |
| `claude` | ClaudeSetup | `src/tools/claude/prompt.ts` |
| `codex` | CodexSetup | `src/tools/codex/prompt.ts` |
| `agent` | FallbackAdapter | Default fallback |

## Git Context Integration

### Collecting Git Context

Before joining a workspace, agents collect git metadata:

```bash
# Remote URL
git remote get-url origin

# Repository root
git rev-parse --show-toplevel

# Current branch
git rev-parse --abbrev-ref HEAD

# Current commit SHA
git rev-parse HEAD

# Working tree status
git status --porcelain
```

### Normalized Remote Format

URLs are normalized to a canonical format:

```typescript
function normalizeGitUrl(url: string): string {
  // git@github.com:org/repo.git → https://github.com/org/repo
  // https://github.com/org/repo.git → https://github.com/org/repo
  return url
    .replace(/^git@[^:]+:/, 'https://')
    .replace(/\.git$/, '')
    .replace(/^\w+:\/\//, 'https://')
}
```

## Real-time Command Queue

### Dashboard → Agent Commands

The OpenCode plugin supports pulling commands from the dashboard:

```typescript
async function pull(): Promise<Command | null> {
  // GET /api/commands?sessionId=xxx&agentId=xxx
  const res = await fetch(`${ORKESTRATE_HOST}/api/commands?${params}`)
  if (!res.ok) return null
  return res.json()
}
```

### Command Execution

```typescript
async function executeCommand(cmd: Command) {
  if (cmd.type === "prompt") {
    // Inject prompt into agent TUI
    await client.tui.appendPrompt({ body: { text: cmd.content } })
    await client.tui.submitPrompt()
  }
  if (cmd.type === "cancel") {
    // Cancel current operation
    await client.session.cancel()
  }
}
```

## Agent State Publishing

### Periodic State Updates

Agents publish state at key moments:

```typescript
// After claiming scope
await mcp.tools.call({
  name: "update_my_state",
  arguments: {
    expectedStateHash: currentHash,
    content: {
      agentProfile: "Frontend specialist focused on auth flows",
      currentObjective: "Implementing login form validation",
      architectureFootprint: ["src/auth/login.ts", "src/auth/validation.ts"],
      implementationPlan: [
        "Add email validation regex",
        "Implement password strength checker",
        "Create error message components"
      ],
      notesForTeam: "Using Zod for validation schema",
      pastWorkSummary: [
        "Set up auth router structure",
        "Created Supabase client"
      ],
      repo: {
        canonicalRemote: "https://github.com/org/repo",
        branch: "feature/auth",
        headSha: "abc1234",
        dirty: false
      }
    }
  }
})
```

## Scope Claiming

### Before File Edits

```typescript
// Claim scope before modifying files
const claimResult = await mcp.tools.call({
  name: "claim_scope",
  arguments: {
    expectedStateHash: currentHash,
    paths: ["src/auth/login.ts", "src/auth/validation.ts"],
    ttlSeconds: 900  // 15 minutes default
  }
})

if (!claimResult.success) {
  // Handle conflict
  console.log(`Scope conflict with: ${claimResult.conflictingAgent}`)
  // Re-read team state and retry or choose different paths
}
```

### Claim TTL

| TTL | Duration | Use Case |
|-----|----------|----------|
| 900 | 15 minutes | Default for quick edits |
| 1800 | 30 minutes | Medium tasks |
| 3600 | 1 hour | Large refactors |

## Inter-Agent Messaging

### Sending Messages

```typescript
// Direct message to specific agent
await mcp.tools.call({
  name: "send_message",
  arguments: {
    toAgentId: "claude-1",
    message: "Hey, I'm unblocked on the API. Ready for review."
  }
})

// Broadcast to all agents
await mcp.tools.call({
  name: "send_message",
  arguments: {
    toAgentId: "@everyone",
    message: "Standup: All agents report status in notes."
  }
})
```

### Reading Messages

```typescript
const messages = await mcp.tools.call({
  name: "read_messages"
})

// Returns all unread messages addressed to this agent
// Automatically marks them as read
```

## Knowledge Base Access

### Reading Documentation

```typescript
// Search knowledge base
const docs = await mcp.tools.call({
  name: "read_knowledge_base",
  arguments: {
    query: "authentication flow",
    workspaceId: "ws_xxx",
    includeContent: true
  }
})

// List root folder
const rootDocs = await mcp.tools.call({
  name: "read_knowledge_base",
  arguments: {
    parentId: null
  }
})
```

### Writing Documentation

```typescript
// Create new doc
await mcp.tools.call({
  name: "write_knowledge_base",
  arguments: {
    action: "create",
    title: "Auth Implementation Notes",
    description: "Notes on the OAuth flow implementation",
    content: "# Auth Implementation\n\n## Flow\n\n1. User clicks login...",
    parentId: "folder-id",
    isFolder: false
  }
})
```

## Error Recovery

### Automatic Reconnection

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (err.code === "ECONNRESET" || err.code === "TIMEOUT") {
        await sleep(1000 * Math.pow(2, i))  // Exponential backoff
        continue
      }
      throw err
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`)
}
```

### State Hash Mismatch

When `update_my_state` returns a hash mismatch:

```typescript
// 1. Re-read team state
const state = await mcp.tools.call({ name: "read_team_state" })

// 2. Merge any changes into local state
mergeAgentUpdates(state.agents)

// 3. Retry with fresh hash
await mcp.tools.call({
  name: "update_my_state",
  arguments: {
    expectedStateHash: state.stateHash,
    content: updatedContent
  }
})
```

### Scope Conflict Resolution

```typescript
// When scope claim is rejected
if (result.error === "SCOPE_CONFLICT") {
  const { conflictingAgent, theirPaths } = result.details

  // Options:
  // 1. Wait for them to release
  // 2. Negotiate via send_message
  // 3. Choose different paths
  const alternativePaths = ["src/utils/auth-helper.ts"]
  await mcp.tools.call({
    name: "claim_scope",
    arguments: { expectedStateHash: state.stateHash, paths: alternativePaths }
  })
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ORKESTRATE_WORKSPACE_ID` | Target workspace ID | Yes |
| `ORKESTRATE_AGENT_ID` | Canonical agent ID | Yes |
| `ORKESTRATE_MCP_URL` | MCP endpoint URL | Yes |
| `ORKESTRATE_ACCESS_TOKEN` | OAuth access token | Yes |
| `ORKESTRATE_REFRESH_TOKEN` | OAuth refresh token | For token refresh |
| `ORKESTRATE_CLIENT_ID` | OAuth client ID | Yes |

## Session Persistence

### Session Resumption

When an agent reconnects after a disconnection:

```typescript
// Server detects existing session by scopedAgentId
// Returns last known state

const resumedSession = await mcp.tools.call({
  name: "read_team_state"
})

// resumedSession includes:
// - Last objective
// - Architecture footprint
// - Implementation plan
// - Notes for team
// - Time since last update
```

## Monitoring & Telemetry

### Agent Metadata

The MCP layer tracks:

- Session start/end times
- Tool call frequency
- State update timestamps
- Scope claim durations
- Message delivery times

### Error Reporting

```typescript
// Report error to dashboard
await mcp.tools.call({
  name: "update_my_state",
  arguments: {
    expectedStateHash: currentHash,
    content: {
      // ... normal state
      notesForTeam: "ERROR: TypeScript compilation failed in auth module. Need help resolving ' Module not found: @utils/logger'"
    }
  }
})
```

## Security Considerations

### Token Storage

- Access tokens stored in memory only
- Refresh tokens stored securely (keychain/credential manager)
- No tokens written to disk or logs

### Input Sanitization

All MCP tool arguments are validated server-side:

```typescript
// Path normalization prevents directory traversal
function normalizeScopePath(raw: string): string {
  return raw
    .replace(/\\/g, "/")      // Windows paths
    .replace(/^\.\/+/, "")     // Leading ./
    .replace(/^\/+/, "")       // Leading /
    .replace(/\/{2,}/g, "/")   // Double slashes
}
```

### Shell Value Safety

```typescript
// Agent IDs and paths are validated before shell use
const SAFE_SHELL_VALUE = /^[a-zA-Z0-9._\-:]+$/

function sanitizeShellValue(value: string): string {
  if (!SAFE_SHELL_VALUE.test(value)) {
    throw new Error(`Unsafe value for shell interpolation`)
  }
  return value
}
```

## Integration Examples

### OpenCode Integration

```typescript
// In opencode plugin
import { registerPlugin } from "opencode"
import { OrkestrateTelemetry } from "./plugin"

registerPlugin("orkestrate", OrkestrateTelemetry)
```

### Claude Code Integration

```bash
# Add MCP server
claude mcp add --transport http --scope project Orkestrate \
  "https://orkestrate.space/api/mcp"
```

### Codex Integration

```json
// .codex/config.json
{
  "mcpServers": {
    "orkestrate": {
      "command": "npx",
      "args": ["-y", "@orkestrate/codex-plugin"]
    }
  }
}