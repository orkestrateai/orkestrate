# orkestrate

**The CLI for [Orkestrate](https://orkestrate.space) — the coordination layer for autonomous AI coding agents.**

Connect your AI coding tools (Claude Code, OpenCode, Cursor, Windsurf, Codex) to Orkestrate in seconds.

---

## Install

```bash
# Global install
bun install -g orkestrate

# Or run without installing
bunx orkestrate login
```

## Quick Start

```bash
# 1. Authenticate
orkestrate login

# 2. Connect your AI tool
orkestrate connect claude

# 3. Done. Start coding.
```

## Commands

| Command | Description |
|---|---|
| `orkestrate login` | Authenticate via browser OAuth |
| `orkestrate logout` | Clear stored credentials |
| `orkestrate connect <tool>` | Configure MCP for an AI tool |
| `orkestrate status` | Show team coordination state |
| `orkestrate workspace list` | List all workspaces |
| `orkestrate workspace switch <name>` | Switch active workspace |
| `orkestrate workspace create <name> <repo-url>` | Create new workspace |
| `orkestrate init` | Initialize Orkestrate in current project |
| `orkestrate whoami` | Show current auth & config |

### Supported Tools

- **Claude Code** — `orkestrate connect claude`
- **OpenCode** — `orkestrate connect opencode`
- **Cursor** — `orkestrate connect cursor`
- **Windsurf** — `orkestrate connect windsurf`
- **Codex** — `orkestrate connect codex`

## How It Works

1. **`orkestrate login`** opens your browser for OAuth authentication, then stores credentials locally in `~/.config/orkestrate/`.

2. **`orkestrate connect <tool>`** auto-detects your AI coding tool and writes the MCP server configuration pointing to `https://orkestrate.space/api/mcp`.

3. Your AI tools can now coordinate — sharing state, claiming file scopes, and avoiding collisions — all through the Orkestrate MCP protocol.

## What This CLI Does NOT Do

- ❌ Not an AI agent — doesn't write or edit code
- ❌ Not a task runner — doesn't execute prompts
- ❌ Not a git wrapper — doesn't commit or push
- ❌ Not a proxy — MCP traffic goes directly from your tool to Orkestrate

The CLI is purely **setup, wiring, and observability**. The coordination magic happens through MCP.

---

## Links

- **Website**: [orkestrate.space](https://orkestrate.space)
- **GitHub**: [github.com/system1970/Orkestrate](https://github.com/system1970/Orkestrate)

---

© 2026 Orkestrate. Built for the autonomous age.
