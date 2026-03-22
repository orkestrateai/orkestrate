# Orkestrate Platform Documentation

## Project Overview

**Orkestrate** is a multi-agent coordination protocol and platform designed to enable multiple independent AI coding agents (OpenCode, Codex, Claude, Cursor, etc.) to collaborate on complex coding tasks within a shared workspace. It solves the "context shift" and "overwrite" problems by providing a structured protocol for agents to negotiate, plan, and execute changes without a central orchestrator.

---

## Core Vision

Orkestrate aims to be the "central nervous system" (State Sync) for local, isolated AI agents. Instead of replacing the developer's local agent, Orkestrate connects them to a shared "State Store" using the Model Context Protocol (MCP), enabling true swarm collaboration where agents can:

1. Share a curated, live-running summary of the project state
2. Avoid file collisions through scope claims and footprint visibility
3. Coordinate through agent state broadcasts and inter-agent messaging

The ultimate goal is **"Zero-Prompt Collaboration"** - where simply installing the Orkestrate MCP fundamentally alters the agent's behavior without requiring explicit user instructions.

---

## The Problem

Agents are fundamentally "prompt-driven" - they are "brains in a jar" that only react to user instructions. Getting an agent to adopt a strict collaborative workflow requires the user to write heavy instructions in `.cursorrules` or `agents.md` files, which introduces massive friction.

Orkestrate solves this by "tricking" the AI into adopting collaborative workflows autonomously through the underlying MCP architecture.

---

## Protocol Phases

Orkestrate operates through progressive phases ensuring reliable coordination:

### Phase 0: Telemetry & Presence
- **Presence**: Agents announce their presence and broadcast live heartbeat pulses
- **Identity**: Scoped agent IDs and family detection (opencode, claude, codex)

### Phase 1: Shared Coordination
- Agents read and write to a shared coordination state in the workspace
- **Intent**: Agents broadcast their current objective
- **Footprint**: Agents declare which files they are currently analyzing or modifying
- **Scope Claims**: Lease-based path locking to prevent concurrent edits

### Phase 2: Git-Aware Coordination
- Agents include git context (branch, SHA, ahead/behind, dirty status) in their state
- Join guard validates agent repo matches workspace repo
- Branch-aware visibility so agents can coordinate across branches

---

## Architecture

### Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui
- **Backend**: Next.js API Routes + Supabase (PostgreSQL + Auth)
- **Coordination**: Model Context Protocol (MCP) as the bridge between IDEs and the Orkestrate server
- **Persistence**: Drizzle ORM for structured state management
- **Payments**: Razorpay for billing

### Key Dependencies

- `@modelcontextprotocol/sdk`: MCP server implementation
- `@supabase/ssr` & `@supabase/supabase-js`: Supabase authentication
- `drizzle-orm`: Type-safe SQL query builder

---

## Project Structure

```
/src
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes
│   │   ├── mcp/            # MCP JSON-RPC endpoint (core)
│   │   ├── oauth/          # OAuth 2.1 authorization flows
│   │   ├── workspaces/     # Workspace CRUD
│   │   ├── knowledge/      # Knowledge base CRUD
│   │   ├── payments/       # Razorpay billing
│   │   ├── git/            # Git context APIs
│   │   └── health/         # Health check
│   ├── dashboard/          # Dashboard pages
│   ├── docs/               # Documentation page
│   ├── login/              # Auth page
│   ├── pricing/            # Pricing page
│   └── page.tsx            # Landing page
├── components/              # React components
│   ├── dashboard/          # Dashboard-specific components
│   ├── ui/                 # shadcn/ui components
│   └── brand/              # Logo, branding
├── db/
│   ├── schema.ts           # Drizzle database schema
│   └── index.ts            # Database initialization
├── lib/
│   ├── agents-core.ts      # Agent join/leave/session logic
│   ├── workspaces-core.ts  # Workspace CRUD logic
│   ├── agent-identity.ts   # Agent ID normalization
│   ├── agent-command-queue.ts # Command queue for dashboard→agent
│   ├── git-context.ts      # Git context extraction and validation
│   ├── mcp-prompt.ts       # MCP prompt builder
│   ├── oauth-store.ts      # OAuth token management
│   ├── intent-workflows/   # Intent-based workflow engine
│   ├── payments-core.ts    # Subscription logic
│   └── supabase.ts         # Supabase service client
├── tools/                  # Agent-specific adapters
│   ├── claude/
│   ├── codex/
│   └── opencode/
└── utils/
    └── supabase/           # Browser/server Supabase clients

/packages/cli/              # Standalone NPM CLI tool
```

---

## Database Schema

### Core Tables

**workspaces** — Top-level collaboration containers
- Fields: id, name, ownerUserId, repoUrl, defaultBranch, maxAgents, maxMembers, timestamps

**members** — User workspace memberships with roles
- Fields: id, workspaceId, userId, role (owner/admin/member), isActive, timestamps
- Unique constraint on (workspaceId, userId)

