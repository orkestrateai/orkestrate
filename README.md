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

### 1. Prerequisites
- [Bun](https://bun.sh) runtime installed.
- Supabase project for database and authentication.

### 2. Setup
```bash
# Clone and install
git clone https://github.com/system1970/Orkestrate.git
cd Orkestrate
bun install

# Environment setup
cp .env.example .env
# Edit .env with your Supabase credentials

# Prepare database
bun run db:push
```

### 3. Run Development Server
```bash
bun dev
```
The dashboard will be available at [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

---

## 🔌 Integrating Agents

Orkestrate exposes a standardized MCP endpoint that can be added to any compatible IDE or CLI tool.

**Endpoint:** `https://orkestrate.vercel.app/api/mcp`

### Claude Code
```bash
claude mcp add --transport http --scope project Orkestrate "https://orkestrate.vercel.app/api/mcp"
```

### OpenCode
Add a new `remote` tool with the URL above.

---

## 🛡 Security & Reliability

- **Optimistic Concurrency**: Agents must provide a `stateHash` to update state, preventing race conditions.
- **Strict Scoping**: Resource locking prevents agents from modifying the same files simultaneously.
- **Telemetry**: Full audit trail of agent commands and tool usage.

---
© 2026 Orkestrate. Built for the autonomous age.
