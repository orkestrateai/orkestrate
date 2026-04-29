# Orkestrate Personal Memory Architecture Plan

**Version:** 1.0  
**Date:** 2026-04-25  
**Goal:** Make ByteRover's memory system specialized for personal long-term conversation, capable of answering even vague prompts by building a deep, evolving model of the user.

---

## The Problem

Current memory systems (including raw ByteRover) treat memory as a storage-and-retrieval problem. They work fine for explicit queries like *"What did I say about Keiyara?"* but fail on vague, natural prompts like:

> *"I'm bored of it now, I want to do the other suggestion"*
> *"I'm cooking, Mia is stressed"*
> *"I'm cooking, Karan is stressed"*

These require:
- **Coreference resolution** (what is "it"? what was "the other suggestion"?)
- **Relationship inference** (who is Mia, who is Karan, how do they relate to me?)
- **Sense disambiguation** ("cooking" = literal food prep vs. slang for "in flow state")
- **Temporal reasoning** (tracking conversation state across turns and sessions)
- **Multi-hop inference** (Mia → cooking together → stress relief → offer to plan a session)

---

## The Vague Prompt Benchmark

These are the exact examples we use to test whether the memory system "gets it."

### Example 1: Coreference Resolution
**User:** *"I'm bored of it now, I want to do the other suggestion"*

**Requirements:**
- Resolve "it" → the thing we've been talking about for the last 10 turns
- Resolve "the other suggestion" → the alternative proposed earlier in the conversation
- Requires **Session Working Memory** that persists across the current chat

### Example 2: Literal Meaning + Relationship
**User:** *"I'm cooking, Mia is stressed"*

**Requirements:**
- "cooking" = **literal** (actual food preparation)
- "Mia" = user's sister (inferred from past conversations)
- "stressed" = about work (inferred from context)
- They cook together as a stress-relief activity
- Requires **Entity Graph** + **Sense Model**

### Example 3: Slang Meaning + Different Relationship
**User:** *"I'm cooking, Karan is stressed"*

