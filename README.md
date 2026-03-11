# Orkestrate

**Multi-agent coordination protocol for the autonomous era.**

Orkestrate is a framework and platform designed to enable multiple independent AI agents to coordinate on complex coding tasks within a shared workspace. It solves the "context shift" and "overwrite" problems by providing a structured protocol for agents to negotiate, plan, and execute changes.

---

## 🚀 The Orkestrate Protocol

Orkestrate operates through a series of progressive phases that ensure reliable coordination without a central "master" orchestrator.

### Phase 1: Shared Coordination
Agents read and write to a shared coordination state via the MCP server.
- **Intent**: Agents broadcast their current objective.
- **Footprint**: Agents declare which files they are currently analyzing or modifying.

### Phase 2: Planning & Conflict Resolution
Agents negotiate overlapping footprints before making major changes.
- **Peer Review**: Agents can "see" each other's plans in the coordination dashboard.
- **Locking**: Strict-locking mechanism to prevent duplicate work on the same module.

---

## 🛠 Architecture

Orkestrate is built on a modern, event-driven stack:

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + Lucide Icons.
- **Backend**: Next.js API Routes + Supabase (PostgreSQL + Realtime).
- **Coordination**: Model Context Protocol (MCP) as the bridge between IDEs and the Orkestrate server.
- **Persistence**: Drizzle ORM for structured state management.
- **Security**: Centralized CSP and Rate Limiting via `src/proxy.ts`.

---

## 📂 Project Structure

- `src/app/api/mcp/route.ts`: The primary MCP server endpoint.
- `src/tools/`: Tool-specific adapters (Codex, OpenCode, Claude).
- `src/app/dashboard/`: Real-time monitoring and coordination UI.
- `src/db/schema.ts`: Drizzle ORM schema definitions.
- `src/proxy.ts`: Security and request middleware.

---

## ⚡ Setup

1. **Environment**: Copy `.env.example` to `.env` and fill in your Supabase credentials.
2. **Install Dependencies**:
   ```bash
   bun install
   ```
3. **Database Migration**:
   ```bash
   bunx drizzle-kit push
   ```
4. **Development Server**:
   ```bash
   bun dev
   ```

---

## 🔌 Tool Integration

### Orkestrate MCP Endpoint

```text
https://orkestrate.vercel.app/api/mcp
```

### Claude Code

```bash
claude mcp add --transport http --scope project Orkestrate "https://orkestrate.vercel.app/api/mcp"
```

### OpenCode

```bash
opencode mcp add
```
- Name: `Orkestrate`
- Type: `remote`
- URL: `https://orkestrate.vercel.app/api/mcp`

---

## 🛡 Security & Safety
Orkestrate handles sensitive coordination data with several layers of security:
- **Rate Limiting**: Integrated OAuth endpoint protection in `proxy.ts`.
- **Content Security Policy**: Strict CSP enforcement for all dashboard routes.
- **Optimistic Concurrency**: State updates use a `stateHash` (CAS) mechanism to prevent race conditions between agents.

---
© 2026 Orkestrate Team. Early-stage single-builder mode.
