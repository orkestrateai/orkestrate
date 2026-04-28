# Orkestrate Personal Memory Architecture Plan

**Version:** 2.0  
**Date:** 2026-04-27  
**Goal:** A specialized long-term personal memory system built on ByteRover concepts but redesigned for living human relationships, preferences, and identity. Capable of answering vague prompts like *"I'm bored of it"* or *"Mia is stressed"* by building a deep, evolving model of the user.

---

## Core Insight

ByteRover was designed for **codebase documentation** — permanent truths about architecture. Personal memory is about a **living human being** whose facts, relationships, and identity evolve continuously.

**This changes everything.** Decay can't be uniform. Confidence matters more than maturity. Contradictions are not errors — they're evolution. The store must be entity-centric, not folder-centric.

---

## The Problem (Unchanged)

Current memory systems treat memory as a storage-and-retrieval problem. They work fine for *"What did I say about Keiyara?"* but fail on vague, natural prompts like:

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

## ByteRover-v2: What Changes

### What we keep from ByteRover
- BM25 scoring with s/(1+s) normalization
- File-based context tree (human-readable audit trail)
- YAML frontmatter (modified schema)
- Sidecar signals (modified schema)
- Atomic file writes
- AKL lifecycle (decay, bonuses, tier transitions — with modifications)

### What we change
- **Frontmatter**: add `category`, `confidence`, `entities`, `provenance`, remove `related`
- **Signals**: add `confidence`, `confirmation_count`, `decay_category`, `provenance`; keep `importance`/`recency`/`maturity` but make confidence the primary relevance signal
- **Decay**: per-category factors (identity=permanent, emotional=3-day half-life)
- **Scoring**: category-weighted (identity > preference > emotional)
- **Curate ops**: add CONFIRM, CONTRADICT, OBSERVE

### What we remove entirely
- Symbol tree (5-pass builder, summary propagation, reference index)
- context.md domain/topic/subtopic files
- `@domain/topic/file.md` relation annotations
- Code snippets, RawConcept sections (changes/files/flow/patterns)
- Narrative sections (structure, dependencies, diagrams, rules)
- `code_exec` tool, sandboxed curation pipeline
- review-backups, curate-log, query-log, dream-log
- Tier 0/1 caches (exact + fuzzy cache — negligible benefit for conversation)

### Decay Rules

- Decay reduces **passive retrieval score** — how likely a fact is to surface as ambient context
- Decay does **NOT** delete facts
- Perfect BM25 matches (score > 0.95) ignore decay entirely — explicit queries always work
- Only user-initiated "forget" deletes data

**Per-category decay factors:**

| Category | Decay Rate | Half-Life | Example |
|----------|-----------|-----------|---------|
| identity | 0.9999/day | ~19 years | Name, birthdate, core relationships |
| relationship | 0.999/day | ~2 years | Family, close friends |
| preference | 0.99/day | ~69 days | Food, music, lifestyle |
| fact | 0.995/day | ~138 days | Learned skills, possessions |
| observation | 0.95/day | ~14 days | Things user casually mentioned |
| emotional_state | 0.8/day | ~3 days | Mood, feelings, stress |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     INFERENCE ENGINE                         │
│  (LLM with structured context — all queries go here)        │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐ ┌───────────▼──────┐
│   Session   │ │  Entity   │ │   Sense        │ │   Context Tree   │
│   Working   │ │   Graph   │ │   Model        │ │  (ByteRover-v2)  │
│   Memory    │ │           │ │                │ │                  │
│             │ │ people/   │ │ senses/        │ │  domain/topic/   │
│ recent      │ │   entity  │ │   word.md →   │ │  title.md        │
│ turns       │ │   fact    │ │   per-entity   │ │                  │
│ topics      │ │   edge    │ │   override     │ │  scoring info    │
└─────────────┘ └───────────┘ └────────────────┘ │  signals.json    │
                                                  └──────────────────┘
