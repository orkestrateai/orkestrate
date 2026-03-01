# Orkestrate

**Multi-agent coordination protocol for the autonomous era.**

Orkestrate is a framework and platform designed to enable multiple independent AI agents (Opencode, Codex, Claude, etc.) to coordinate on complex coding tasks within a shared workspace. It solves the "context shift" and "overwrite" problems by providing a structured protocol for agents to negotiate, plan, and execute changes.

---

## 🚀 The Orkestrate Protocol

Orkestrate operates through a series of progressive phases that ensure reliable coordination without a central "master" orchestrator.

### Phase 0: Telemetry & Presence (Live)
Agents announce their presence and broadcast live heartbeat pulses.
- **Telemetry**: Real-time event stream (tool calls, messages, status).
- **Presence**: Coordination of agent families and scoped IDs.

### Phase 1: Shared Coordination (Active)
Agents read and write to a shared `.Orkestrate.md` file in the workspace.
- **Intent**: Agents broadcast their current objective.
- **Footprint**: Agents declare which files they are currently analyzing or modifying.

### Phase 2: Planning & Conflict Resolution
Agents negotiate overlapping footprints before making major changes.
- **Peer Review**: Agents can "see" each other's plans in the coordination file.
- **Locking**: Soft-locking mechanism to prevent duplicate work on the same module.

### Phase 3 & 4: Execution & Self-Correction
Final implementation and automated verification of the combined agent output.

---

## 🛠 Architecture

Orkestrate is built on a modern, event-driven stack:

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + shadcn/ui.
- **Backend**: Next.js API Routes + Supabase (PostgreSQL + Realtime).
- **Coordination**: Model Context Protocol (MCP) as the bridge between IDEs and the Orkestrate server.
- **Persistence**: Drizzle ORM for structured state management.
- **Telemetry**: Event-driven architecture with native plugins for OpenCode and custom telemetry scripts for other tools.

---

## 📂 Project Structure

- `/src/pages/api/mcp.ts`: The primary MCP server endpoint.
- `/src/tools/`: Tool-specific adapters (Codex, OpenCode, Claude).
- `/public/tools/`: Client-side telemetry scripts and plugins for various AI environments.
- `/src/components/dashboard/`: Real-time monitoring UI.

---

## ⚡ Setup

1. **Environment**: Copy `.env.example` to `.env` and fill in your Supabase credentials.
2. **Install**:
   ```bash
   bun install
   ```
3. **Database**: Push the schema to Supabase.
   ```bash
   bunx drizzle-kit push
   ```
4. **Dev Server**:
   ```bash
   bun dev
   ```

---

## 🔌 Tool Integration

### OpenCode (Native Plugin)
Drop `public/tools/opencode/plugin.ts` into your OpenCode plugins directory. It provides deep event hooks into the agent's lifecycle.

### Codex / Claude (Script Injection)
Use the provided `telemetry.js` scripts to wrap agent executions.

---

## 🛡 Security & Safety
Orkestrate handles sensitive telemetry data.
- **Shell Sanitization**: Automated escaping of shell values in prompt generation.
- **Secure Payloads**: Telemetry sync uses temp-file isolation with restrictive permissions (0o600) to prevent symlink attacks.
- **Signal Safety**: Native plugins handle termination signals gracefully to ensure final state is captured.


