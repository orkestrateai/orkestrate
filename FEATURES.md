# Orkestrate Feature Inventory

> Last updated: 2026-04-24

## 1. Core Conversation

| Feature | Description |
|---|---|
| Streaming Chat | Real-time response streaming with reasoning chain display |
| ReAct Agent Loop | Multi-step reasoning (max 5 steps) with tool calling |
| Session Management | Create, list, delete, and clear chat sessions |
| Auto Session Names | First user+assistant exchange generates a session title |
| Message Persistence | All messages stored in SQLite with full metadata |
| Dark-Only UI | Consistent dark theme throughout the app |

---

## 2. Memory Architecture (5 Layers)

| Layer | Description |
|---|---|
| **Working Memory** | 5,000-token conversation window, truncated via tiktoken (cl100k_base) |
| **Episodic Memory** | Atomic facts in SQLite: 2048-dim embeddings, confidence, importance, compression level |
| **Semantic Memory** | Compiled `user.md` profile: Identity, Projects, Relationships, Preferences, Patterns, Open Questions |
| **Consolidated Memory** | Contradictions (pressure scores), gap observations, session/global summaries |
| **Prospective Memory** | Not implemented (no trigger table or IF-THEN system) |

---

## 3. Background Extraction Pipeline

### 4-Expert Batch Pipeline

| Expert | Role | Trigger |
|---|---|---|
| **Triage Extractor** | Atomic fact + inference extraction from conversation exchanges | Every 8 messages or 5-minute timeout |
| **Schema Mapper** | Maps candidates to schema sections, detects contradictions | After extractor, with semantic context (top-15 neighbors) |
| **Compiler** | Rewrites `user.md` from episodes + contradictions | Episode count thresholds (3/10/25) or high-pressure contradiction |
| **Gap Auditor** | Detects negative space (what hasn't been said) | After compiler, max 3 most severe gaps |

### Technical Details

| Feature | Description |
|---|---|
| Batch Queue | 8-message batch or 300-second timeout |
| Parallel Embeddings | Semaphore-limited to 5 concurrent OpenRouter requests |
| Backpressure | Max 2 concurrent flushes; excess queued |
| Semantic Dedup | 0.90 cosine threshold + exact string pre-filter + 0.05 importance boost on match |
| Contradiction Detection | Existing episode vs. new evidence comparison |
| Recency Decay | `exp(-days/14)` applied to episode importance scores |
| Semantic Boundary | Drift > 0.7 or 10 turns triggers early summary compilation |
| Summary Compilation | Session summaries every 3 turns; global summaries every 5 turns |

---

## 4. Profile Compilation (user.md)

| Feature | Description |
|---|---|
| Dynamic Rewrite | Compiler regenerates `user.md` from raw episodes + active contradictions |
| Episode Thresholds | Early user: every 3 episodes; growing: every 10; mature: every 25 |
| Default Override | Forces compilation when default profile exists but >= 3 episodes stored |
| Batch Compilation | Background flushes now also trigger compiler (not just chat turns) |
| Token Cap | Profile capped to ~2,500 tokens to prevent context bloat |
| Section Priority | Identity and Preferences kept first; others trimmed if over budget |

---

## 5. Tools

### Built-in Tools

| Tool | Description |
|---|---|
| `search_memory` | Hybrid 70% semantic + 30% lexical search over all stored episodes |
| `web_search` | Exa AI web search with REST fallback (BYOK) |
| `web_fetch` | HTML to markdown conversion + PDF text extraction |
| `store_memory` | Agent silently stores atomic facts (confidence >= 0.8) |

### MCP Integration

| Feature | Description |
|---|---|
| Custom JSON-RPC Client | Lightweight alternative to rmcp crate |
| HTTP + Stdio Transport | Supports both local and remote MCP servers |
| Dynamic Tool Discovery | Runtime tool registration from MCP servers |
| Settings UI | JSON config editor for server management |

---

## 6. Learn Panel

### Queue Management

| Feature | Description |
|---|---|
| Auto-Population | Gaps and contradictions automatically create learn queue items |
| Priority Ordering | Contradictions (by pressure score) prioritized over gaps (by age) |
| Dismiss / Snooze | Skip items without answering; snooze defers them |

### Conversation Flow

| Feature | Description |
|---|---|
| Background Generation | Questions pre-generated when queue items are created — not when panel opens |
| Persistent History | `__learn__` session stores full Q&A; close/reopen retains thread |
| No Mid-Stream Loss | Assistant responses saved to DB during streaming, survive panel close |
| Answer Processing | Extracts atomic facts, marks item addressed, triggers next question |
| Contradiction Resolution | Resolves underlying contradiction, deprecates old episode (importance -> 0.2) |

---

## 7. Context & Continuity

### Continuity Modes (Configurable)

| Mode | Behavior |
|---|---|
| **Session** | First exchange injects previous session summary + last 3 messages |
| **Global** | Injects global rolling summary across all sessions |
| **Off** | No summary injection beyond current session's own summary |

### Auto Context Injection

| Feature | Description |
|---|---|
| Compiled Profile | `user.md` injected into every system prompt |
| Temporal Context | Current time, day, and date included |
| Environment Context | OS information included |
| Auto Memory Search | User message embedded; top 5 episodes retrieved and injected before every request |
| Memory Hint | System prompt reminds agent to use `search_memory` when profile seems thin |

---

## 8. UX Polish

### Chat Behavior

| Feature | Description |
|---|---|
| Sticky Scroll | Auto-scrolls on new chunks only when user is within 200px of bottom |
| Scroll Button | Compact circular button at bottom-right; pulse indicator when streaming while scrolled up |
| Send Lock | Input and send button disabled while streaming; placeholder changes to "Orkestrate is thinking..." |
| Tool Step Indicators | Visual badges for memory search, web search, web fetch steps |

### Empty State

| Feature | Description |
|---|---|
| Personalized Chips | LLM-generated suggestions from profile + recent chat + summaries + learn queue + episodes |
| User-Centric Prompts | Action-oriented suggestions (commands and memory queries, not greetings) |
| Fallback Generics | Default chips when profile is empty |

### Key Management

| Feature | Description |
|---|---|
| Embedding Key | `OPENROUTER_KEY` for OpenRouter embeddings only |
| LLM Key | `OPENCODE_ZEN_API_KEY` for all chat/model calls |
| Strict Separation | Embedding functions fetch their own key internally; pipeline code never mixes them |

---

## 9. Not Yet Implemented (Roadmap)

| Feature | Status | Blocker |
|---|---|---|
| Two-Agent Alpha+Omega Preflight | Reverted | Latency (+2-4s) vs. quality tradeoff |
| Knowledge Graph (entities + edges) | Not started | Entity disambiguation schema design |
| Prospective Memory Triggers | Not started | Trigger representation + false-positive suppression |
| Automated Sleep Cycle | Partial | No scheduled background task for full consolidation |
| Dynamic Memory Scoring | Partial | Static importance only; no access/connection boosting |
| Agent Memory Mutation | Read-only | `update_memory`, `connect_memories` restricted |
| Multimodal Memory | Not started | Text-only currently |

---

## Summary

**47 features implemented** across 8 categories:
- Core Conversation: 6
- Memory Architecture: 5
- Background Pipeline: 11
- Profile Compilation: 6
- Tools: 5
- Learn Panel: 6
- Context & Continuity: 7
- UX Polish: 6

**9 roadmap items** deferred for future phases.
