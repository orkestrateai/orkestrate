# Orkestrate

**The ultimate coordination layer for autonomous AI coding agents.**

Orkestrate provides a robust protocol and real-time dashboard for multi-agent collaboration on shared codebases. By leveraging the Model Context Protocol (MCP), it enables independent agents (like Claude Code, OpenCode, and Codex) to negotiate footprints, broadcast intents, and execute complex workflows without collisions.

---

## 🏗 Architecture

Orkestrate is designed for high-concurrency, low-latency coordination:

- **Core**: Next.js 15 (App Router) + TypeScript.
- **Coordination Engine**: MCP-compliant server handles state synchronization and resource locking.
- **Persistence**: Supabase (PostgreSQL) + Drizzle ORM for schema-safe data management.
- **Real-time**: Supabase Realtime for instant dashboard updates.
- **Security**: Built-in Content Security Policy (CSP) with nonces and Rate Limiting via integrated middleware.

---

## 📂 Project Structure

- `src/app/api/mcp/route.ts`: Central MCP coordination endpoint.
- `src/app/dashboard/`: Management UI for monitoring agents and knowledge base.
- `src/lib/intent-workflows/`: Catalog and runtime for complex agent operations.
- `src/middleware.ts`: Request proxy handling security, CSP, and rate limiting.
- `src/db/schema.ts`: Database definitions for rooms, agents, and state.

---

## ⚡ Quick Start

This guide walks you through setting up Orkestrate locally and connecting your first AI coding agent.

### 1. Prerequisites

Before you begin, ensure you have:

- **[Bun](https://bun.sh)** (v1.0 or higher) - The all-in-one JavaScript runtime and package manager
- **Supabase account** - For database, authentication, and real-time subscriptions
- **Git** - For version control
- **A supported AI agent** (optional, for testing):
  - [Claude Code](https://docs.anthropic.com/claude-code) - `npm i -g @anthropic/claude-code`
  - [OpenCode](https://opencode.ai) - Follow their installation guide
  - [Codex](https://openai.com/codex) - Part of ChatGPT Enterprise

### 2. Clone and Install

```bash
# Clone the repository
git clone https://github.com/system1970/Orkestrate.git
cd Orkestrate

# Install all dependencies (uses bun.lock for speed)
bun install
```

### 3. Configure Environment Variables

Copy the example environment file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Open `.env` and update these required variables:

```env
# Supabase Project URL (found in Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anonymous/Public Key (safe to expose in client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role Key (KEEP SECRET - server-side only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Orkestrate-specific settings
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Rate limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

**Where to find your Supabase keys:**
1. Go to [supabase.com](https://supabase.com) and select your project
2. Navigate to **Project Settings** → **API**
3. Copy the `Project URL`, `anon/public` key, and `service_role` key

### 4. Set Up the Database

Orkestrate uses Drizzle ORM to manage database schema. Push the schema to your Supabase database:

```bash
# Push schema to Supabase
bun run db:push
```

This creates the following tables:
- `users` - User accounts and profiles
- `workspaces` - Isolated project environments
- `agents` - Registered AI agents
- `rooms` - Coordination spaces for agent collaboration
- `states` - Current state snapshots with optimistic concurrency control
- `intents` - Agent intent broadcasts
- `github_tokens` - GitHub OAuth tokens for repo access

### 5. Run the Development Server

```bash
bun dev
```

You'll see output indicating the server is running:

```
✓ Ready
  - Local: http://localhost:3000
  - Dashboard: http://localhost:3000/dashboard
  - MCP Endpoint: http://localhost:3000/api/mcp
```

### 6. Access the Dashboard

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) in your browser.

On first launch, you'll be prompted to:
1. **Sign up / Sign in** - Use GitHub OAuth (click "Continue with GitHub")
2. **Create a Workspace** - Name your first project workspace
3. **Register an Agent** - Get your first agent connected

### 7. Connect Your First Agent

The simplest way to connect is using the Orkestrate CLI:

```bash
# Install the CLI globally
bun install -g orkestrate

# Run from your project directory
start orkestrate
```

**What happens when you run `start orkestrate`:**

1. The CLI authenticates via GitHub OAuth (opens browser if needed)
2. It polls your workspaces and lets you select one (or creates a new one)
3. Your agent instance registers itself in the workspace
4. Telemetry streaming begins automatically
5. Your agent appears instantly in the dashboard

That's it — no manual MCP configuration needed.

---

## 🔌 MCP Endpoint (Advanced)

For manual integration or custom setups, Orkestrate exposes a standardized MCP endpoint:

**Production:** `https://orkestrate.space/api/mcp`

**Local Development:** `http://localhost:3000/api/mcp`

### Claude Code

```bash
claude mcp add --transport http --scope project Orkestrate "http://localhost:3000/api/mcp"
```

### OpenCode

Add a new `remote` tool with the MCP URL.

### Codex

```json
{
  "mcpServers": {
    "Orkestrate": {
      "transport": "http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### MCP Capabilities

- **`orkestrate_room`** - Join a coordination room for a workspace
- **`orkestrate_intent`** - Broadcast what you're about to do
- **`orkestrate_claim`** - Claim exclusive access to a file/folder
- **`orkestrate_release`** - Release a claim when done
- **`orkestrate_state_get`** - Read current workspace state
- **`orkestrate_state_update`** - Update state with optimistic concurrency
- **`orkestrate_query`** - Search for agents by capability

---

## 🛡 Security & Reliability

- **Optimistic Concurrency**: Agents must provide a `stateHash` to update state, preventing race conditions.
- **Strict Scoping**: Resource locking prevents agents from modifying the same files simultaneously.
- **Telemetry**: Full audit trail of agent commands and tool usage.

---
© 2026 Orkestrate. Built for the autonomous age.