**Requirements:**
- "cooking" = **slang** for "in flow state / being productive"
- "Karan" = classmate/coworker (different relationship from Mia)
- "stressed" = about **exams** (different stressor from Mia's work stress)
- Same word "cooking" means different things in different relational contexts
- Requires **Sense Disambiguation** per entity

### Example 4: Third-Party References
**User:** *"Mia told Karan that..."*

**Requirements:**
- Track relationships between **multiple people**, not just user → person
- Mia and Karan have their own relationship (sister + friend? sister + boyfriend?)
- The system must model a **social graph**, not just a user-centric entity list
- Requires **Entity Graph with multi-party edges**

---

## Architecture Overview

We extend ByteRover's Context Tree with four additional layers:

```
┌─────────────────────────────────────────────────────────────┐
│                     INFERENCE ENGINE                         │
│  (LLM with structured context — all queries go here)        │
└────────────┬────────────┬────────────┬──────────────────────┘
             │            │            │
    ┌────────▼──┐  ┌─────▼──────┐  ┌──▼─────────┐  ┌──────────▼────────┐
    │  Session  │  │  Entity   │  │   Sense    │  │   Context Tree    │
    │  Working  │  │   Graph   │  │   Model    │  │  (ByteRover CT)   │
    │  Memory   │  │           │  │            │  │                   │
    │           │  │  people   │  │  word →    │  │  long-term        │
    │  recent   │  │  places   │  │  sense     │  │  curated          │
    │  turns    │  │  things   │  │  per       │  │  knowledge        │
    │           │  │  edges    │  │  entity    │  │                   │
    └───────────┘  └───────────┘  └────────────┘  └───────────────────┘
         │               │               │                  │
         └───────────────┴───────────────┴──────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Temporal Layer    │
                    │  (decay, recency,  │
                    │   session chains)  │
                    └────────────────────┘
```

**Design principles:**
1. **Don't replace ByteRover** — extend it. The Context Tree remains the long-term curated knowledge store.
2. **Layered retrieval** — each layer feeds into the next. SWM resolves immediate context, Entity Graph resolves "who," Sense Model resolves "what they meant."
3. **Agent-native** — use LLM agents for extraction, not heuristics or regex.
4. **Learn from conversation** — the system improves by observing how the user talks, not by explicit configuration.

---

## Phased Implementation Plan

### Phase 0: ByteRover Foundation ✅ DONE

**What:** Basic file-based storage + keyword search integrated into the chat backend.

**Implementation:**
- `FileBlobStorage` — each memory is a `.blob` + `.meta.json` file pair
- `MemoryManager` — CRUD operations with BM25 keyword search
- `ChatMemoryService` — high-level wrapper for conversation turns
- Express backend with AI SDK v6 streaming

**User experience:** *"I remember you said..."* (basic recall)

**Test:** Search for "chocolate" returns "I love dark chocolate."

---

### Phase 1: Session Working Memory (SWM)

**What:** A sliding window of recent conversation turns that persists across the current session. Resolves pronouns, "it," "the other thing," and tracks topic state.

**Why first:** Without SWM, every query is independent. The AI can't resolve "it" or "that thing" without knowing what you just said.

**Implementation:**
- Maintain last N turns (token-budgeted, not count-budgeted)
- Track active topics, pending questions, unresolved references
- Inject SWM summary into system prompt on every turn
- Auto-compile session summary when session ends

**User experience:** The AI follows the thread. You say *"I'm bored of it"* and it knows what "it" is.

**Test:** Example 1 — *"I'm bored of it now, I want to do the other suggestion"*

---

### Phase 2: Entity Graph

**What:** Extract and model entities (people, places, projects, concepts) from conversations. Build a graph of relationships.

**Why second:** Once the AI knows "what we were talking about" (SWM), it needs to know "who we're talking about."

**Implementation:**
- **Extraction agent:** LLM reads conversation → extracts entities + tentative relationships
- **Graph store:** SQLite or lightweight graph DB (nodes = entities, edges = relationships)
- **Disambiguation:** "Karan" the classmate vs. "Karan" the neighbor — use context to differentiate
- **Multi-party edges:** Track relationships between entities, not just user → entity

**User experience:** The AI knows who Mia and Karan are without you introducing them every session.

**Test:** Example 4 — *"Mia told Karan that..."* (system knows Mia = sister, Karan = classmate, their relationship)

---

### Phase 3: Sense Model

**What:** Word-sense disambiguation per entity. Same word means different things depending on who/what it's attached to.

**Why third:** Once we know "who," we need to know "what they meant." "Cooking with Mia" ≠ "cooking with Karan."

**Implementation:**
- **Sense extraction agent:** LLM identifies when a word is used literally vs. figuratively/slang
- **Sense tagging:** Each memory gets tagged with the active sense of ambiguous words
- **Entity-scoped senses:** "cooking"-with-Mia = literal; "cooking"-with-Karan = flow-state
- **Confidence scoring:** How sure are we about each sense assignment? (0.0–1.0)

**User experience:** The AI understands subtext, slang, and personal shorthand without being explicitly taught.

**Test:** Examples 2 & 3 — *"I'm cooking, Mia is stressed"* vs. *"I'm cooking, Karan is stressed"*

---

### Phase 4: Temporal Layer

**What:** Time-aware retrieval with decay, session chaining, and lifecycle management.

**Why fourth:** Personal memory isn't just "what happened" — it's "what happened **when**" and "is it still relevant?"

**Implementation:**
- **Recency scoring:** 14-day half-life as starting point, adjustable per entity
- **Session chaining:** Link conversations across days into continuous narratives
- **Temporal inference:** Answer "What happened with X last week?" by traversing time-ordered episodes
- **Lifecycle management:** Auto-archive stale memories, boost recurring themes

**User experience:** The AI knows what's current, what's past, and what's no longer relevant.

**Test:** *"How is Karan's exam stress?"* → system knows exams were 3 weeks ago, stress may have expired.

---

### Phase 5: Deep Inference (3-hop+)

**What:** Derive new knowledge from combinations of existing memories. Detect contradictions, infer unstated facts, and proactively surface insights.

**Why fifth:** This is the payoff. The AI doesn't just retrieve — it **thinks** across memories.

**Implementation:**
- **Contradiction detection:** Spot when user says something that conflicts with stored memory
- **Belief revision:** Update stored knowledge when user changes their mind
- **Predictive assembly:** Proactively pull context the user might need
- **Inference agent:** LLM reads subgraph → generates inferred facts → stores with "inferred" provenance

**User experience:** *"You mentioned Mia was stressed about work, and you cook with her when she's stressed — want to plan a cooking session?"*

**Test:** Multi-hop: Mia + stressed + cooking-together → offer to plan cooking.

---

### Phase 6: System Prompt Learning

**What:** The agent develops its own "personality" and self-model over time by learning how the user prefers to interact.

**Why last:** This requires all previous layers to be stable. The AI can't learn your style if it doesn't know who you are.

**Implementation:**
- **Style mirroring:** Match user's communication style (concise vs. verbose, technical vs. casual)
- **Preference learning:** Learn what topics the user cares about and prioritize them
- **Dynamic persona:** Adapt base system prompt based on accumulated sense model
- **Self-model:** The agent maintains a "user.md" that evolves with each conversation

**User experience:** The AI feels like *your* AI — not a generic assistant.

**Test:** After 50 conversations, the AI knows you hate small talk and prefers direct answers.

---

## How the Phases Enable Vague Prompt Answering

| Vague Prompt | Phases Required | How It Works |
|---|---|---|
| *"I'm bored of it now, I want to do the other suggestion"* | Phase 1 | SWM resolves "it" and "the other suggestion" from recent conversation state |
| *"I'm cooking, Mia is stressed"* | Phase 2 + 3 | Entity Graph knows Mia = sister; Sense Model knows "cooking" = literal here |
| *"I'm cooking, Karan is stressed"* | Phase 2 + 3 | Entity Graph knows Karan = classmate; Sense Model knows "cooking" = flow state |
| *"Mia told Karan that..."* | Phase 2 | Entity Graph tracks Mia–Karan relationship (sister + classmate/friend) |
| *"What should I focus on?"* | Phase 3 + 5 | Sense Model knows user's goals; Inference generates prioritized suggestions |
| *"What happened with X?"* | Phase 2 + 4 | Entity Graph finds X; Temporal Layer tells the story across sessions |
| *"Do I still believe that?"* | Phase 5 | Inference detects contradictions and tracks belief evolution |
| *"Remind me about that thing"* | Phase 1 + 2 + 3 | SWM + Entity Graph + Sense Model triangulate the reference |

---

## Key Design Decisions

### 1. Extraction: Agents, Not Heuristics
- **No regex.** No capitalized-word detection. No stop-word lists.
- Every extraction (entity, sense, relationship) goes through an LLM agent.
- Agents are small, fast, and focused on a single task.

### 2. Storage: Hybrid
- **Session Working Memory:** In-memory (Redis or simple LRU cache)
- **Entity Graph + Sense Model:** SQLite (fast, portable, queryable)
- **Context Tree (ByteRover):** File-based markdown (human-readable, git-friendly)
- **Temporal index:** SQLite with timestamp columns

### 3. Learning: Both Implicit and Explicit
- **Implicit:** The system learns by observing conversation patterns.
- **Explicit:** User can teach with natural language (*"Mia is my sister"*) or slash commands (`/teach Mia = sister`).

### 4. Conflict Resolution: Store Both
- When the system detects a contradiction, it stores **both senses** with context tags.
- Example: "Karan is my classmate" (old) vs. "Karan is my coworker" (new) → both stored with timestamps and confidence scores.

---

## Success Criteria

The memory system is "done" when it can handle all four benchmark examples without explicit user configuration:

1. ✅ Resolves "it" and "the other suggestion" mid-conversation
2. ✅ Knows Mia = sister, cooking-with-Mia = literal
3. ✅ Knows Karan = classmate, cooking-with-Karan = flow state
4. ✅ Tracks Mia–Karan relationship for third-party references

**Plus one bonus:** After 30 days of use, the AI can answer *"What should I focus on?"* with a genuinely personalized, context-aware response.

---

## Current Status

| Phase | Status | Notes |
|---|---|---|
| Phase 0 | ✅ Complete | ByteRover integrated, basic chat works |
| Phase 1 | 🔄 Next | Need to implement SWM layer |
| Phase 2 | ⏳ Pending | Entity extraction agent design needed |
| Phase 3 | ⏳ Pending | Sense model schema design needed |
| Phase 4 | ⏳ Pending | Temporal scoring formula needed |
| Phase 5 | ⏳ Pending | Inference agent design needed |
| Phase 6 | ⏳ Pending | System prompt adaptation design needed |

---

## References

- ByteRover paper: `packages/byterover/paper/main.tex`
- Original architecture discussion: OpenCode session `ses_23c27e046ffe2vCxsZUnmSAZDU`
- Old AGENTS.md (superseded): See `desktop/AGENTS.md` (pre-rewrite version)
