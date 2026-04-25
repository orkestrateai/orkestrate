# ByteRover Core — Forked for Orkestrate

This is a stripped-down fork of [ByteRover CLI](https://github.com/campfirein/byterover-cli) focused exclusively on the **memory engine** for personal long-term AI conversations.

## What Was Kept

### Agent Layer (`src/agent/infra/`)
- **`map/`** — Context tree store, agentic map service, LLM map memory
- **`memory/`** — Memory manager, memory deduplicator

### Server Layer (`src/server/infra/`)
- **`context-tree/`** — File-based context tree storage, manifest, merger, snapshot
- **`dream/`** — Background consolidation, synthesis, and pruning operations
- **`executor/`** — Query executor, search executor (BM25 + semantic), direct search responder
- **`storage/`** — File-based blob and key storage adapters

### Shared (`src/shared/`)
- Transport event types
- Context tree type definitions
- Utility functions

## What Was Removed

- CLI commands (`oclif/`)
- TUI interface (`tui/`)
- Web dashboard (`webui/`)
- LLM provider implementations (using Vercel AI SDK instead)
- Coding tools (file ops, bash, grep, etc.)
- MCP server
- Cloud sync / push / pull
- Git version control
- OAuth authentication
- Hub / connectors ecosystem
- Swarm federation
- Agent loop / REPL

## Architecture

ByteRover's memory system works as a **context tree** — a hierarchical knowledge structure that stores curated facts about the user. It supports:

1. **Curation** (`curate`) — Adding knowledge to the tree
2. **Querying** (`query`) — LLM-synthesized answers from the tree
3. **Search** (`search`) — BM25 + semantic retrieval over the tree
4. **Dreaming** (`dream`) — Background consolidation of the tree

## Next Steps

This fork will be adapted for personal conversation memory:
- Replace "project" concept with "conversation session"
- Replace code knowledge with personal facts/preferences/events
- Integrate with Orkestrate's AI SDK streaming backend
- Wire into `desktop/memory-server/`