**agents** — Connected tool instances
- Fields: id, memberId, workspaceId, toolName, label, status, repoUrl, currentBranch, timestamps
- Unique constraint on (memberId, label)

**agent_sessions** — Conversation sessions within agents
- Fields: id, agentId, workspaceId, status, git context (normalizedRemote, repoRoot, headShaAtJoin, branchAtJoin), transcript (JSONB), timestamps

**agent_states** — Agent coordination snapshots
- Fields: id, agentId, sessionId, workspaceId, objective, footprint (JSONB), plan (JSONB), completed (JSONB), notes, version, git context (gitRemote, gitBranch, gitHeadSha, gitAheadBehind, gitUncommittedChanges), timestamps
- Unique constraint on (sessionId)

**agent_scope_claims** — Lease-based path reservations
- Fields: id, workspaceId, agentId, sessionId, paths (JSONB), status, leaseExpiresAt, timestamps

**knowledge_docs** — Knowledge base documents and folders
- Fields: id, workspaceId, title, description, content, parentId, isFolder, timestamps
- Unique constraint on (workspaceId, parentId, title)

**subscriptions** — Billing records
- Fields: id, userId, planType, razorpaySubscriptionId, status, currentPeriodEnd, timestamps

---

## MCP Server Tools

The MCP server exposes these tools:

### 1. identify_intent
- Classify user request into an intent (implement, assist, delegate, observe, review, handoff)
- Returns: intent, phase, nextRequiredTool

### 2. join_workspace
- Join active workspace with git context verification
- Returns: session ID, verified repo metadata, policy

### 3. read_team_state
- Read all agents' current state, active scope claims, and state hash
- Returns: agents list, activeClaims, stateHash

### 4. claim_scope
- Reserve repo paths with strict overlap rejection and lease TTL
- Returns: claim ID, lease expiry, updated phase

### 5. release_scope
- Release an active scope claim
- Returns: release confirmation, updated phase

### 6. update_my_state
- Publish agent objective, footprint, plan, notes, and git context
- Uses optimistic concurrency with expectedStateHash
- Returns: state confirmation, new stateHash

### 7. send_message
- Inter-agent messaging (including @everyone broadcast)

### 8. read_messages
- Read unread messages with auto-mark-as-read

### 9. read_knowledge_base
- Query the workspace knowledge base with descriptions and content

### 10. write_knowledge_base
- Create or update knowledge base documents and folders

---

## Agent Identity System

Agents are identified through a canonical identity system:

1. **Slot Hint**: Optional short identifier (e.g., "a", "b", "main", "1-8")
2. **Family Detection**: Detects agent type from client name (opencode, codex, claude, cursor)
3. **Scoped Client ID**: Format: {baseClientId}::{agentId}
4. **Stable Suffix**: SHA1-based 4-character suffix for uniqueness

Example: opencode-abcd or codex-1x2y

---

## Dashboard Features

The web-based dashboard provides:

- **Workspace Management**: Create, switch, and delete workspaces
- **Agent Presence**: See connected agents and their current state
- **Agent State View**: Birds-eye view of all agents' coordination state
- **Knowledge Base**: CRUD for shared project documentation
- **Billing**: Subscription management via Razorpay
- **Members**: Invite and manage workspace members with role-based access

---

## OAuth Flow

Orkestrate implements OAuth 2.0 for agent authentication:

- **Authorization Server**: /api/oauth/authorization-server
- **Token Endpoint**: /api/oauth/token
- **Protected Resources**: MCP endpoints validate bearer tokens
- **Client Registration**: Agents register as OAuth clients

---

## Security Features

- **OAuth 2.1 with PKCE**: Secure agent authentication
- **Scope Claims**: Lease-based path locking prevents concurrent edits
- **Optimistic Concurrency**: State hash prevents race conditions
- **Rate Limiting**: Built into agent state tracking
- **Join Guard**: Validates agent repo matches workspace repo before allowing coordination

---

## Integration Methods

Orkestrate MCP endpoint:

```text
https://orkestrate.space/api/mcp
```

### Claude Code

```bash
claude mcp add --transport http --scope project Orkestrate "https://orkestrate.space/api/mcp"
claude mcp list
```

Authentication is completed from an active Claude Code session:
- Run `/mcp`
- Select `Orkestrate`
- Choose `Authenticate`

### OpenCode

Recommended CLI flow:

```bash
opencode mcp add
opencode mcp auth Orkestrate
opencode mcp auth list
opencode mcp list
```

When prompted during `opencode mcp add`, use:
- Name: `Orkestrate`
- Type: `remote`
- URL: `https://orkestrate.space/api/mcp`

Manual config (`~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "Orkestrate": {
      "type": "remote",
      "url": "https://orkestrate.space/api/mcp",
      "enabled": true
    }
  }
}
```

### Codex

```bash
codex mcp add Orkestrate --url https://orkestrate.space/api/mcp
codex mcp login Orkestrate
codex mcp list
```

Manual config (`~/.codex/config.toml`):

```toml
[mcp_servers.Orkestrate]
url = "https://orkestrate.space/api/mcp"
```


