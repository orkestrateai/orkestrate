# Orkestrate — Fundamentals

## The Problem

Every AI memory system treats memory as a **storage-and-retrieval problem** — extract facts, embed them, fetch them when semantically similar. This is like building a library and calling it a brain.

Human memory is not a library. It is:
- **Lossy** — you remember gist and feeling, not transcripts
- **Reconstructive** — memories evolve each time you access them
- **Associative** — connected by meaning, emotion, timing, co-occurrence
- **Generative** — combining existing memories creates new thoughts never explicitly experienced
- **Self-organizing** — important memories strengthen, irrelevant ones fade, patterns emerge

The core question: **Can we build a system that remembers like a mind, not a database?**

## What We're Building

A **long-term personal memory agent** — a "second mind" that lives alongside the user, listens to everything they say, builds an evolving model of who they are, and surfaces insights, connections, and contradictions without being asked.

Key properties:
- **Zero-effort memory** — the user never organizes, tags, or creates folders
- **Proactive synthesis** — the agent connects new information to old automatically
- **Honest time-awareness** — knows when things happened, tracks change
- **Contradiction-aware** — doesn't silently overwrite; flags shifts and asks
- **Single-agent ReAct loop** with background memory extraction (not dual-agent)

## The Architecture (PSCM-v3 Era)

```
┌──────────────────────────────────────────────────────┐
│                 CHAT LOOP (ReAct)                     │
│                                                       │
│  User message → ContextBuilder builds LLM context     │
│              → Agent reasoning (max 5 steps)          │
│              → Tool calls (search_memory, web, etc)   │
│              → Response streamed to user              │
│              → Background: memory pipeline fires      │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              CONTEXT BUILDER (context.rs)             │
│                                                       │
│  Assembles the LLM context from:                      │
│  1. System persona prompt (orkestrate.txt)            │
│  2. Compiled user profile (user.md — Identity,        │
│     Projects, Relationships, Preferences, Patterns,   │
│     Open Questions)                                   │
│  3. Continuity summary (session/global mode)          │
│  4. Temporal + environment context                    │
│  5. Auto-retrieved memories (PSCM or legacy)          │
│  6. Compressed conversation history (ContextCompressor│
│     agent, capped at 12K tokens)                      │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│           BACKGROUND MEMORY PIPELINE                  │
│                                                       │
│  After every turn:                                     │
│                                                       │
│  1. Extract latest user+assistant exchange            │
│  2. Queue for batch processing (8 messages/batch)     │
│     OR 100-second timeout                             │
│  3. Store GAM event (semantic shift detection)        │
│  4. Check semantic boundary → compile session summary │
│  5. Every 5 turns → compile global summary            │
│  6. Every N episodes → compiler + gap auditor         │
│                                                       │
│  PSCM parallel ingestion:                             │
│  - Store trace in Tantivy + HNSW index               │
│  - Extract entities via TraceAnalyzer agent           │
│  - Build concept graph with CO_OCCURS edges           │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│          BATCH EXTRACTION PIPELINE (4 Experts)         │
│                                                       │
│  Expert 1: Triage-Extractor                           │
│  - LLM extracts atomic candidates + raw inferences    │
│  - Confidence: explicit (0.6-1.0) / inference(0.3-59) │
│  - Entity extraction                                  │
│                                                       │
│  Expert 1.5: Deduplication (embedding-based)          │
│  - Cosine similarity > 0.90 = duplicate               │
│  - Exact-string pre-filter                            │
│  - Boosts existing importance by +0.05 on duplicate   │
│                                                       │
│  Expert 2: Schema Mapper                              │
│  - Maps candidates to episodes/contradictions         │
│  - Uses semantic context (top-15 similar memories)    │
│  - Strict contradiction detection rules               │
│  - Creates learn queue items for contradictions       │
│                                                       │
│  Expert 3: Compiler                                   │
│  - Rewrites user.md from episodes + contradictions    │
│  - Adaptive frequency: every 5/20/50 episodes         │
│  - Forced when profile is default + 3+ episodes       │
│  - Preserves trajectory in contradictions             │
│                                                       │
│  Expert 4: Gap Auditor                                │
│  - Detects negative space — what HASN'T been said     │
│  - Max 3 gaps per run, severity >= 0.75               │
│  - Creates learn queue items for proactive questions  │
└──────────────────────────────────────────────────────┘
```

## The Agent & Tools

### The ReAct Loop (`agent/mod.rs`)

A single-agent ReAct loop with max 5 reasoning steps per turn.

