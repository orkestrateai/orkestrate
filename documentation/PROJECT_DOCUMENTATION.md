# Orkestrate Platform Documentation

## Project Overview

**Orkestrate** is a multi-agent coordination protocol and platform designed to enable multiple independent AI coding agents (OpenCode, Codex, Claude, Cursor, etc.) to collaborate on complex coding tasks within a shared workspace. It solves the "context shift" and "overwrite" problems by providing a structured protocol for agents to negotiate, plan, and execute changes without a central orchestrator.

---

## Core Vision

Orkestrate aims to be the "central nervous system" (State Sync) for local, isolated AI agents. Instead of replacing the developer's local agent, Orkestrate connects them to a shared "State Store" using the Model Context Protocol (MCP), enabling true swarm collaboration where agents can:

1. Share a curated, live-running summary of the project state
2. Delegate tasks to one another based on unique model capabilities or local tool access
3. Perform autonomous peer reviews and self-corrections on each other's work

The ultimate goal is **"Zero-Prompt Collaboration"** - where simply installing the Orkestrate MCP fundamentally alters the agent's behavior without requiring explicit user instructions.

---

## The Problem

Agents are fundamentally "prompt-driven" - they are "brains in a jar" that only react to user instructions. Getting an agent to adopt a strict collaborative workflow requires the user to write heavy instructions in `.cursorrules` or `agents.md` files, which introduces massive friction.

Orkestrate solves this by "tricking" the AI into adopting collaborative workflows autonomously through the underlying MCP architecture.

---

## Protocol Phases

Orkestrate operates through progressive phases ensuring reliable coordination:

### Phase 0: Telemetry & Presence (Live)
- **Telemetry**: Real-time event stream (tool calls, messages, status)
- **Presence**: Coordination of agent families and scoped IDs
- Agents announce their presence and broadcast live heartbeat pulses

### Phase 1: Shared Coordination (Active)
- Agents read and write to a shared coordination file in the workspace
- **Intent**: Agents broadcast their current objective
- **Footprint**: Agents declare which files they are currently analyzing or modifying

### Phase 2: Planning & Conflict Resolution
- Agents negotiate overlapping footprints before making major changes
- **Peer Review**: Agents can "see" each other's plans
- **Locking**: Soft-locking mechanism to prevent duplicate work

### Phase 3 & 4: Execution & Self-Correction
- Final implementation and automated verification of combined agent output

---

## Architecture

### Tech Stack

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + Supabase (PostgreSQL + Realtime)
- **Coordination**: Model Context Protocol (MCP) as the bridge between IDEs and the Orkestrate server
- **Persistence**: Drizzle ORM for structured state management
- **Telemetry**: Event-driven architecture with native plugins

### Key Dependencies

- `@modelcontextprotocol/sdk`: MCP server implementation
- `@opencode-ai/plugin`: OpenCode native plugin integration
- `@supabase/ssr` & `@supabase/supabase-js`: Supabase authentication and realtime
- `drizzle-orm`: Type-safe SQL query builder
- `ws`: WebSocket support for realtime features

---

## Project Structure

```
/src
├── app/                    # Next.js App Router pages
│   ├── dashboard/           # Real-time monitoring dashboard
│   ├── docs/               # Documentation page
│   ├── oauth/              # OAuth authorization flows
│   └── page.tsx            # Landing page
├── components/              # React components
│   ├── dashboard/          # Dashboard-specific components
│   │   ├── AgentTelemetryPane.tsx
│   │   ├── ChatRenderer.tsx
│   │   ├── CodexRenderer.tsx
│   │   └── WorkspaceContentPane.tsx
│   └── ui/                 # shadcn/ui components
├── db/
│   ├── schema.ts           # Drizzle database schema
│   └── index.ts            # Database initialization
├── lib/
│   ├── agent-identity.ts   # Agent ID normalization
│   ├── http.ts             # HTTP utilities
│   ├── mcp-prompt.ts       # MCP prompt builder
│   ├── oauth-store.ts      # OAuth token management
│   ├── rooms.ts            # Room management logic
│   ├── shared-workspace.ts # Shared workspace coordination
│   └── supabase.ts         # Supabase client
├── pages/api/
│   ├── mcp.ts              # Primary MCP server endpoint
│   ├── rooms.ts            # Room CRUD operations
│   ├── room-content.ts     # Room content retrieval
│   ├── telemetry-history.ts# Telemetry history API
│   └── oauth/              # OAuth endpoints
└── tools/                  # Agent-specific adapters
    ├── claude/
    ├── codex/
    └── opencode/

/public/tools/              # Client-side telemetry scripts
    ├── claude/
    ├── codex/
    └── opencode/
```

---

## Database Schema

### Core Tables

**agent_states**
- Tracks individual agent state within a project/room
- Fields: id, userId, projectId, clientId, stateContent, stateHash, lastPingAt, pingCount
- Unique constraint on (userId, projectId, clientId)

**agentTelemetry**
- Stores real-time telemetry events from agents
- Fields: userId, roomId, clientId, agent, eventType, payload, createdAt
- Indexed by room/user and client/agent for efficient queries

**rooms**
- Workspaces where agents collaborate
- Fields: id, name, ownerUserId, createdAt, updatedAt

**roomMemberships**
- User membership in rooms with roles
- Fields: roomId, userId, role, createdAt

**userRoomPreferences**
- Tracks user's active room preference
- Fields: userId, activeRoomId, updatedAt

---

## MCP Server Tools

The MCP server exposes three primary tools:

### 1. read_agent_state
- **Phase 2**: Read current team state
- Returns all agents' architecture footprints to avoid conflicts
- Must be called before every action
- Returns: Team state content + caller's canonical agent ID + stateHash

### 2. write_agent_state
- **Phase 3 & 4**: Broadcast agent's plan
- Required fields: agentProfile, currentObjective, architectureFootprint, implementationPlan, notesForTeam
- Uses optimistic concurrency with expectedStateHash to prevent overwrites
- Returns success or conflict error

### 3. read_knowledge_base / write_knowledge_base
- Called when user starts Orkestrate
- Returns strict Orkestrate collaboration protocol rules
- Handles session reconnection

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

- **Workspace Management**: Create, switch, and delete workspaces (rooms)
- **Real-time Agent Presence**: See online/offline/disconnected status
- **Telemetry Feed**: Live stream of agent events with filtering
- **Workspace Content**: View shared team state and coordination files
- **Resizable Panes**: Adjustable layout between telemetry and workspace views

---

## OAuth Flow

Orkestrate implements OAuth 2.0 for agent authentication:

- **Authorization Server**: /api/oauth/authorization-server
- **Token Endpoint**: /api/oauth/token
- **Protected Resources**: MCP endpoints validate bearer tokens
- **Client Registration**: Agents register as OAuth clients

---

## Security Features

- **Shell Sanitization**: Automated escaping of shell values
- **Secure Payloads**: Telemetry sync uses temp-file isolation with restrictive permissions (0o600)
- **Signal Safety**: Native plugins handle termination signals gracefully
- **Rate Limiting**: Built into agent state tracking (ping counts per time window)
- **Optimistic Concurrency**: State hash prevents race conditions

---

## Integration Methods

### OpenCode (Native Plugin)
- Deep event hooks into agent lifecycle
- Plugin located at public/tools/opencode/plugin.


