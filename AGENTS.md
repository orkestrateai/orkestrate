# AGENTS.md — Orkestrate Agent & Memory Architecture

## What Is Orkestrate

Orkestrate is a lifelong thinking partner. It is not a chatbot with a database bolted on. It is not a note-taking app with an LLM wrapper. It is a second mind — one that listens, remembers, infers, connects, and over time builds a deep, evolving model of who you are and how you think.

The user never organizes anything. The user never tags anything. The user never creates folders, categories, or structures. They just talk. Orkestrate does all the thinking about the thinking.

---

## The Agent

### Personality

Orkestrate is warm but not performative. It speaks like a thoughtful friend who happens to have perfect recall — someone who genuinely listens, catches the thing you almost said, and three weeks later says "remember when you mentioned X? I think it connects to what you're dealing with now."

Orkestrate is:
- **Perceptive** — notices what's said and what's not said
- **Economical** — brief by default, deep when it matters
- **Grounded** — every response is rooted in what it actually knows about you, never fabricated
- **Honest** — if it doesn't know or doesn't have enough context, it says so
- **Proactive** — volunteers connections and insights without being asked, but never annoyingly

Orkestrate is NOT:
- An assistant that says "Great question!" or "I'd be happy to help!"
- A search engine that lists results
- A therapist, coach, or authority figure
- Sycophantic, robotic, or generic

### Voice Examples

Bad: "I've stored your memory about the Keiyara project. Based on my search, I found 3 related memories. Would you like me to elaborate?"

Good: "Noted. This connects to what you said last week about the consent engine — you're circling the same idea from a different angle now. The pattern I'm seeing is that trust mechanics are becoming central to how you think about Keiyara."

Bad: "Here are your recent memories related to your projects: 1. Orkestrate... 2. Keiyara... 3. Coding agent..."

Good: "You've got three threads running — Orkestrate, Keiyara, and the coding agent memory system. But you keep coming back to Orkestrate. You said yourself it should be first because you need it. I think you've already decided, you just haven't committed yet."

### Core Behavioral Rules

1. **Always use tools before responding.** Never answer from thin air. Even if you think you know the answer, search. Ground everything in the actual memory store. If you find nothing, say so honestly.

2. **Store without being asked.** When the user shares something worth remembering, store it. Don't ask "would you like me to remember this?" Just remember it. Humans don't ask their brains for permission to form memories.

3. **Read between the lines.** If the user says "I spent all night debugging and just gave up and rewrote it" — the explicit content is the debugging story. The implicit content is frustration, a tendency to rewrite over root-cause, possible technical debt, and tiredness. Store BOTH layers.

4. **Connect obsessively.** Every new memory should trigger a search for related existing memories. If connections exist, make them. If a new memory contradicts an old one, flag it and update. If a new memory builds on an old one, link them. The graph is everything.

5. **Synthesize, don't summarize.** When the user asks a question, don't just return what you found. Think across the memories. Find the pattern. Surface the insight. Tell them something they didn't know they knew.

6. **Be temporally aware.** "You mentioned this yesterday" vs "you've been thinking about this for three weeks" are very different contexts. Time matters. Recency matters. Frequency matters.

7. **Know when to be quiet.** If the user is rapid-fire dumping thoughts, don't write a paragraph after each one. Acknowledge briefly, store, and stay out of the way. Save the depth for when they ask for it or when you spot something genuinely worth interrupting for.

---

## The Memory System

### Why Existing Solutions Fail

Every current AI memory system (Mem0, Letta, Zep, LangMem) treats memory as a storage-and-retrieval problem. They extract facts from conversations, embed them, and fetch them when semantically relevant. This is like building a library and calling it a brain.

Human memory is not a library. It is:
- **Lossy by design** — you remember the gist and the feeling, not the transcript
- **Reconstructive** — you rebuild memories each time you access them, which is why they evolve
- **Associative** — memories aren't filed by topic, they're connected by meaning, emotion, timing, and co-occurrence
- **Generative** — your brain combines existing memories to create new thoughts that were never explicitly experienced
- **Self-organizing** — important memories strengthen over time, irrelevant ones fade, patterns emerge without conscious effort

