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
't committed yet."

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

### Memory Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    ORKESTRATE MEMORY                      │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ LAYER 1: WORKING MEMORY                             │ │
│  │                                                      │ │
│  │ The current conversation context.                    │ │
│  │ Recent messages + relevant retrieved memories        │ │
│  │ injected into the LLM context window.               │ │
│  │                                                      │ │
│  │ This is what the agent is "thinking about right now."│ │
│  │ Small. Focused. Constantly refreshed.                │ │
│  └──────────────────────────┬──────────────────────────┘ │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐ │
│  │ LAYER 2: EPISODIC MEMORY                            │ │
│  │                                                      │ │
│  │ Individual memories — things the user said,          │ │
│  │ decisions they made, ideas they had.                 │ │
│  │                                                      │ │
│  │ Each memory has:                                     │ │
│  │   - Raw input (exactly what was said)                │ │
│  │   - Processed content (cleaned, complete version)    │ │
│  │   - Memory type (thought/task/decision/plan/etc)     │ │
│  │   - Tags (auto-generated)                           │ │
│  │   - Entities (people, projects, tools, concepts)     │ │
│  │   - Importance score (0-1)                          │ │
│  │   - Derived insights (what was implied, not said)    │ │
│  │   - Embedding vector (768d, nomic-embed-text)       │ │
│  │   - Timestamp                                       │ │
│  │   - Access count and last accessed time             │ │
│  │   - Edges to related memories                       │ │
│  │                                                      │ │
│  │ Stored in SQLite. Searchable by vector similarity,   │ │
│  │ by time, by entity, by type, by tag.                │ │
│  └──────────────────────────┬──────────────────────────┘ │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐ │
│  │ LAYER 3: SEMANTIC MEMORY                            │ │
│  │                                                      │ │
│  │ The knowledge graph. Entities and their              │ │
│  │ relationships. This is Orkestrate's understanding of │ │
│  │ the user's WORLD — the people, projects, tools,     │ │
│  │ places, and concepts that matter to them and how     │ │
│  │ they all connect.                                    │ │
│  │                                                      │ │
│  │ Entities table: name, type, mention_count,          │ │
│  │   first_seen, last_seen                             │ │
│  │ Edges table: source, target, relation, weight       │ │
│  │                                                      │ │
│  │ This layer is BUILT from episodic memory, not        │ │
│  │ maintained separately. Every time a memory is        │ │
│  │ stored, entities are extracted and the graph grows.  │ │
│  └──────────────────────────┬──────────────────────────┘ │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐ │
│  │ LAYER 4: CONSOLIDATED MEMORY                        │ │
│  │ *** THIS IS WHAT DOESN'T EXIST ANYWHERE ***         │ │
│  │                                                      │ │
│  │ Periodically, Orkestrate reviews its memory store and │ │
│  │ performs consolidation — the "sleep cycle."          │ │
│  │                                                      │ │
│  │ This generates:                                      │ │
│  │   - Pattern memories: "User consistently does X"     │ │
│  │   - Trajectory memories: "User's thinking on X       │ │
│  │     has evolved from A to B to C"                   │ │
│  │   - Contradiction flags: "User said X but also Y"   │ │
│  │   - Gap observations: "User has been building Z     │ │
│  │     for 3 weeks and hasn't mentioned testing"       │ │
│  │   - Relationship summaries: "User and Alex          │ │
│  │     collaborate on technical decisions, Alex        │ │
│  │     is more cautious"                               │ │
│  │   - Priority models: "User's current top concerns   │ │
│  │     are A, B, C based on frequency and recency"     │ │
│  │                                                      │ │
│  │ These are SYNTHESIZED memories — they were never     │ │
│  │ said by the user. They were generated by Orkestrate  │ │
│  │ by thinking across many memories. They are stored    │ │
│  │ as a special memory type and are retrievable just   │ │
│  │ like any other memory.                              │ │
│  │                                                      │ │
│  │ This is generative memory. This is what makes       │ │
│  │ Orkestrate get smarter over time rather than just   │ │
│  │ accumulating facts.                                 │ │
│  └──────────────────────────┬──────────────────────────┘ │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐ │
│  │ LAYER 5: PROSPECTIVE MEMORY                         │ │
│  │ *** ALSO DOESN'T EXIST ANYWHERE ***                 │ │
│  │                                                      │ │
│  │ Forward-looking memory triggers.                     │ │
│  │                                                      │ │
│  │ When Orkestrate stores or consolidates memories, it may │ │
│  │ generate prospective triggers:                      │ │
│  │                                                      │ │
│  │   "IF user mentions deploying to production         │ │
│  │    THEN remind them they never set up monitoring"   │ │
│  │                                                      │ │
│  │   "IF user talks about Keiyara again                │ │
│  │    THEN surface the consent engine connection"      │ │
│  │                                                      │ │
│  │   "IF it's been 2 weeks since user mentioned        │ │
│  │    their exercise goal THEN gently ask about it"    │ │
│  │                                                      │ │
│  │ These are checked against every incoming message.   │ │
│  │ If a trigger fires, the relevant memory is          │ │
│  │ injected into the working memory for that response. │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Memory Operations