**Step-by-step flow:**
1. **Context assembly** — `ContextBuilder` builds the full LLM context (persona + profile + continuity + auto-retrieved memories + compressed history)
2. **Auto-memory search** — runs PSCM dual-route retrieval on the latest user message BEFORE the first agent turn; injects results as a system message after the main prompt
3. **LLM call** — streams to OpenCode Zen API (`https://opencode.ai/zen/v1/chat/completions`, model `minimax-m2.5-free`), SSE with `data:` prefix
4. **Tool dispatch** — if the LLM returns tool calls, execute each one via `ToolRegistry`, inject results, loop back to step 3
5. **Response streamed** — content chunks + reasoning chunks + tool call events emitted to frontend via Tauri events
6. **Post-turn persistence** — all new messages saved to SQLite, PSCM ingestion spawned (trace → analyze → embed → graph), legacy memory pipeline spawned

**Streaming details:**
- Content emitted as `chat-chunk` events
- Reasoning emitted as `reasoning-chunk` events (writes to `reasoning_content` or `reasoning` delta field)
- Tool calls accumulated per step by index (supports parallel tool calls)
- Tool results emitted as `tool-result` events
- Side effects emit UI events: `theme-changed`, `model-selected`, `chat-reset`, `memory-search-step`, `web-search-step`, `web-fetch-step`
- Final `done` event signals completion

### Tool Architecture

Every tool implements the `Tool` trait:
```rust
trait Tool: Send + Sync {
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;  // tells the LLM when/why to use it
    fn parameters(&self) -> Value;           // JSON schema for arguments
    async fn execute(&self, args: Value) -> Result<String, String>;
}
```

`ToolRegistry` holds all tools and supports MCP discovery at startup. It serializes to OpenAI-compatible function-calling JSON for the LLM.

### 8 Native Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| **`search_memory`** | 4-channel retrieval across all stored memories | `queries`: 3-7 search strings. Returns episodes with content, type, confidence, importance, decayed_importance, section, relative time. |
| **`store_memory`** | Agent-initiated high-confidence memory storage | `content` (atomic fact), `type` (fact/preference/goal/relationship/habit), `confidence` (>= 0.8). Auto-embeds, auto-extracts entities from capitalized words. |
| **`connect_memories`** | Graph edge between two episodes | `from_episode_id`, `to_episode_id`, `relation` (caused/followed_by/related_to/contradicts/refines), `confidence` (>= 0.7). Verifies both exist. |
| **`web_search`** | Web search via Exa AI | `query`, `numResults` (1-20), `type` (auto/fast/deep), `livecrawl` (fallback/preferred). MCP first, REST fallback. |
| **`web_fetch`** | URL content fetch + convert to readable text | `url`, `format` (text/markdown/html), `timeout` (max 120s). Supports HTML→markdown, PDF text extraction, image detection. 5MB max, 50K char truncation. |
| **`set_theme`** | Toggle light/dark mode | `theme`: `light` or `dark` |
| **`select_model`** | Switch LLM model | `model`: `nemotron-3-super-free`, `minimax-m2.5-free`, `big-pickle` |
| **`reset_chat`** | Clear conversation history | No parameters |

### MCP Tool Wrapper

Dynamically discovers tools from configured MCP servers at startup via `discover_all_tools()`. Creates a fresh MCP client connection per tool call. Registered in the same tool format (name, description, input_schema) so the LLM treats them identically to native tools.

### search_memory — 4-Channel Retrieval (Detailed)

The most important tool. Runs 4 parallel channels fused with adaptive weights:

| Channel | Weight (default) | Method |
|---------|-----------------|--------|
| **Semantic** | 40% | Embed query → cosine similarity vs all stored episode embeddings |
| **Keyword** | 20% | `LIKE` search on extracted keywords from QueryParser agent |
| **Entity Graph** | 25% | Entity name → DB lookup → linked episodes → 1-hop spreading activation with strong decay (0.40 × 0.95) |
| **Temporal** | 15% | Recency score with configurable half-life (default 14 days). Boosted 1.5× when query has temporal intent. |

**Adaptive weights:** The QueryParser agent parses the query for entities, keywords, temporal intent, pronoun resolutions, and contradiction sensitivity. It adjusts channel weights per-query instead of using hardcoded values. The agent also sets recency half-life and enables contradiction injection.

**Fusion (fuse_channels):** Max-pool fusion across channels. Min score threshold 0.09 filters pure noise. Scores combined by channel weight, then sorted.

**Contradiction injection:** If QueryParser flags `contradiction_sensitive`, the tool injects episodes from both sides of known conflicts for all detected entities.

**Output format:** Each result includes `content`, `type`, `confidence`, `importance`, `decayed_importance` (applies 14-day half-life decay at query time), `section`, and `when` (human-readable relative time like "2 hr ago", "3 days ago").