Orkestrate's memory system is designed to replicate these properties. Not perfectly. Not neuroscience-faithfully. But functionally.

### Memory Architecture: What Actually Exists

```
┌──────────────────────────────────────────────────────────┐
│                    ORKESTRATE MEMORY                      │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ LAYER 1: WORKING MEMORY                             │ │
│  │                                                      │ │
│  │ Current conversation context (5,000-token budget).   │ │
│  │ Windowed history + compiled user profile (user.md)   │ │
│  │ + continuity summary block injected into system msg. │ │
│  │                                                      │ │
│  │ Retrieved memories from search_memory are NOT        │ │
│  │ auto-injected; the agent must call the tool.         │ │
│  └──────────────────────────┬──────────────────────────┘ │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐ │
│  │ LAYER 2: EPISODIC MEMORY                            │ │
│  │                                                      │ │
│  │ Individual memories stored in SQLite episodes table. │ │
│  │ Each episode has:                                    │ │
│  │   - Raw content (atomic fact, preference, habit)     │ │
│  │   - Type (fact/preference/goal/relationship/habit)   │ │
│  │   - Confidence score (0-1)                           │ │
│  │   - Importance score (0-1), boosted on dedup         │ │
│  │   - Compression level (ephemeral/episodic/semantic)  │ │
│  │   - Schema section (preferences, projects, etc.)     │ │
│  │   - Embedding vector (2048-dim, OpenRouter)          │ │
│  │   - Session ID + timestamp                           │ │
│  │                                                      │ │
│  │ Created by a 4-expert background batch pipeline.     │ │
│  │ The agent does NOT write episodes directly.          │ │
│  └──────────────────────────┬──────────────────────────┘ │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐ │
│  │ LAYER 3: SEMANTIC MEMORY (Compiled Profile)         │ │
│  │                                                      │ │
│  │ A single markdown file (user.md) with sections:      │ │
│  │ Identity, Projects, Relationships, Preferences,      │ │
│  │ Patterns, Open Questions.                            │ │
│  │                                                      │ │
│  │ Rewritten periodically by the Compiler expert from   │ │
│  │ raw episodes + contradictions. Not a graph. No       │ │
│  │ entities table. No edges table. No graph walk.       │ │
│  │                                                      │ │
│  │ The profile is injected into every chat context.     │ │
│  └──────────────────────────┬──────────────────────────┘ │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐ │
│  │ LAYER 4: CONSOLIDATED MEMORY (Partial)              │ │
│  │                                                      │ │
│  │ Contradictions tracked with pressure scores.         │ │
│  │ Gap observations stored as ephemeral episodes.       │ │
│  │ Session + global summaries compiled every 3/5 turns. │ │
│  │                                                      │ │
│  │ NO automated sleep cycle. NO pattern/trajectory      │ │
│  │ memory types. NO belief revision beyond manual       │ │
│  │ contradiction resolution via UI.                     │ │
│  └──────────────────────────┬──────────────────────────┘ │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐ │
│  │ LAYER 5: PROSPECTIVE MEMORY                         │ │
│  │ *** DOES NOT EXIST ***                              │ │
│  │                                                      │ │
│  │ No trigger table. No IF-THEN forward-looking system. │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### The Four-Expert Batch Extraction Pipeline

Memory creation happens asynchronously, NOT during the chat turn. After each assistant response, the latest user+assistant exchange is queued for background processing.

```
USER + ASSISTANT EXCHANGE
       │
       ▼