#### Storing

When the agent calls `store_memory`, this cascade happens:

```
1. Raw input preserved exactly as said
2. LLM processes into clean content + metadata
3. Embedding generated via nomic-embed-text
4. Memory inserted into SQLite
5. Entities extracted and upserted into entities table
6. Top 5 similar existing memories found via vector search
7. Edges created for any similarity above threshold
8. If similar memory found with contradictory content:
   → Flag for belief revision
   → Agent should call update_memory on the old one
9. Prospective triggers checked — does this new memory
   fire any existing triggers?
10. If importance > 0.7, generate prospective triggers
    for this memory
```

#### Retrieving

Retrieval is not a single search. It's a multi-step process:

```
1. Semantic search (vector similarity) for direct matches
2. Entity lookup — find all memories connected to
   mentioned entities
3. Temporal context — what was the user thinking about
   around the same time as the matched memories?
4. Graph walk — follow edges from matched memories
   to find memories that are connected but not
   directly similar to the query
5. Consolidated memories — check if any pattern/trajectory
   memories are relevant
6. Prospective triggers — check if any triggers fire
7. All results ranked by: similarity × recency × importance
   × access_frequency
8. Top results injected into working memory for the agent
```

#### Consolidation (The Sleep Cycle)

This is a batch process. It can be triggered manually or run on a schedule. It is the most important differentiating feature of Orkestrate.

```
Input: All memories since last consolidation
       + random sample of older memories (for cross-pollination)

Process:
  1. CLUSTER recent memories by topic/entity
     "User had 12 thoughts about Keiyara this week"

  2. EXTRACT PATTERNS within each cluster
     "User's thinking about Keiyara has shifted from
      technical architecture to trust/consent concerns"

  3. IDENTIFY TRAJECTORIES across time
     "User started with 3 project ideas. Over the past
      week, Orkestrate has received increasing focus while
      the coding agent idea hasn't been mentioned in 5 days"

  4. DETECT CONTRADICTIONS
     "User said they'd prioritize Orkestrate but spent most
      of their conversation time on Keiyara"

  5. DETECT GAPS (negative space)
     Compare what the user HAS discussed against what
     a reasonable schema would expect.
     "User is building a software product and has discussed
      architecture, features, UX, naming. Has NOT discussed:
      target users, monetization, launch timeline, testing."

  6. GENERATE RELATIONSHIP SUMMARIES
     For entities with many connections:
     "Alex: collaborator, mentioned 8 times, usually in
      context of technical decisions and Keiyara. User
      seems to value Alex's opinion on architecture."

  7. GENERATE PROSPECTIVE TRIGGERS
     Based on patterns and gaps, create forward-looking
     triggers that will fire on relevant future messages.

  8. COMPRESS old episodic memories
     Memories older than N days with low importance and
     low access count get compressed: raw details removed,
     only gist + insights + connections preserved.
     This is natural forgetting.

  9. STRENGTHEN important memories
     Memories that keep getting accessed or connected to
     get their importance score boosted.
     This is natural reinforcement.

Output:
  - New consolidated memories (type: "pattern", "trajectory",
    "contradiction", "gap", "relationship_summary")
  - Updated importance scores
  - New prospective triggers
  - Compressed old memories
```

### Memory Scoring

Every memory has a relevance score that evolves over time:

```
relevance = base_importance
          × recency_decay(time_since_created)
          × access_boost(access_count)
          × connection_boost(edge_count)
          × reinforcement(times_corroborated_by_other_memories)

recency_decay: exponential decay, half-life of ~14 days
  (but accessed memories reset their decay clock)

access_boost: log(access_count + 1)
  (diminishing returns — accessing something 100 times
   isn't 100x more important than accessing it once)

connection_boost: log(edge_count + 1)
  (highly connected memories are structurally important)

reinforcement: count of other memories that corroborate
  or build on this one
```

This scoring is used for:
- Retrieval ranking (more relevant memories surface first)
- Consolidation decisions (low-relevance memories get compressed)
- Proactive surfacing (high-relevance memories get volunteered)

---

## The Cognitive Pipeline (Multi-Agent Architecture)

Orkestrate does NOT use a single-agent ReAct loop. That approach is too brittle for a lifelong thinking partner — it forces the Main Engine to simultaneously reason about the user's question AND figure out what context it needs. These are fundamentally different cognitive tasks.

Instead, Orkestrate uses a **two-agent, two-stage pipeline** with a feedback loop:

### The Full Cognitive Loop

```
USER PROMPT IN
       │
       ▼
┌─────────────────────────────────────────────────┐
│  STAGE 1 — THE READ PATH (Agent Alpha)          │
│                                                  │
│  The Pre-Flight Daemon compiles context BEFORE   │
│  the Main Engine is allowed to see the prompt.   │
│                                                  │
│  HOP 1: Intent Decomposition                     │
│    → Decompose the prompt into search queries    │
│    → Identify which wiki files are relevant      │
│    → Generate a reasoning trace explaining why   │
│                                                  │
│  RUST FETCHER: Orthogonal Search                 │
│    → Vector search against Episodic DB           │
│    → Filesystem reads against Semantic Wiki      │
│    → Results gathered in parallel                │
│                                                  │
│  HOP 2: Hypothesis Engine & Compression          │
│    → Run contradiction scan across results       │
│    → Flag unresolved gaps                        │
│    → Elevate hard constraints                    │
│    → Discard irrelevant tokens                   │
│    → Output: Structured JSON Payload             │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  STAGE 2 — MAIN INFERENCE ENGINE (Agent Omega)   │
│                                                  │
│  Receives:                                       │
│    - System prompt with personality + rules       │
│    - Windowed conversation history               │
│    - Compiled Context JSON from Agent Alpha      │
│    - User's raw message                          │
│                                                  │
│  The JSON is injected as a system message with    │
│  the directive: "Use this explicitly fetched      │
│  state over anything else."                      │
│                                                  │
│  Agent Omega generates the response AND triggers  │
│  Write Path tools to mutate state.               │
└─────────────────────┬───────────────────────────┘
                      │
            ┌─────────┴──────────┐
            ▼                    ▼
     RESPONSE OUT         WRITE PATH
     (streamed)       (state mutation)
```

### Why Two Agents, Not One

A single agent doing search + reasoning in one loop has a fatal flaw: **it can only search for what it already suspects.** If the user says "I'm cooking for Mia tonight," a single agent might search for "Mia" but miss that the user is vegetarian, that Mia has a nut allergy, and that there was a fight about finances three days ago that might affect the emotional tone.

Agent Alpha's job is to think about **what context is missing** before the Main Engine even starts reasoning. It maps the entire orthogonal search space — dietary rules, relationship context, recent emotional state — and compresses it into a structured payload. The Main Engine never has to guess what it doesn't know.

### Agent Alpha: The Pre-Flight Daemon

**Model:** External reasoning model via OpenRouter (elephant-alpha)
**Location:** `src-tauri/src/engine/preflight.rs`

Agent Alpha operates in two hops:

**Hop 1 — Intent Decomposition:**
- Input: Raw user prompt + list of available wiki files on disk
- Output: JSON with `reasoning_trace`, `search_queries`, `wiki_files`
- The reasoning trace forces the model to articulate WHY it needs each piece of context
- Search queries must be dense keyword clusters optimized for vector similarity, not conversational questions
- Wiki files are selected from the actual filesystem inventory — no hallucinated paths