```

## Storage: Entity-Centric Context Tree

The context tree becomes entity-centric. Facts are organized by the entity they concern:

```
.brv/context-tree/
  people/
    mia/
      entity.md               # Entity definition: name, relationship, aliases
      stress-at-work.md        # Fact about Mia
      cooking-together.md      # Another fact about Mia
      told-karan-about.md      # Entity boundary crossing → references karan entity
    karan/
      entity.md
      cooking-flow.md
  identity/
    name/
      User's Name.md           # The user's own identity facts
  preferences/
    food/
      Coffee Preference.md
  emotional_state/
    work-stress/
      2026-04-mia-stressed.md
  senses/
    cooking.md                 # Word-sense mapping per entity
```

### Entity Definition (people/{name}/entity.md)

```yaml
---
type: person
name: Karan
relationship_to_user: classmate
aliases: [Karan, K-Dawg]
confidence: 0.95
identified_at: 2026-04-10T14:30:00Z
related:
  - people/mia/entity.md: knows_each_other
  - people/mia/entity.md: sister_boyfriend
---
```

### Entity-Linked Fact (people/{name}/fact-title.md)

```yaml
---
type: fact
subject: people/mia/entity
predicate: stressed_about
object: work deadlines
confidence: 0.9
sense: literal
observed_at: 2026-04-20T09:15:00Z
category: emotional_state
---
```

### Word-Sense Mapping (senses/{word}.md)

```yaml
---
type: sense
word: cooking
default: literal
entity_senses:
  people/karan: figurative
---
```

### Query-Time Entity Resolution Algorithm

When user says "Mia is stressed":

```
1. LLM extraction agent parses: entities=["Mia"], intent="emotional_state"
   → Single small LLM call on the user message

2. Entity lookup: read people/mia/entity.md
   → name="Mia", relationship_to_user="sister"
   → If not found: create new entity with relationship_to_user="unknown"

3. Fact retrieval: BM25 search scope=people/mia/ for "stressed"
   → Also list all .md files under people/mia/

4. Graph expansion: parse related field in entity.md
   → people/karan/entity.md: knows_each_other
   → Read Karan's entity.md → relationship_to_user="classmate"

5. Sense resolution: read senses/cooking.md if relevant
   → "cooking" with Mia = literal

6. Inject entity context block into system prompt:
   <entity-context>
   Mia (your sister)
   Known: stressed about work, cooks together for stress relief
   Relationship: Mia and Karan know each other
   </entity-context>