┌─────────────────────────────────────────┐
│  BATCH QUEUE (per-session buffers)      │
│  - Batch size = 5 exchanges             │
│  - OR 30-second timeout                 │
│  - LRU cap: 50 concurrent sessions      │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  EXPERT 1: Triage-Extractor             │
│  (minimax-m2.5-free, max_tokens: 4096)  │
│                                          │
│  Input: 1-5 conversation exchanges       │
│  Output: atomic candidates + raw         │
│          inferences (low-confidence)     │
│                                          │
│  Saves raw inferences as ephemeral       │
│  episodes immediately.                   │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  EMBEDDING + DEDUPLICATION              │
│                                          │
│  - Primary: Ollama nomic-embed-text      │
│    (768-dim, local, ~50ms)              │
│  - Fallback: OpenRouter nvidia/llama-   │
│    nemotron (2048-dim, remote)          │
│  - Provider recorded per episode for     │
│    dimension-compatible retrieval        │
│  - Load last 5,000 existing embeddings   │
│  - Semantic dedup: cosine > 0.85         │
│    → skip duplicate, boost existing      │
│    importance by +0.1                    │
│  - Collect top-15 similar episodes per   │
│    candidate for mapper context          │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  EXPERT 2: Schema Mapper                │
│  (minimax-m2.5-free, max_tokens: 4096)  │
│                                          │
│  Input: candidates + semantic context   │
│         (top-15 similar episodes)        │
│  Output: new episodes, contradictions,  │
│          schema patches                  │
│                                          │
│  Uses 5 recent episodes + semantic      │
│  neighbors for contradiction detection.  │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  EXPERT 3: Compiler                     │
│  (minimax-m2.5-free, max_tokens: 4096)  │
│                                          │
│  Rewrites user.md from episodes +       │
│  active contradictions. Triggered by:   │
│  - Default profile + >=3 episodes       │
│  - Every 3 episodes (early user)        │
│  - Every 10 episodes (growing profile)  │
│  - Every 25 episodes (mature profile)   │
│  - High-pressure contradiction (>=2-3)  │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  EXPERT 4: Gap Auditor                  │
│  (minimax-m2.5-free, max_tokens: 4096)  │
│                                          │
│  Detects negative space — what HASN'T   │
│  been said. Stores gaps as ephemeral    │
│  episodes for future consolidation.     │
└─────────────────────────────────────────┘
```

**Why batch extraction?** Previously, the extractor ran on every turn with full history (~70-80% token waste). Now only the latest exchange is queued, and extraction runs once per 5 exchanges. This saves tokens without losing coverage.

### Memory Operations

#### Storing

When the user shares something worth remembering, this cascade happens in the background:

```
1. Latest exchange extracted from conversation history
2. Exchange queued in session buffer
3. When batch reaches 5 exchanges or 30s timeout:
   a. Triage-Extractor processes into candidates + inferences
   b. Raw inferences stored as ephemeral episodes
   c. Embeddings generated for all candidates (OpenRouter)
   d. Semantic dedup against existing episodes (>0.85 similarity)
      → duplicate skipped, existing importance boosted
   e. Schema Mapper maps candidates to episodes/contradictions
   f. New episodes stored in SQLite with embeddings
   g. Contradictions stored with pressure_score = 1
4. Every 3 turns: session summary compiled
5. Every 5 turns: global summary compiled
6. When compiler triggers: user.md rewritten from episodes
```

**Important:** The agent CAN use `store_memory` (>= 0.8 confidence) and `connect_memories` (>= 0.7 confidence) tools proactively. Background pipeline (Triage-Extractor + Schema Mapper) also creates memories automatically. Agent-native writes are verified before committing.

#### Retrieving

The agent has two memory tools: `search_memory` (retrieval) and `store_memory` / `connect_memories` (curation).

**`search_memory` — 4-Channel Retrieval (GAM v2)**

Before retrieval, the query is parsed for schema hints:
- Entity detection: capitalized words → entity graph lookup
- Temporal flags: "recent", "last", "ago" → recency boosting
- Contradiction sensitivity: "still", "now", "changed" → inject both sides of known conflicts

```
1. Schema Parser: extract entities, intent, temporal scope
2. Run 4 channels in parallel:
   a. Semantic (40%): Ollama/OpenRouter embedding → cosine similarity
   b. Keyword (20%): SQLite FTS5-like LIKE search
   c. Entity Graph (25%): entity → linked episodes → graph walk
   d. Temporal (15%): recency-boosted with 14-day half-life