**Rust Orthogonal Fetcher (between hops):**
- Executes the search plan from Hop 1 natively in Rust
- Vector searches run concurrently via `tokio::spawn`
- Wiki file reads use async filesystem I/O
- Core identity files (`identity.md`, `preferences.md`) are always injected as baseline context
- Results above similarity threshold (0.6) are included

**Hop 2 — Hypothesis Engine & Compression:**
- Input: User prompt + raw dump of all retrieved data
- Output: Structured JSON payload with:
  - `user_profile`: Key traits needed for this interaction
  - `context_for_recipient`: If someone else is mentioned
  - `response_constraints`: Hard rules (dietary, tone, open questions)
  - `prospective_triggers`: Future-looking flags
- The model actively scans for contradictions between retrieved facts
- Irrelevant context is compressed away to save tokens

### Agent Omega: The Main Inference Engine

**Model:** Gemma 4 e2b (local via Ollama) or Gemini (cloud)
**Location:** `src-tauri/src/agent/mod.rs`

Agent Omega receives the compiled JSON as ground truth and operates with a standard tool-calling loop (max 5 iterations). It can:
- Respond directly to the user
- Call `store_memory` to commit new facts (Write Path)
- Call `write_wiki_fact` to mutate the Semantic Wiki (Write Path)
- Call `log_contradiction` to flag conflicts
- Call `connect_memories` to build the knowledge graph
- Call `update_memory` to revise existing beliefs

The key insight: Agent Omega trusts the compiled context. It does NOT need to search or retrieve — that was already done by Alpha. It focuses entirely on reasoning, responding, and writing.

### Context Window Management

The context window is managed with strict budgets:

```
System prompt:               ~500 tokens (fixed)
Conversation history:        Windowed, 6000-token budget
Compiled context (Alpha):    Variable, ~1000-2000 tokens
Tool results per step:       Variable

History Windowing:
  - Messages are loaded in reverse chronological order
  - Each message's token cost is estimated (max of char/4, word count)
  - Messages are included until the 6000-token budget is hit
  - Minimum 2 messages are always preserved
  - Future: oldest messages will be summarized, not dropped

Contextual Tool Pruning:
  - If the user's message doesn't contain memory-related keywords
    ("remember", "save", "store", "note"), mutation tools
    (store_memory, update_memory) are pruned from the tool spec
  - This saves tokens and reduces hallucinated tool calls
```

### The Feedback Loop

The architecture forms a closed loop:

1. **Read Pass:** User prompt → Agent Alpha compiles context from DBs
2. **Inference:** Agent Omega generates response using compiled context
3. **Write Pass:** Agent Omega calls tools → state is mutated (DB + Wiki)
4. **Next Read Pass:** Alpha now pulls from the updated, hardened state
5. **Async Rest:** Sleep Cycle Consolidator scrubs DBs between interactions

---

## What Doesn't Exist Yet (Anywhere)

These are the features that no current AI memory system implements. They are what make Orkestrate fundamentally different:

### 1. Consolidation / Sleep Cycle
No system periodically reviews its own memory store to extract patterns, trajectories, contradictions, and gaps. Every system only processes memories at input time. Orkestrate generates NEW knowledge from EXISTING memories.

### 2. Generative Memory
The ability to create memories that were never explicitly stated by the user. "User tends to abandon projects at the 3-week mark" is knowledge that emerges from observing multiple memories over time. It was never said. It was discovered.

### 3. Negative Space Detection
Noticing what HASN'T been said. Recognizing gaps against an expected schema. "You've been building this product for a month and never mentioned who it's for." This requires a model of what completeness looks like, which no system attempts.

### 4. Prospective Memory
Forward-looking triggers that fire on future events. "Next time the user mentions deployment, remind them about the monitoring gap." Memory systems are universally retrospective. Orkestrate remembers the future.

### 5. Preference Trajectories
Not "user prefers X" as a static fact, but "user's preference evolved from A to B to C over time, currently at C, likely heading toward D." Modeling the direction of change, not just the current state.

### 6. Importance Decay and Reinforcement
Memories that naturally fade if never accessed or corroborated, and strengthen if repeatedly relevant. No system implements a forgetting curve. They treat all memories as equally permanent.

### 7. Inferential Storage
Storing not just what was said but what was MEANT. The emotional subtext. The implied priorities. The unstated assumptions. Current systems extract facts. Orkestrate extracts understanding.