7. BM25 search across ALL facts for full context
```

---

## Phased Implementation

### Level 1: ByteRover Core — Adjustments

**Status:** ✅ Partially built, needs adjustments

**Changes to current code:**
- Constants: add `decay_category` per category, per-category decay rates
- Signals: add `confidence`, `confirmation_count`, `decay_category`, `provenance`
- Scoring: add category_weight multiplier (identity=0.9, emotional_state=0.3)
- Decay: per-category decay in `apply_decay()`, BM25 floor override
- Remove debug prints from `paths.rs`, `manager.rs`, `storage.rs`

**Handles:** Basic recall with category-aware scoring

---

### Level 2: Entity Foundation

**Status:** ⏳ Next

**Implementation:**
- `people/{name}/entity.md` — entity definition files with frontmatter
- Entity extraction as part of `extractor.rs` (single LLM call: message → entities + facts + relations + confidence)
- `entity_resolver.rs` — reads entity.md + facts, returns context block for system prompt
- Fact files under `people/{name}/` with entity-linked frontmatter
- Query-time entity resolution + context injection in `handler.rs`

**Handles:** "Who is Mia?" — entity lookup. Basic entity-aware context.

---

### Level 3: Session Working Memory

**Status:** ⏳ Next

**Implementation:**
- Token-budgeted sliding window of recent turns
- Active topic tracking, pending questions, unresolved references
- SWM summary + entity context injected into system prompt every turn
- Auto-compile session summary when session ends

**Handles:** "I'm bored of it" — SWM resolves "it" from recent conversation state.

---

### Level 4: Sense Model + Entity Graph

**Status:** ⏳ Pending

**Implementation:**
- `senses/{word}.md` word-sense mapping files
- Entity-to-entity edges (`related` field in `entity.md`)
- Query-time sense resolution + graph expansion
- Contradiction detection (CONTRADICT operation)

**Handles:** "Mia is stressed" (literal cooking) vs "Karan is stressed" (flow state). "Mia told Karan that..." (entity→entity edge).

---

### Level 5: Temporal + Deep Inference

**Status:** ⏳ Pending

**Implementation:**
- Time-aware retrieval with category-differentiated decay
- Session chaining across days
- CONFIRM operation (bumps confidence + confirmation_count)
- Multi-hop inference agent (LLM reads subgraph → suggests actions)
- Gap detection + proactive questioning

**Handles:** "What changed about X?", "You mentioned Mia was stressed — want to cook together?"

---

## Vague Prompt → Level Mapping

| Prompt | Levels Required | How It Works |
|--------|---------------|-------------|
| *"I'm bored of it now, I want to do the other suggestion"* | 1 + 3 | Scoring + SWM resolves "it" and "the other suggestion" |
| *"I'm cooking, Mia is stressed"* | 2 + 4 | Entity Graph finds Mia = sister; Sense Model says cooking = literal |
| *"I'm cooking, Karan is stressed"* | 2 + 4 | Entity Graph finds Karan = classmate; Sense Model says cooking = flow state |
| *"Mia told Karan that..."* | 2 + 4 | Entity Graph's related edges track Mia–Karan relationship |
| *"What should I focus on?"* | 2 + 5 | Entity awareness + Inference prioritize based on user's goals |
| *"What happened with X?"* | 2 + 5 | Entity Graph finds X; Temporal Layer tells the story |
| *"Do I still believe that?"* | 5 | Inference detects contradictions and tracks belief evolution |
| *"Remind me about that thing"* | 1 + 2 + 3 | Scoring + Entity + SWM triangulate the reference |

---

## Key Design Decisions

### 1. Extraction: LLM First, Heuristics Second
- For entity extraction: regex for obvious cases (capitalized names → entity), LLM for ambiguous cases
- For fact extraction: always LLM (context matters too much for regex)
- Single LLM call per turn handles: entities + facts + relations + confidence + senses

### 2. Storage: File-First, No SQLite
- The context tree IS the canonical store
- Entity graph is implemented via frontmatter `related` fields + directory structure
- No SQLite, no graph DB — the filesystem IS the graph
- Fast readdir for entity scoping, BM25 for cross-entity search
- In-memory session state for SWM hot cache

### 3. Confidence Beats Maturity
- `maturity` (draft/validated/core) is a ByteRover concept from code review
- For personal memory: `confidence` + `confirmation_count` is more meaningful
- A fact stated once = confidence 0.6. Stated three times = 0.9. Contradicted = 0.1.
- `maturity` kept for backwards compatibility but secondary to confidence

### 4. Contradiction: Store Both, Always
- When user says something that conflicts with stored fact: mark old as contradicted, store new with `replaces: [old_id]`
- Both preserved with timestamps
- Agent surfaces: "You said X, but Y last week — what changed?"

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

| Level | Status | Notes |
|-------|--------|-------|
| Level 1 | 🔄 Adjusting | ByteRover core built, needs confidence/scoring changes |
| Level 2 | ⏳ Next | Entity foundation — extraction + resolver + context injection |
| Level 3 | ⏳ Pending | Session Working Memory |
| Level 4 | ⏳ Pending | Sense Model + Entity Graph edges |
| Level 5 | ⏳ Pending | Temporal + Deep Inference |