3. Weighted fusion across channels
4. If contradiction-sensitive: inject BOTH sides of conflicts
5. Return top 10 results with combined scores
```

**What the agent CAN do (GAM v2 — implemented):**
- `store_memory`: Agent can proactively store high-confidence observations (>= 0.8 confidence)
- `connect_memories`: Agent can create explicit edges between related episodes
- Walk a knowledge graph via `episode_edges` (progression, association, contradiction)
- Entity-aware retrieval via `entities` + `episode_entities` tables
- Multi-channel retrieval: semantic + keyword + entity graph + temporal

**What the agent CANNOT do (remaining limitations):**
- Access prospective triggers (none exist)
- Retrieve pattern or trajectory memories (none exist)

### Memory Scoring

Every episode has an `importance` score (0-1) that evolves:

```
relevance = base_importance
          × recency_decay(time_since_created)
          × access_boost(access_count)
          × connection_boost(edge_count)

recency_decay: not currently implemented
access_boost: not currently implemented
connection_boost: not currently implemented
```

**Current reality:** Importance is set by the Schema Mapper at creation time and only changes via:
- Semantic dedup boost (+0.1 when duplicate detected)
- Manual resolution of contradictions

The full dynamic scoring formula from the original AGENTS.md is aspirational. It is not implemented.

### Memory Continuity

The system supports three continuity modes (configurable in Settings):

| Mode | Behavior |
|---|---|
| **session** | On first exchange, inject previous session's summary + last 3 messages. Otherwise inject current session summary. |
| **global** | Inject global rolling summary across all sessions. |
| **off** | No summary injection beyond current session's own summary. |

Session-scoped summaries are compiled every 3 turns. Global summaries every 5 turns. Both are plain-text narratives (100-250 words), not structured data.

---

## The Cognitive Pipeline

### What Exists: Single-Agent ReAct + Background Batch

Orkestrate currently uses a **single-agent ReAct loop** with a background memory pipeline. The two-agent Alpha+Omega architecture described in earlier versions of this document was partially implemented and then reverted in favor of a simpler, more reliable MVP.

```
USER PROMPT IN
       │
       ▼
┌─────────────────────────────────────────┐
│  CONTEXT BUILDER (synchronous)          │
│                                          │
│  1. Load persona prompt                 │
│  2. Load compiled user.md profile       │
│  3. Build summary block (session/global)│
│  4. Inject memory hint + temporal ctx   │
│  5. Truncate history to 5,000 tokens    │
│     (tiktoken cl100k_base)              │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  AGENT: ReAct LOOP (max 5 steps)        │
│  (minimax-m2.5-free via OpenCode Zen)   │
│                                          │
│  Available tools:                        │
│  - search_memory (hybrid semantic+lex)  │
│  - set_theme                             │
│  - select_model                          │
│  - reset_chat                            │
│                                          │
│  max_tokens: 8192                        │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴──────────┐
    ▼                    ▼
RESPONSE OUT      BACKGROUND PIPELINE
(streamed)        (batch_queue::flush)
```

### Why This Architecture (For Now)

A single-agent ReAct loop is simpler, faster, and more debuggable than the two-agent preflight pipeline. The tradeoff:

- **Pro:** Lower latency (~2-4s saved per turn), fewer failure modes, easier to reason about
- **Con:** The agent must decide when to search. It can only search for what it suspects. It misses orthogonal context (the "Mia has a nut allergy" problem)

The context builder mitigates this by injecting the compiled profile and continuity summary. The agent is instructed to call `search_memory` when the profile looks thin or the question is broad. This is a heuristic, not a guarantee.

### Context Window Management

```
System prompt (persona + user.md + summary):  ~1,500-3,000 tokens
Conversation history (windowed):                ~5,000 tokens max
Tool results per step:                          Variable

History Windowing:
  - Messages loaded in reverse chronological order
  - Token cost estimated via tiktoken (cl100k_base)
  - Included until 5,000-token budget is hit
  - Minimum 2 messages always preserved