### store_memory — Agent Memory Curation

The agent can proactively store high-confidence observations without going through the batch pipeline:
- Confidence must be >= 0.8 (enforced server-side)
- Auto-generates embedding via Ollama/OpenRouter
- Heuristic entity extraction: scans for capitalized words (skip I/A/The/It), determines type by preceding word ("project X" → "project")
- Maps type to schema section: fact→identity, preference→preferences, goal→goals, relationship→relationships, habit→patterns
- Stores silently — no confirmation to user

### connect_memories — Graph Edge Creation

Agent-level explicit relationship linking between episodes:
- Relations: `caused` (event A caused B), `followed_by` (B happened after A), `related_to` (generic association), `contradicts` (logical conflict), `refines` (B provides more specific version of A)
- Confidence threshold: 0.7
- Verifies both episode IDs exist before storing
- Edge stored in both DB and graph (PSCM graph traversal picks them up)

### Tool Descriptions as Prompt Engineering

Each tool's `description()` field is a prompt injected into the LLM's context as part of the function-calling schema. These descriptions are carefully written to:

- **`search_memory`**: "This is your long-term memory — it contains everything you know about them across all conversations... Call this when the user's question involves anything personal... Generate 3-7 targeted search queries."
- **`store_memory`**: "Only store atomic, specific facts. Do NOT store vague impressions, guesses, or low-confidence observations. This tool stores silently — the user will not see a confirmation."
- **`web_search`**: "Always include the current year in time-sensitive queries."
- **`web_fetch`**: "Use this when the user references a URL, or when web_search results point to a page worth reading in full."

The descriptions act as guardrails — they bias the LLM toward using tools correctly without needing separate system prompt instructions.

### OpenCode Zen API Integration

All LLM calls go through OpenCode Zen:
```
POST https://opencode.ai/zen/v1/chat/completions
Authorization: Bearer {OPENCODE_ZEN_API_KEY}
```

Format is OpenAI-compatible with streaming:
- Request includes `model`, `messages`, `stream: true`, `tools`, `max_tokens`
- Response streams `data: {...}` JSON lines, terminated by `data: [DONE]`
- Tool calls formatted as OpenAI function-calling: `{ id, type: "function", function: { name, arguments } }`

The agent wrapper handles the streaming protocol, accumulating content, reasoning, and tool calls per step. No SDK abstraction — direct `reqwest` HTTP calls.

## The Context Engineering

### ContextBuilder (context.rs)

This is the most important file. It decides what the LLM sees before every reasoning step.

**Components injected into system prompt:**
1. **Persona prompt** — defines voice, rules, tone (embedded or overridable at runtime)
2. **User profile (user.md)** — compiled markdown, capped at 6000 tokens, trimmed by priority section
3. **Continuity summary** — previous session context (mode: session/global/off)
4. **Memory hint** — instructs the agent to use `search_memory` tool when profile is thin
5. **Temporal context** — current time, day, date (so agent is time-aware)
6. **Environment context** — OS info
7. **Session name** — injected if available
8. **Auto-retrieved memories** — PSCM dual-route search runs on the latest user message before every agent turn, injected immediately after the system prompt

**History compression:**
- 12K token budget for conversation history
- Uses **ContextCompressor agent** (PSCM) to score message relevance — not greedy truncation
- Falls back to greedy truncation if agent fails
- Dropped messages get a synthesized summary injected as a system message

**Continuity injection (session mode):**
- On first exchange: loads previous session's summary + last 3 messages
- Searches previous session for messages relevant to current user query
- Deduplicates to avoid redundancy (max 3 messages)
- After first exchange: just shows current session summary

### The Profile Schema (user.md)

A markdown file that evolves over time. Sections by priority:

| Priority | Section | Behavior |
|----------|---------|----------|
| 1 | Identity | Always kept fully |
| 2 | Preferences | Always kept fully |
| 3 | Relationships | Trimmed if over budget |
| 4 | Projects | Trimmed if over budget |
| 5 | Patterns | Trimmed first |
| 6 | Open Questions | Trimmed first |

Default state:
```
## Identity
- Name: Unknown

## Projects

## Relationships

## Preferences

## Patterns

## Open Questions
- [ ] What is your name?
```

## The Philosophy

### 1. The Node is Not Enough

Memory isn't just about storing facts. It's about:
- **Time** — when did you learn this? Has it changed?
- **Confidence** — how sure are we about this?
- **Relationships** — how does this connect to other things?
- **Trajectory** — are you moving toward or away from something?

