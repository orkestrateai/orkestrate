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

### Orkestrate MCP Endpoint

```text
https://orkestrate.vercel.app/api/mcp
```

### Claude Code

1. Add the MCP server:
   ```bash
   claude mcp add --transport http --scope project Orkestrate "https://orkestrate.vercel.app/api/mcp"
   ```
2. Verify setup:
   ```bash
   claude mcp list
   ```
3. Authenticate from an active Claude Code session via `/mcp` -> `Orkestrate` -> `Authenticate`.

### OpenCode

1. Run:
   ```bash
   opencode mcp add
   ```
2. In the prompt flow, set:
   - Name: `Orkestrate`
   - Type: `remote`
   - URL: `https://orkestrate.vercel.app/api/mcp`
3. Authenticate:
   ```bash
   opencode mcp auth Orkestrate
   ```
4. Verify:
   ```bash
   opencode mcp auth list
   opencode mcp list
   ```

Manual OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "Orkestrate": {
      "type": "remote",
      "url": "https://orkestrate.vercel.app/api/mcp",
      "enabled": true
    }
  }
}
```

### Codex

1. Add the MCP server:
   ```bash
   codex mcp add Orkestrate --url https://orkestrate.vercel.app/api/mcp
   ```
2. Authenticate:
   ```bash
   codex mcp login Orkestrate
   ```
3. Verify:
   ```bash
   codex mcp list
   ```

Manual Codex config (`~/.codex/config.toml`):

```toml
[mcp_servers.Orkestrate]
url = "https://orkestrate.vercel.app/api/mcp"
```

### Optional OpenCode Telemetry Plugin

If you want enhanced OpenCode telemetry in the Orkestrate dashboard:

```bash
mkdir -p ~/.config/opencode/plugins && curl -sL https://orkestrate.vercel.app/tools/opencode/plugin.ts -o ~/.config/opencode/plugins/Orkestrate.ts
```

---

## 🚀 Deployment

### Vercel

This project is configured for deployment on Vercel with bun as the package manager.

1. **Connect Repository**: Import your GitHub repository in the Vercel dashboard.
2. **Configure Build Settings**: Vercel will automatically detect the configuration from `vercel.json`.
3. **Environment Variables**: Add your environment variables in the Vercel project settings:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Any other required environment variables from `.env.example`
4. **Deploy**: Push to `main` branch to trigger automatic deployment.

The project uses:
- Build command: `bun run build`
- Install command: `bun install`
- Output directory: `.next`

### CI/CD

GitHub Actions automatically runs on every push and pull request:
- **Lint**: Code quality checks with ESLint
- **Type Check**: TypeScript type validation
- **Build**: Production build verification

All checks must pass before merging to main.

---

## 🛡 Security & Safety
Orkestrate handles sensitive telemetry data.
- **Shell Sanitization**: Automated escaping of shell values in prompt generation.
- **Secure Payloads**: Telemetry sync uses temp-file isolation with restrictive permissions (0o600) to prevent symlink attacks.
- **Signal Safety**: Native plugins handle termination signals gracefully to ensure final state is captured.


