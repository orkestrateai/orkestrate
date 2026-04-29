# Orkestrate Agent & UI Development Plan

**Version:** 1.0
**Date:** 2026-04-27
**Goal:** Extend the chat agent with web search, web fetch, and MCP tool support. Build out the interface with proper settings, onboarding, and input features.

---

## The Problem

The current chat agent can only search its own memory (`search_context`). It has no ability to:
- Look up real-time information from the web
- Fetch and read URLs the user provides
- Discover and use tools from MCP servers
- Provide a polished onboarding or settings experience

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    CHAT AGENT (backend)                   │
│                                                           │
│  chat_handler (axum route)                                │
│  ├── search_context  (memory, existing)                   │
│  ├── web_search      (Exa AI, planned)                    │
│  ├── web_fetch       (URL reader, planned)                │
│  ├── MCP tools       (dynamic discovery, planned)         │
│  └── tool registry   (unified dispatch)                   │
│                                                           │
│  All tools follow #[tool] macro pattern                   │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│                    FRONTEND                                │
│                                                           │
│  ChatInput     SettingsModal     Onboarding               │
│  ├── Send btn  ├── General       ├── Welcome flow         │
│  ├── Attach    ├── Appearance    ├── First message        │
│  ├── Voice     ├── System        └── Teach memory         │
│  ├── Sources   ├── Chat                                   │
│  └── Apps      ├── Subscription                           │
│                 └── Support                               │
└──────────────────────────────────────────────────────────┘
```

---

## Phased Implementation

### Phase 1: Web Tools (Agent Backend)

Add `web_search` and `web_fetch` tools so the agent can browse the real-time web.

- `web_search` — Exa AI API
  - Params: `query`, `num_results` (1-20), `type` (auto/fast/deep)
  - Returns title, URL, snippet
- `web_fetch` — URL content fetch
  - Params: `url`, `format` (text/markdown/html), `timeout` (120s)
  - HTML→markdown conversion, PDF text extraction
  - 5MB max, 50K char truncation
- Craft tool descriptions that teach the LLM when to use each
- Register via `.with_tool()` in `chat_handler`

**Files:** `src-tauri/src/tools/web_search.rs`, `web_fetch.rs`, `mod.rs`

### Phase 2: MCP Integration

Dynamically discover tools from configured MCP servers at startup.

- `McpRegistry` — holds MCP client connections
- `discover_all_tools()` — connects to servers, lists available tools
- Wrap each MCP tool in the `Tool` trait interface
- Fresh connection per tool call
- MCP server config stored in `AppConfig`

**Files:** `src-tauri/src/tools/mcp_registry.rs`, `mcp_wrapper.rs`, `config.rs`

### Phase 3: Unified Tool Registry

Central `ToolRegistry` for all tools (native + MCP). Single `.with_tools()` call in handler.

- `.register(tool)` + `.all_tools()` methods
- Auto-serializes to OpenAI function-calling JSON

### Phase 4: Settings Modal - Remaining Tabs

**System tab:** Model selection, API key config, MCP server URLs, logging level
**Chat tab:** System prompt overrides, memory continuity mode, max tool steps, temperature
**Subscription:** Plan info, usage stats, upgrade button
**Support:** FAQ, feedback, version info, debug export

### Phase 5: Onboarding Process

First-run experience: Welcome → Teach your name → First message → Done

- Check `localStorage` for `onboarding-completed`
- Steps: welcome → teach_name → first_message → completed
- Can be skipped with "Skip onboarding"
- Stores name as first memory entry

**Files:** `src/components/onboarding/*.tsx`

### Phase 6: Chat Input Icons

Wire up the 4 action buttons in `ChatInput.tsx`:

| Button | Icon | Action |
|--------|------|--------|
| + | `Plus` | File picker / attachment |
| Sliders | `SlidersHorizontal` | Toggle reasoning mode |
| Telescope | `Telescope` | Toggle sources/web search |
| Mic | `Mic` | Voice input → whisper → insert text |

---

## Files to Create

| File | Phase |
|------|-------|
| `src-tauri/src/tools/mod.rs` | 1 |
| `src-tauri/src/tools/web_search.rs` | 1 |
| `src-tauri/src/tools/web_fetch.rs` | 1 |
| `src-tauri/src/tools/mcp_registry.rs` | 2 |
| `src-tauri/src/tools/mcp_wrapper.rs` | 2 |
| `src-tauri/src/config.rs` | 2 |
| `src/components/onboarding/*.tsx` | 5 |

## Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `src-tauri/src/ai/handler.rs` | 1 | Add `.with_tool(web_search())`, `.with_tool(web_fetch())` |
| `src-tauri/src/lib.rs` | 2 | Init MCP registry on startup |
| `src-tauri/Cargo.toml` | 1 | Add `reqwest`, `scraper`, `mcp-client` deps |
| `src/components/modals/SettingsModal.tsx` | 4 | System, Chat, Subscription, Support tabs |
| `src/components/chat/ChatLayout.tsx` | 5 | Mount OnboardingFlow |
| `src/components/chat/ChatInput.tsx` | 6 | Wire button onClick handlers |

---

## Dependencies

- **Exa AI** — Web search API (API key in `.env`)
- **`reqwest`** — HTTP client for web_fetch
- **`scraper`** or **`html2md`** — HTML→markdown
- **MCP client** — `mcp-client-rs` or check if aisdk has MCP support
- **Tauri file dialog** — `tauri-plugin-dialog` for attachments
- **Web Speech API** — Voice input (frontend-side)