### 2. Say It, Don't Tag It

The user never organizes anything. The system extracts structure automatically:
- Entity extraction happens via an LLM agent (TraceAnalyzer)
- Schema sections are inferred, not assigned
- Contradictions are detected, not manually flagged

### 3. Two Routes to Memory

The PSCM dual-route retrieval mirrors Kahneman's System 1 / System 2:

**System 1 (Fast Associative):**
- HNSW vector search (embedding similarity)
- Tantivy BM25 (keyword)
- Reciprocal Rank Fusion to combine both
- Returns results in milliseconds

**System 2 (Slow Causal):**
- Concept graph traversal via petgraph
- Follows CO_OCCURS and causal edges from entities in the query
- Returns results in tens of milliseconds

**Composite reranking:**
- Merges both routes
- Applies temporal decay, access count boost, connection boost
- Reranks by combined score

### 4. Memory as Dialogue, Not Deposition

The **Learn Queue** turns memory gaps into conversation:
- Contradictions → questions asking the user to clarify
- Gap observations → proactive questions
- The agent can ask "You used to say X, but lately you've been saying Y. What changed?"
- Makes memory maintenance a natural part of conversation

### 5. Compression Levels

Not all memories are equal:

| Level | Meaning | Example |
|-------|---------|---------|
| Ephemeral | Low confidence, may decay | "User seems interested in photography" (inference) |
| Episodic | Specific events, medium-term | "User mentioned visiting Tokyo in March" |
| Semantic | Durable preferences, relationships | "User prefers text over voice communication" |
| Rule | Core identity — permanent | "User's name is Alex" |

### 6. The Persona Prompt Teaches the Voice

The prompt (orkestrate.txt) defines:
- **No tool narration** — never say "I searched", "I found", "I used tools"
- **No capability listing** — never describe what you can do
- **No pleasantries** — "Great question!" is forbidden
- **Natural memory references** — "You mentioned this last week..." not citations
- **Epistemic integrity** — flag contradictions, don't silently overwrite
- **Default brief** — one sentence if that's enough
- **Familiar tone** — not sycophantic, not robotic

## Main Discoveries

### 1. Batch Extraction > Per-Turn Extraction

Running extraction serially on every turn wastes 70-80% of tokens re-processing the same context. The batch queue:
- Collects 8 exchanges before extracting
- Or flushes after 100 seconds of inactivity
- Reduces LLM API calls by ~87% (1 call per 8 exchanges instead of 1 per turn)
- Background timer scans every 10s for stale buffers

### 2. Dual-Route Retrieval Beats Single-Route

Combining vector similarity with graph traversal catches more relevant memories than either alone:
- Semantic search finds "close in meaning" but misses causal connections
- Graph walk finds connected concepts but misses semantic similarity
- Together they capture associative and causal recall

### 3. Agent-Based Dedup Is Not Enough

The pipeline uses BOTH exact-string pre-filtering AND semantic cosine similarity (threshold 0.90):
- Exact string catches verbatim duplicates cheaply
- Semantic dedup catches paraphrases the exact match misses
- On duplicate, boost existing importance by +0.05 (reinforcement, not discard)

### 4. Contradictions Need Pressure, Not Binary State

Contradictions use a `pressure_score` that increments when new evidence conflicts with existing:
- Single conflicting mention = pressure 1 (low priority)
- Multiple consistent conflicts = pressure 3+ (triggers compiler)
- The compiler preserves trajectory: "You used to prefer X but recently mentioned Y"
- This avoids the classic "last-write-wins" problem where the system silently forgets

### 5. Semantic Boundaries Drive Summary Timing

Embedding drift between consecutive user messages determines when to compile session summaries:
- Running EMA of conversation embedding maintained
- Cosine similarity drop > 0.7 = semantic topic shift
- Triggers summary compilation early instead of waiting for turn counter

### 6. The ContextCompressor Agent Beats Greedy Truncation

Instead of simply dropping the oldest messages when over budget:
- A specialized agent scores each message for relevance to the current query
- Keeps more recent AND more relevant messages
- Synthesizes a summary of dropped content
- Falls back to greedy truncation only if agent fails

### 7. GAM Events Capture Topic Flow

The GAM (Gesture and Movement) event system tracks:
- Every user+assistant turn as an event
- Semantic shift detection via keyword overlap (not embeddings — cheaper)
- Enables temporal queries: "what were we discussing before we switched topics?"

### 8. Proactive Learning Closes the Loop

The learn queue system:
- Contradictions → agent asks user to clarify → extracted as new episodes → cycle continues
- Gap observations → agent asks user to fill in missing info → profile improves
- Makes memory maintenance conversational rather than a settings panel

## Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/context.rs` | ContextBuilder — assembles LLM context from persona, profile, continuity, compressed history |
| `src-tauri/src/prompt/orkestrate.txt` | System persona — defines voice, rules, identity, memory behavior |
| `src-tauri/src/agent/mod.rs` | ReAct loop — manages tool calling, streaming, PSCM ingestion |
| `src-tauri/src/lib.rs` | Tauri commands — bridges Rust backend to Svelte frontend |
| `src-tauri/src/db.rs` | SQLite schema — episodes, contradictions, entities, edges, events, learn queue |
| `src-tauri/src/embed.rs` | Embedding — Ollama primary (768-dim), OpenRouter fallback (2048-dim) |
| `src-tauri/src/vector.rs` | Vector ops — cosine similarity, top-k, recency decay, hybrid merge |
| `src-tauri/src/config.rs` | AppConfig — memory_continuity_mode (session/global/off) |
| `src-tauri/src/memory/triage_extractor.rs` | Expert 1 — atomic extraction from conversation |
| `src-tauri/src/memory/schema_mapper.rs` | Expert 2 — mapping to episodes + contradiction detection |
| `src-tauri/src/memory/compiler.rs` | Expert 3 — rewrites user.md from episodes |
| `src-tauri/src/memory/gap_auditor.rs` | Expert 4 — negative space detection |
| `src-tauri/src/memory/batch_queue.rs` | Batch orchestration — dedup, embedding, 4-expert pipeline |
| `src-tauri/src/memory/recent_summary.rs` | Session/global summary compilation + semantic boundary detection |
| `src-tauri/src/memory/gam.rs` | Semantic shift detection via keyword overlap |
| `src-tauri/src/memory/learn.rs` | Answer processing — extract facts from learn queue responses |
| `src-tauri/src/memory/schema.rs` | user.md I/O |
| `src-tauri/src/pscm/mod.rs` | PSCM init — dual-route retrieval system |
| `src-tauri/src/pscm/retrieve.rs` | 4-phase retrieval: PCL expansion → System-1 HNSV+BM25/RRF → System-2 graph walk → composite rerank |
| `src-tauri/src/pscm/graph.rs` | Concept graph — petgraph with CO_OCCURS edges, PCL expansion |
| `src-tauri/src/pscm/index.rs` | HNSW + Tantivy BM25 index |
| `src-tauri/src/pscm/dream.rs` | Idle-time consolidation (drift detection, causal linking, pruning) |
| `src-tauri/src/pscm/agents/trace_analyzer.rs` | Entity extraction + valence + topic drift |
| `src-tauri/src/pscm/agents/query_parser.rs` | Adaptive fusion weights for retrieval routing |
| `src-tauri/src/pscm/agents/context_compressor.rs` | Relevance-scored history compression |
| `src-tauri/src/pscm/agents/causal_weaver.rs` | Causal link detection between traces |
| `src-tauri/src/agent/mod.rs` | ReAct loop — context building, auto-memory search, streaming, tool dispatch, PSCM/legacy post-turn |
| `src-tauri/src/tools/mod.rs` | Tool trait + ToolRegistry — all tools implement this interface; MCP discovery at startup |
| `src-tauri/src/tools/search_memory.rs` | 4-channel memory retrieval: semantic (40%) + keyword (20%) + entity graph (25%) + temporal (15%), adaptive weights from QueryParser |
| `src-tauri/src/tools/store_memory.rs` | Agent-initiated memory write — auto-embedding, entity extraction, confidence gate >= 0.8 |
| `src-tauri/src/tools/connect_memories.rs` | Graph edge creation between episodes — 5 relation types, confidence gate >= 0.7 |
| `src-tauri/src/tools/web_search.rs` | Exa AI web search — MCP first, REST fallback, livecrawl support |
| `src-tauri/src/tools/web_fetch.rs` | URL fetcher — HTML→markdown conversion, PDF text extraction, 5MB/50K char caps |
| `src-tauri/src/tools/set_theme.rs` | Toggle light/dark theme |
| `src-tauri/src/tools/select_model.rs` | Switch LLM model (nemotron/minimax/big-pickle) |
| `src-tauri/src/tools/reset_chat.rs` | Clear conversation history |
| `src-tauri/src/tools/mcp_wrapper.rs` | Dynamic MCP tool wrapper — fresh connection per call |
| `src-tauri/src/timer.rs` | Instrumentation — no-op by default, can be enabled by uncommenting print lines |
| `src/` (Svelte) | Frontend — ConceptGraph, MemoryPanelV2, SettingsModal, Sidebar |