---

## Technical Decisions

### Why Multi-Agent (Alpha + Omega)
- Separates context retrieval from reasoning — each agent has a single, focused job
- Alpha can use a more powerful external model for search decomposition
- Omega operates with pre-compiled ground truth, reducing hallucination
- The pipeline is deterministic: Hop 1 → Fetch → Hop 2 → Inference
- Latency tradeoff: ~2-4s added for Alpha's hops, but context quality is dramatically higher

### Why OpenRouter / elephant-alpha for Agent Alpha
- Agent Alpha needs strong reasoning for intent decomposition and hypothesis generation
- elephant-alpha is a capable reasoning model available via OpenRouter API
- The Pre-Flight task is small and bounded — the extra latency of a network call is acceptable
- Future: evaluate moving Hop 1 to a local heuristic to reduce latency

### Why Gemma 4 e2b for Agent Omega
- Runs on CPU (Intel Iris Xe, 32GB RAM)
- Fast enough for interactive chat when context is pre-compiled
- Reasoning traces give transparency
- Tool calling support via Ollama
- Good enough for structured extraction and synthesis
- Upgrade path to e4b or larger models as hardware allows

### Why nomic-embed-text
- Available through Ollama (same tool, simple stack)
- 768-dimensional embeddings
- Good quality for its size
- Fast on CPU
- Upgrade path to multimodal embeddings later (images, video, audio via ImageBind or similar)

### Why SQLite
- One file. Copy it to back up your entire mind.
- No external services
- Fast enough for personal-scale data (even 100K memories)
- Manual cosine similarity for vector search (brute-force O(N), acceptable at personal scale)
- Portable across machines
- Inspectable — you can always look at your own data
- Connection pooled via `get_db_conn()` with thread-local reuse

### Why Tauri + Svelte 5
- Native desktop performance
- Minimal resource usage
- Svelte 5 runes for reactive state without framework overhead
- Rust backend handles all DB, embedding, and API orchestration
- Local-first by architecture, not by policy
- All DB operations run on `tokio::task::spawn_blocking` to avoid blocking the async runtime

### Modular Rust Backend
The backend is organized into focused modules:
- `src/agent/mod.rs` — Agent Omega's run loop, tool dispatch, context window management
- `src/agent/tools.rs` — Tool implementations (store, search, connect, update, wiki)
- `src/engine/preflight.rs` — Agent Alpha's two-hop Pre-Flight pipeline
- `src/engine/ollama.rs` — Local model interface (chat, embed, tokenize)
- `src/engine/gemini.rs` — Cloud model interface
- `src/blueprints/` — Shared types (ChatMessage, ModelConfig, Memory, etc.)
- `src/db.rs` — Schema setup and migrations
- `src/wiki.rs` — Semantic Wiki filesystem operations
- `src/vector.rs` — Embedding serialization and cosine similarity

---

## Future: Multimodal Memory

The architecture is designed to extend to:

### Images
- Gemma 4 describes the image → text embedding for semantic search
- Later: ImageBind/LanguageBind for perceptual embeddings in parallel
- Photos become memories with the same entity extraction, tagging, and connection logic

### Voice
- Whisper (local) for transcription → same text pipeline
- Tone/emotion detection as metadata

### Video
- Keyframe extraction + Gemma 4 description
- Audio track via Whisper
- Later: native video embeddings

### Documents / Files
- PDF, markdown, etc. ingested and chunked
- Each chunk becomes a memory linked to the source document

The memory system doesn't care about modality. Everything becomes a memory object with content, embedding, entities, and connections. The intake pipeline varies. The memory fabric is universal.

---

## Future: Consolidation Implementation Plan

Phase 1 — Manual trigger:
  User can type "consolidate" or click a button.
  Glade reviews all memories since last consolidation.
  Generates pattern and trajectory memories.
  Shows the user what it found.

Phase 2 — Scheduled:
  Runs automatically when the app has been idle for N minutes.
  Or on app startup if last consolidation was >24h ago.
  Results available as a "morning briefing" on next interaction.

Phase 3 — Continuous background:
  Lightweight pattern detection runs on every new memory.
  Full consolidation runs on schedule.
  Prospective triggers generated continuously.
  The system gets smarter with every interaction,
  not just during consolidation windows.