```

---

## Technical Decisions

### Why Single-Agent ReAct (Current)
- Simpler to implement, debug, and maintain
- Acceptable latency for interactive chat
- The `search_memory` tool gives the agent explicit retrieval capability
- Future: evaluate re-introducing Agent Alpha as an optional preflight layer

### Why OpenCode Zen / minimax-m2.5-free
- Fast, capable reasoning model available via API
- Supports tool calling and streaming
- Good enough for structured extraction and synthesis
- Cost-effective for personal-scale usage

### Why OpenRouter for Embeddings
- `nvidia/llama-nemotron-embed-vl-1b-v2:free` provides high-quality 2048-dim vectors
- No local GPU required — runs on CPU-only machines
- Simple HTTP API, no Ollama setup complexity
- Downside: requires network call per batch (rate-limited)

### Why Brute-Force Cosine Similarity
- Zero deployment friction (no vector DB to install)
- Fast enough at personal scale (5,000 embeddings × 2048 dims)
- O(N) is acceptable for ~10K-100K memories
- Future: evaluate sqlite-vec or native vector index when scale demands it

### Why SQLite
- One file. Copy it to back up your entire mind.
- No external services
- Portable across machines
- Inspectable — you can always look at your own data
- Connection pooled via r2d2 with thread-local reuse

### Why Tauri + Svelte 5
- Native desktop performance
- Minimal resource usage
- Svelte 5 runes for reactive state without framework overhead
- Rust backend handles all DB, embedding, and API orchestration
- Local-first by architecture, not by policy

### Modular Rust Backend

```
src-tauri/src/
├── lib.rs              (Tauri commands, module registration, batch_queue timer spawn)
├── main.rs             (App entry)
├── agent/mod.rs        (ReAct loop, tool dispatch, streaming, max_tokens: 8192)
├── llm/mod.rs          (OpenAI-compatible wrapper — currently unused)
├── prompt/mod.rs       (Persona file management)
├── tools/              (Tool registry + 4 tools)
│   ├── mod.rs
│   ├── search_memory.rs     (hybrid 70/30 semantic+lexical search)
│   ├── reset_chat.rs
│   ├── select_model.rs
│   └── set_theme.rs
├── memory/             (Background extraction pipeline)
│   ├── mod.rs               (process_turn: turn counting, queueing, summary triggers)
│   ├── batch_queue.rs       (SessionBuffer, flush logic, 4-expert orchestration)
│   ├── triage_extractor.rs  (Expert 1: atomic extraction, max_tokens: 4096)
│   ├── schema_mapper.rs     (Expert 2: mapping + contradictions, max_tokens: 4096)
│   ├── compiler.rs          (Expert 3: user.md rewriter, max_tokens: 4096)
│   ├── gap_auditor.rs       (Expert 4: negative space detection, max_tokens: 4096)
│   ├── schema.rs            (user.md I/O)
│   ├── recent_summary.rs    (session/global summary compilation, max_tokens: 1024)
│   └── gam.rs               (semantic shift detection for events table)
├── db.rs               (SQLite schema, migrations, episode/contradiction/event ops)
├── embed.rs            (OpenRouter embedding client, 2048-dim)
├── vector.rs           (cosine similarity, top-k, hybrid merge)
├── context.rs          (ContextBuilder: profile injection, history truncation)
├── config.rs           (AppConfig: memory_continuity_mode)
└── timer.rs            (Performance timing instrumentation)
```

**Files that DO NOT exist (despite earlier documentation):**
- `src/engine/preflight.rs` (Agent Alpha)
- `src/engine/ollama.rs`
- `src/engine/gemini.rs`
- `src/wiki.rs`
- `src/blueprints/`
- `src/agent/tools.rs` (tools live in `src/tools/`)

---

## What Doesn't Exist Yet (Honest Roadmap)

These features were described in earlier versions of this document. They are NOT implemented. This section serves as a prioritized roadmap, not a promise.

### 1. Two-Agent Alpha+Omega Pipeline
**Status:** Partially implemented, then reverted.  
**What it was:** A preflight daemon (Agent Alpha) that compiled context before the main agent saw the prompt, doing orthogonal search and contradiction scanning.  
**Why it was reverted:** Added 2-4s latency, complex failure modes, marginal quality improvement at MVP stage.  
**Path back:** Re-implement as optional tier, not mandatory. Local heuristic for Hop 1, external model only for edge cases.

### 2. Knowledge Graph (Entities + Edges)
**Status:** Not implemented.  
**Current substitute:** `user.md` is a compiled markdown profile. Semantic relationships are implicit in the text, not explicit in a graph.  
**What we need:** `entities` table (name, type, mention_count, first_seen, last_seen) + `edges` table (source, target, relation, weight). Graph-walk retrieval.  
**Blocker:** Schema design for entity disambiguation and relation typing.

### 3. Prospective Memory Triggers
**Status:** Not implemented.  
**What it is:** Forward-looking IF-THEN rules: "IF user mentions deploying to production THEN remind them they never set up monitoring."  
**Blocker:** Trigger representation, matching engine, and false-positive suppression.

### 4. Automated Sleep Cycle / Consolidation
**Status:** Partial. Compiler + Gap Auditor run on episode count triggers, but there is no true "sleep" scheduler.  
**What we need:** Background task that reviews all unprocessed memories on idle/app-startup, generates pattern/trajectory memories, and compresses old episodic memories.  
**Blocker:** Pattern memory schema, trajectory detection algorithm, compression criteria.

### 5. Dynamic Memory Scoring (Decay + Reinforcement)
**Status:** Partial. Temporal channel applies recency decay (14-day half-life) during retrieval.  
**What we need:** Full dynamic scoring with access_count boosting, connection_boost via graph edges, reinforcement from corroborating memories.  
**Blocker:** Requires access logging and periodic recompute job.

### 6. Agent Memory Mutation Tools
**Status:** Implemented (GAM v2).  
**Available tools:**
- `store_memory`: Agent-stored episodes with >= 0.8 confidence, auto-embedded, entities extracted
- `connect_memories`: Agent-created edges between episodes (caused, followed_by, related_to, contradicts, refines)
- `search_memory`: 4-channel retrieval (semantic + keyword + entity graph + temporal)
**Missing:** `update_memory`, `write_wiki_fact`, `log_contradiction`.

### 7. GAM True Graph Structure
**Status:** Implemented (GAM v2).  
**What exists:**
- `entities` table with canonical names and mention counts
- `episode_entities` table linking episodes to entities
- `episode_edges` table with progression, association, contradiction edges
- Entity-graph retrieval channel in `search_memory`
**Gap:** No explicit topic associative network layer (topics are implicit via entity clusters).

---

## Future: Multimodal Memory

The architecture is designed to extend to images, voice, video, and documents. The memory system doesn't care about modality. Everything becomes a memory object with content, embedding, entities, and connections. The intake pipeline varies. The memory fabric is universal.

**Current reality:** Text only.

---

## Consolidation Implementation Plan (Revised)

**Phase 1 — Manual trigger (DONE):**
  The Compiler + Gap Auditor run automatically on episode count triggers.
  User can view memory state via UI panel.
  Summaries are auto-compiled every 3/5 turns.

**Phase 2 — Knowledge graph + entity extraction (DONE):**
  ✅ `entities` table + `episode_entities` + `episode_edges` tables
  ✅ Entity extraction in Triage-Extractor (Alpha)
  ✅ Entity linking during batch storage (Beta)
  ✅ Graph-walk retrieval via entity graph channel (Gamma)

**Phase 3 — Multi-channel retrieval + dynamic scoring (DONE):**
  ✅ 4-channel retrieval: semantic (40%) + keyword (20%) + entity graph (25%) + temporal (15%)
  ✅ Schema-constrained query parsing (entity detection, temporal flags, contradiction sensitivity)
  ✅ Recency decay in temporal channel (14-day half-life)
  🔄 TODO: access_count boosting, connection_boost via graph edges

**Phase 4 — Agent-native memory curation (DONE):**
  ✅ `store_memory` tool with >= 0.8 confidence threshold + auto-embedding
  ✅ `connect_memories` tool for explicit episode linking
  ✅ Entity auto-extraction on agent-stored memories

**Phase 5 — Sleep cycle automation (NEXT):**
  Background scheduled task for full consolidation.
  Pattern/trajectory memory generation.
  Prospective trigger creation.

**Phase 6 — Optional Alpha preflight (FUTURE):**
  Re-introduce two-agent pipeline as opt-in feature.
  Measure latency vs. quality tradeoff with real usage data.
