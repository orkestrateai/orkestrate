# ByteRover Memory System — Implementation Specification

> **Target:** 100% compliant Rust port into Orkestrate
> **Source:** byterover-cli (TypeScript) + paper/main.tex
> **Status:** Complete reverse-engineering specification

---

## 1. Theoretical Foundation (Paper)

### 1.1 Compound Retrieval Score (Equation 3)

```
Score(n_i, q) = w_r · BM25(n_i, q) + w_ι · ˆι_i + w_t · r_i
```

**Weights:**
| Symbol | Value | Description |
|--------|-------|-------------|
| `w_r` | 0.6 | BM25 relevance weight |
| `w_ι` | 0.2 | Importance weight |
| `w_t` | 0.2 | Recency weight |

**Components:**
| Symbol | Formula | Description |
|--------|---------|-------------|
| `ˆι_i` | `min(signals.importance, 100) / 100` | Normalized importance [0,1] |
| `r_i` | `exp(-Δt_i / τ)` where τ = 30 | Recency (~21-day half-life) |

**Final score:** `base * TIER_BOOST[maturity]`
- core: `1.15`
- validated: `1.0`
- draft: `0.85`

### 1.2 Adaptive Knowledge Lifecycle (AKL) Parameters

#### Importance Bonuses
| Event | Bonus | Cap |
|-------|-------|-----|
| Search access hit | `+3` per hit | `100` |
| Curate update | `+5` per update | `100` |

#### Decay Constants
| Signal | Formula | Effect |
|--------|---------|--------|
| Importance | `value * 0.995^(Δt_days)` | ~78% after 50 days |
| Recency | `exp(-Δt_days / 30)` | ~0.5 after 21 days |

Decay is only applied when `daysSinceLastUpdate > 0`.

#### Default Initial Signals
| Field | Default | Type |
|-------|---------|------|
| `importance` | `50` | f64 [0, 100] |
| `recency` | `1.0` | f64 [0, 1] |
| `maturity` | `"draft"` | enum |
| `accessCount` | `0` | u64 |
| `updateCount` | `0` | u64 |

#### Maturity Tier Transitions (with hysteresis)
| From | To | Condition | Gap |
|------|----|-----------|-----|
| draft | validated | `importance >= 65` | 30 |
| validated | core | `importance >= 85` | 25 |
| core | validated | `importance < 60` | — |
| validated | draft | `importance < 35` | — |

Hysteresis prevents rapid oscillation: an entry at 64 importance stays "draft"; an entry at 84 stays "validated"; a "core" entry drops to "validated" only below 60.

### 1.3 5-Tier Progressive Retrieval

```
┌─────────────────────────────────────────────────┐
│  Query q                                         │
│  → Start search ‖ Compute fingerprint           │
│    ↓                                             │
│  Tier 0: Exact cache match? ── hit ──▶ Return    │
│    ↓ miss                                        │
│  Tier 1: Fuzzy cache ≥0.6? ── hit ──▶ Return     │
│    ↓ miss                                        │
│  Await search results                            │
│    ↓                                             │
│  Results = 0? (OOD) ── yes ──▶ Reject            │
│    ↓ no                                          │
│  Tier 2: Score ≥0.93 + gap ≥0.08? ── hit ──▶ Ret │
│    ↓ miss                                        │
│  Tier 3: LLM + pre-fetched context ──▶ Return     │
│    ↓                                              │
│  Tier 4: Full agentic loop ──▶ Return             │
└─────────────────────────────────────────────────┘
```

#### Tier Details

| Tier | Mechanism | Latency | Escalation Condition |
|------|-----------|---------|---------------------|
| 0 | Exact cache hit | ~0 ms | Hash match + valid fingerprint |
| 1 | Fuzzy cache (Jaccard) | ~50 ms | Jaccard ≥ θ_fuzzy (~0.6) |
| 2 | Direct MiniSearch | ~200 ms | BM25 score ≥ 0.93 AND gap(D₁,D₂) ≥ 0.08 |
| 3 | Optimized LLM call | <5 s | BM25 score ≥ 0.85 (medium threshold) |
| 4 | Full agentic loop | 8-15 s | All remaining queries |

#### Tier 3 Constraints
- Max tokens: 1,024
- Temperature: 0.3
- Pre-fetches relevant documents from search results

#### Tier 4 Constraints
- Max tokens: 2,048
- Temperature: 0.5
- Max iterations: 50
- Tool access: `code_exec`, `readFile`, `grep`, `search_knowledge`

#### Search Engine Configuration
| Parameter | Value |
|-----------|-------|
| Engine | MiniSearch v7 (BM25) |
| Field boost: title | 5x |
| Field boost: path | 1.5x |
| Field boost: content | 1x |
| Max results | 32 |
| Max content length | 8,000 chars |
| Fuzzy similarity | 0.2 |
| Prefix matching | enabled |
| Score normalization | `s / (1 + s)` |

#### Score Normalization Mappings
| Raw BM25 | Normalized | Label |
|----------|------------|-------|
| 15 | 0.94 | Strong |
| 8 | 0.89 | Medium |
| 4 | 0.80 | Moderate |
| 1 | 0.50 | Weak |

#### Out-of-Domain (OOD) Detection
- When significant query terms (length ≥ 4) match **no entries**
- AND normalized score < 0.85
- System signals: *"this query appears outside the scope of stored knowledge"*

---

## 2. Data Schema

### 2.1 File System Layout

```
{project_root}/
  .brv/
    context-tree/                      # Root of all curated knowledge
      {domain}/                        # e.g., "architecture", "authentication"
        context.md                     # Domain summary (LLM-generated)
        _index.md                      # Auto-generated summary (excluded from git)
        _manifest.json                 # Manifest (excluded from git)
        {topic}/                       # e.g., "jwt", "module_boundaries"
          context.md                   # Topic summary
          _index.md                    # Auto-generated summary
          {title}.md                   # Knowledge entry (e.g., "token_refresh.md")
          {subtopic}/                  # Optional 3rd level
            context.md                 # Subtopic summary
            _index.md                  # Auto-generated summary
            {title}.md
          _archived/                   # Archived low-importance entries
            {title}.stub.md
            {title}.full.md
        {topic}.abstract.md            # Abstract/summary artifact
        {topic}.overview.md            # Overview artifact
      .gitignore                       # Excludes derived artifacts
      .snapshot.json                   # Tree snapshot for sync
      curate-log/                      # Curate operation history
      query-log/                       # Query history
      dream-log/                       # Dream consolidation history
      review-backups/                  # Pre-curate backups for review
    config.json                        # Project config
```

**Directory nesting limit:** Max 3 segments: `domain` > `topic` > `subtopic`

### 2.2 Knowledge Entry Format (.md file)

Each entry is a markdown file at `.brv/context-tree/{domain}/{topic}/{title}.md` or `.../{subtopic}/{title}.md`.

#### YAML Frontmatter (7 required fields)

```yaml
---
title: <string>                   # Human-readable title
summary: <string>                 # One-line semantic summary
tags: <string[]>                  # Categorization/filtering
related: <string[]>               # Relation paths: "domain/topic/file.md"
keywords: <string[]>              # Search/discovery keywords
createdAt: <ISO 8601>             # Immutable creation timestamp
updatedAt: <ISO 8601>             # Last content modification timestamp
---
```

#### Required Markdown Sections (in order)

```
## Reason
{why was this knowledge captured — motivation, audit trail}

## Raw Concept (provenance)
**Task:** {what is being documented}
**Changes:**
- {change description}
**Files:**
- {source file path}
**Flow:** {process flow description}
**Timestamp:** {ISO 8601}
**Author:** {source attribution}
**Patterns:**
- `{regex}` (flags: {flags}) - {description}

## Narrative (interpreted structure)
### Structure
{file layout, data schema, process hierarchy}

### Dependencies
{prerequisite systems, blockers, relationships}

### Highlights
{key capabilities, deliverables, notable outcomes}

### Rules
{exact constraints, guidelines — preserved verbatim}

### Examples
{concrete use cases, demonstrations}

### Diagrams
**{title}**
```{mermaid|plantuml}
{diagram content}
```

## Facts
- **{subject}**: {statement} [{category: personal|project|preference|convention|team|environment|other}]

---  (snippet separator)
{code/text snippet}
---
{another snippet}
```

**Important:** The Reason, Raw Concept, Narrative, and Facts sections are conditionally emitted — only when their data is non-empty. Snippets are separated by `\n\n---\n\n`.

#### Complete Example

```markdown
---
title: Auth-Billing Circular Dependency
summary: Auth module imports billing which imports user-management back to auth
tags: [architecture, circular-dependency, tech-debt]
related:
  - architecture/module_boundaries/auth_service_deps.md
  - tech_debt/prioritization/q1_2026_assessment.md
keywords: [auth, billing, import-cycle, tree-shaking]
createdAt: 2026-02-03T11:20:00Z
updatedAt: 2026-02-15T09:45:00Z
---

## Raw Concept
**Task:** Map circular dependency between auth, billing,
and user-management modules after v1.8 release.
**Changes:**
- PR #847 introduced auth -> billing import
**Files:**
- src/auth/middleware.ts
- src/billing/subscriptionCheck.ts
**Timestamp:** 2026-02-03T11:20:00Z
**Author:** architecture-agent

## Narrative
### Structure
The dependency cycle forms a triangle:
auth -> billing -> user-management -> auth.

### Rules
Circular deps with runtime imports are severity: high.
Type-only circular imports are severity: low.
```

### 2.3 Context.md Files

Generated at each hierarchy level when the LLM provides context data. **Never auto-generated with templates** — only created when explicitly provided.

#### Domain context.md (`domain/context.md`)
```
# Domain: {domain_name}

## Purpose
{description}

## Scope
Included in this domain:
- {item}

Excluded from this domain:
- {item}

## Ownership
{owner}

## Usage
{guidelines}
```

#### Topic context.md (`domain/topic/context.md`)
```
# Topic: {topic_name}

## Overview
{description}

## Key Concepts
- {concept}

## Related Topics
- {topic} - {relation}
```

#### Subtopic context.md (`domain/topic/subtopic/context.md`)
```
# Subtopic: {subtopic_name}

## Focus
{description}

## Parent Relation
{relationship}
```

### 2.4 Runtime Signals (Sidecar Store)

Runtime ranking signals are stored **separately from markdown frontmatter** (post-commit-5 migration) to avoid dirtying version control.

```typescript
interface RuntimeSignals {
  importance: number;    // [0, 100], default 50
  recency: number;       // [0, 1], default 1.0
  maturity: string;      // "draft" | "validated" | "core", default "draft"
  accessCount: number;   // non-negative int, default 0
  updateCount: number;   // non-negative int, default 0
}
```

**CRUD operations on sidecar:**
- `get(path)` — returns signals for a given context-tree relative path
- `set(path, signals)` — seed defaults on ADD
- `update(path, atomic_fn)` — atomic read-modify-write for access-hit flushes and curate updates
- `delete(path)` — remove entry on DELETE or MERGE source removal

---

## 3. Five Atomic Curate Operations

### 3.1 Operation Schemas

All operations accept the base schema:

```typescript
{
  type: "ADD" | "UPDATE" | "UPSERT" | "MERGE" | "DELETE",
  path: "domain/topic" | "domain/topic/subtopic",  // folder path only
  title?: string,          // becomes {title}.md (auto snake_case)
  content?: {              // required for ADD/UPDATE/UPSERT
    tags: string[],
    keywords: string[],
    rawConcept?: { task, changes[], files[], flow, timestamp, author, patterns[] },
    narrative?: { structure, dependencies, highlights, rules, examples, diagrams[] },
    facts?: [{ statement, category?, subject?, value? }],
    snippets?: string[],
    relations?: string[]
  },
  reason: string,          // WHY — human-readable motivation
  summary?: string,        // one-line semantic summary
  confidence: "high" | "low",
  impact: "high" | "low",

  // MERGE-specific:
  mergeTarget?: string,         // destination folder path
  mergeTargetTitle?: string,    // destination file title

  // Context.md generators:
  domainContext?: { purpose, scope: { included, excluded? }, ownership?, usage? },
  topicContext?: { overview, keyConcepts?, relatedTopics? },
  subtopicContext?: { focus, parentRelation? }
}
```

### 3.2 Operation Behaviors

#### ADD
- Creates `{domain}/{topic}/{title}.md` (or with subtopic)
- Seeds sidecar with default signals
- Auto-creates domain/context.md, topic/context.md, subtopic/context.md if missing (only when context data provided)
- File: `writeFileAtomic(path, content)` — write-to-temp-then-rename

#### UPDATE
- Full content replacement of existing file
- Backs up current content to `review-backups/` (first-write-wins)
- Parses existing file to detect **structural loss** — if LLM drops content that existed before, auto-merge it back
- Applies curate update bumps to sidecar: `importance += 5`, `recency = 1.0`, `updateCount += 1`
- Recomputes maturity via `determineTier()`

#### UPSERT
- Checks if file exists; delegates to ADD (new) or UPDATE (existing)
- Reduces pre-check overhead for the LLM

#### MERGE
- Combines source file into target file, then deletes source
- Requires: `path` + `title` (source), `mergeTarget` + `mergeTargetTitle` (target)
- **Merge strategy:**
  - relations: union + dedup
  - tags: union + dedup
  - keywords: union + dedup
  - rawConcept scalars: source wins; arrays: concatenate + dedup (target first)
  - narrative: concatenate all sub-sections with `\n\n` separator
  - facts: concatenate + dedup by statement (case-insensitive)
  - snippets: concatenate + dedup
  - timestamps: earliest createdAt, fresh updatedAt
  - scoring: `mergeScoring()` — importance=max, recency=max, accessCount=sum, updateCount=sum+1, maturity=higher tier
- Sidecar merge: source signals merged into target signals, source sidecar deleted

#### DELETE
- With `title`: deletes specific `{title}.md`
- Without `title`: deletes entire folder recursively
- Drops sidecar entry for each deleted file
- Removes derived siblings (.abstract.md, .overview.md)
- Always flagged for human review (`needsReview: true`)

### 3.3 Stateful Feedback Loop

**Output returned to the agent after every curate call:**

```json
{
  "applied": [
    {
      "type": "ADD",
      "path": "auth/jwt",
      "status": "success",
      "filePath": "/abs/path/to/auth/jwt/token_refresh.md",
      "message": "Created auth/jwt/token_refresh.md with 2 snippets. Reason: ...",
      "summary": "JWT refresh token rotation strategy with 5-min TTL",
      "confidence": "high",
      "impact": "low",
      "needsReview": false,
      "reason": "Documented after PR #42 decision"
    },
    {
      "type": "MERGE",
      "path": "analysis/energy",
      "status": "failed",
      "message": "Source file does not exist: analysis/energy/old_report.md",
      "confidence": "high",
      "impact": "high",
      "needsReview": true,
      "reason": "Consolidating energy reports"
    }
  ],
  "summary": {
    "added": 1,
    "updated": 0,
    "merged": 0,
    "deleted": 0,
    "failed": 1
  }
}
```

**Seen by the agent after each call.** The agent can adapt: retry, skip, or flag the gap.

### 3.4 Curation Pipeline (3 Phases)

```
┌──────────────────────────────────────────────┐
│  Phase 1: Preprocessing                       │
│  • Read source files (max 5, 40K chars each) │
│  • PDF → text, code → 2000 lines max         │
│  • Validate file existence                   │
├──────────────────────────────────────────────┤
│  Phase 2: Pre-Compaction                      │
│  L1: Normal LLM summarization                │
│  L2: Aggressive LLM at 0.6× token budget     │
│  L3: Binary-search prefix truncation (guar.) │
├──────────────────────────────────────────────┤
│  Phase 3: Curation                            │
│  • LLM runs in sandbox with ToolsSDK         │
│  • tools.curate.recon() — assess content    │
│  • tools.curate.mapExtract() — chunked ext. │
│  • tools.curate.groupBySubject() — organize  │
│  • tools.curate.dedup() — deduplicate       │
│  • Up to 50 iterations                       │
│  • Returns structured operations            │
├──────────────────────────────────────────────┤
│  Phase 4: Post-processing                     │
│  • Snapshot diff → detect changed paths      │
│  • Propagate summary staleness               │
│  • Rebuild manifest                          │
│  • Increment dream curation counter          │
└──────────────────────────────────────────────┘
```

---

## 4. Symbol Tree

### 4.1 Symbol Kinds (Ordered by Depth)

| Kind | Value | Description |
|------|-------|-------------|
| `Domain` | 1 | Root-level folder |
| `Topic` | 2 | Second-level folder |
| `Subtopic` | 3 | Third-level folder (or deeper, folded) |
| `Context` | 4 | Leaf `.md` file (excluding `context.md`) |
| `Summary` | 5 | Not currently used in tree builder |

### 4.2 Data Structures

```rust
struct MemorySymbol {
    kind: MemorySymbolKind,
    name: String,
    path: String,              // Relative path from context-tree root
    parent: Option<Box<MemorySymbol>>,
    children: Vec<MemorySymbol>,
    metadata: SymbolMetadata,
    summary_info: Option<SummaryInfo>,
}

struct SymbolMetadata {
    importance: f64,
    keywords: Vec<String>,
    maturity: String,
    tags: Vec<String>,
}

struct SummaryInfo {
    condensation_order: u32,
    token_count: u32,
}

struct MemorySymbolTree {
    root: Vec<MemorySymbol>,               // Top-level domains
    symbol_map: HashMap<String, MemorySymbol>,  // O(1) path → node
}

struct ReferenceIndex {
    forward_links: HashMap<String, Vec<String>>,  // source → targets
    backlinks: HashMap<String, Vec<String>>,       // target → sources
}
```

### 4.3 Build Algorithm (5 Passes)

```
Input:  document_map: HashMap<path, Document>
        summary_map: Option<HashMap<path, SummaryDoc>>
Output: MemorySymbolTree

Pass 1: Separate documents
  for each (path, doc) in document_map:
    if filename == "context.md" → context_files
    else → leaf_documents

Pass 2: Create folder nodes
  for each doc in document_map:
    collect all ancestor folder paths
  for each folder_path:
    get_or_create_folder_node(symbol_map, root, folder_path)

Pass 3: Absorb context.md
  for each doc in context_files:
    folder_path = parent directory
    folder_node = symbol_map[folder_path]
    symbol_map[doc.path] = folder_node  // context.md resolves to folder

Pass 4: Create leaf Context nodes
  for each doc in leaf_documents:
    parent = symbol_map[folder_path]
    context_node = MemorySymbol {
        kind: Context(4),
        path: doc.path,
        name: doc.title or filename without .md
    }
    parent.children.push(context_node)
    symbol_map[doc.path] = context_node

Pass 5: Attach summary info
  for each summary in summary_map:
    folder_node = symbol_map[parent_path]
    folder_node.summary_info = { condensation_order, token_count }

Sort: root domains + all children alphabetically by name
```

### 4.4 Reference Index (Bidirectional)

Built by parsing `@domain/topic/file.md` annotations: regex `RELATION_PATTERN = /@([\w-]+\/[\w-]+(?:\/[\w-]+)?\/[\w-]+(?:\.[\w]+)?)(?![\w/-])/g`

```rust
struct ReferenceIndex {
    forward_links: HashMap<String, Vec<String>>,  // source → list of targets
    backlinks: HashMap<String, Vec<String>>,       // target → list of sources
}
```

**Build:**
```
for each (path, doc) in document_map:
    relations = parse_relations(doc.content)  // extract @-annotations
    forward_links[path] = relations
    for each target in relations:
        backlinks[target].push(path)
```

### 4.5 Ambient Awareness (System Prompt Injection)

For `query` and `curate` commands, inject a compact tree listing:

```
<context-tree-structure>
## Current Context Tree Structure

The following is the current hierarchy of curated knowledge in `.brv/context-tree/`:

```
.brv/context-tree/
  architecture/
    context.md (knowledge content)
    module_boundaries/
      context.md (knowledge content)
      auth_billing_cycle.md
  database/
    _index.md (summary)
    migrations/
      context.md (knowledge content)
```

[2 additional entries not shown]

## Structure Guide
- Each top-level folder is a **domain**
- Inside domains are **topics** as .md files or subfolders with `context.md`
- `context.md` files contain the curated knowledge content
- `_index.md` files are auto-generated summaries
- `_archived/` contains archived low-importance entries
...
</context-tree-structure>
```

**Rules:**
- Depth limit: 5 (default)
- Entry limit: 200 (default)
- Directories before files, sorted alphabetically
- `_archived/` shows count only
- When `search_knowledge` tool is available: inject search instructions instead

---

## 5. Constants (Config)

### 5.1 Directory/File Names

```rust
const BRV_DIR: &str = ".brv";
const CONTEXT_TREE_DIR: &str = "context-tree";
const CONTEXT_TREE_BACKUP_DIR: &str = "context-tree-backup";
const CONTEXT_TREE_CONFLICT_DIR: &str = "context-tree-conflicts";
const CONTEXT_FILE: &str = "context.md";
const CONTEXT_FILE_EXTENSION: &str = ".md";
const README_FILE: &str = "README.md";
const SNAPSHOT_FILE: &str = ".snapshot.json";
const PROJECT_CONFIG_FILE: &str = "config.json";

const SUMMARY_INDEX_FILE: &str = "_index.md";
const ARCHIVE_DIR: &str = "_archived";
const STUB_EXTENSION: &str = ".stub.md";
const FULL_ARCHIVE_EXTENSION: &str = ".full.md";
const ABSTRACT_EXTENSION: &str = ".abstract.md";
const OVERVIEW_EXTENSION: &str = ".overview.md";
const MANIFEST_FILE: &str = "_manifest.json";

const CURATE_LOG_DIR: &str = "curate-log";
const CURATE_LOG_ID_PREFIX: &str = "cur";
const QUERY_LOG_DIR: &str = "query-log";
const QUERY_LOG_ID_PREFIX: &str = "qry";
const DREAM_LOG_DIR: &str = "dream-log";
const DREAM_LOG_ID_PREFIX: &str = "drm";
const REVIEW_BACKUPS_DIR: &str = "review-backups";

const DEFAULT_BASE_PATH: &str = ".brv/context-tree";
const DEFAULT_LLM_MODEL: &str = "gemini-3-flash-preview";
const DEFAULT_BRANCH: &str = "main";
```

### 5.2 Scoring Constants

```rust
const W_RELEVANCE: f64 = 0.6;
const W_IMPORTANCE: f64 = 0.2;
const W_RECENCY: f64 = 0.2;

const DECAY_RECENCY_FACTOR: f64 = 30.0;        // τ = 30
const DECAY_IMPORTANCE_FACTOR: f64 = 0.995;     // per day

const ACCESS_IMPORTANCE_BONUS: f64 = 3.0;
const UPDATE_IMPORTANCE_BONUS: f64 = 5.0;

const PROMOTE_TO_VALIDATED: f64 = 65.0;
const PROMOTE_TO_CORE: f64 = 85.0;
const DEMOTE_FROM_CORE: f64 = 60.0;
const DEMOTE_FROM_VALIDATED: f64 = 35.0;

const DEFAULT_IMPORTANCE: f64 = 50.0;
const DEFAULT_RECENCY: f64 = 1.0;
const ARCHIVE_IMPORTANCE_THRESHOLD: f64 = 35.0;
```

### 5.3 Search Constants

```rust
const SEARCH_TITLE_BOOST: f64 = 5.0;
const SEARCH_PATH_BOOST: f64 = 1.5;
const SEARCH_CONTENT_BOOST: f64 = 1.0;
const SEARCH_MAX_RESULTS: usize = 32;
const SEARCH_MAX_CONTENT_LENGTH: usize = 8000;
const SEARCH_FUZZY_THRESHOLD: f64 = 0.2;
const SEARCH_OOD_THRESHOLD: f64 = 0.85;
const SEARCH_HIGH_CONFIDENCE: f64 = 0.93;
const SEARCH_MINIMUM_SCORE: f64 = 0.85;
const SEARCH_GAP_THRESHOLD: f64 = 0.08;

const CACHE_FUZZY_THRESHOLD: f64 = 0.6;  // Jaccard

const TIER_3_MAX_TOKENS: usize = 1024;
const TIER_3_TEMPERATURE: f64 = 0.3;
const TIER_4_MAX_TOKENS: usize = 2048;
const TIER_4_TEMPERATURE: f64 = 0.5;
const TIER_4_MAX_ITERATIONS: usize = 50;
```

### 5.4 Curation Constants

```rust
const MAX_FILES_PER_OPERATION: usize = 5;
const MAX_CHARS_PER_FILE: usize = 40_000;
const MAX_LINES_PER_FILE: usize = 2000;
const MAX_PDF_PAGES: usize = 50;
const AGENT_MAX_ITERATIONS: usize = 50;
```

---

## 6. Relation Annotations

**Syntax:** `@domain/topic/file.md` or `@domain/topic/subtopic/file.md`

**Regex:**
```
/@([\w-]+\/[\w-]+(?:\/[\w-]+)?\/[\w-]+(?:\.[\w]+)?)(?![\w/-])/g
```

**Normalization:**
- Remove `@` prefix
- Ensure `.md` extension
- Lowercase
- Replace spaces with underscores

**Example:**
```
## Relations
@architecture/module_boundaries/auth_service_deps.md
@architecture/module_boundaries/billing_integration.md
```

---

## 7. Codebase Mapping (TS → Rust Port)

| TypeScript Module | Rust Module | Purpose |
|---|---|---|
| `memory-scoring.ts` | `scoring.rs` | Compound score, decay, tier determination, merge |
| `runtime-signals-schema.ts` | `signals.rs` | Signal types, defaults, Zod → Rust struct |
| `relation-parser.ts` | `relations.rs` | `@path` parse, format, normalize |
| `markdown-writer.ts` | `markdown.rs` | Generate/parse context files (frontmatter + sections) |
| `curate-tool.ts` | `curate.rs` | 5 operation implementations |
| `context-tree-structure-contributor.ts` | `ambient.rs` | System prompt directory listing |
| `context-tree-store.ts` | `buffer.rs` | Bounded buffer with 3-level compaction |
| `memory-symbol-tree.ts` | `symbol_tree.rs` | Symbol tree builder, O(1) lookup, reference index |
| `memory-contributor.ts` | `memories.rs` | Load agent memories into system prompt |
| `memory-deduplicator.ts` | `dedup.rs` | LLM-based memory deduplication |
| `search-executor.ts` | `search.rs` | BM25 search orchestration |
| `curate-executor.ts` | `curate_exec.rs` | Curation pipeline (3 phases) |
| `constants.ts` | `constants.rs` | All path/name/scoring constants |
| `file-context-tree-service.ts` | `tree_service.rs` | Init/delete/exists/resolve |
| `file-context-tree-writer-service.ts` | `tree_writer.rs` | Sync context tree files |
| `file-context-tree-summary-service.ts` | `tree_summary.rs` | Summary propagation |
| `curate-service.ts` | `curate_service.rs` | Sandbox curate wrapper |
| `curate-result-parser.ts` | `curate_parser.rs` | Parse curate output from code_exec |
| `memory-manager.ts` | `memory_manager.rs` | CRUD for agent memories (blob storage) |

---

## 8. Edge Cases & Implementation Notes

1. **Atomic writes:** All file operations must use write-to-temp-then-rename. If process crashes mid-write, the context tree remains consistent.

2. **Sidecar resilience:** Sidecar write failures never block markdown operations. Best-effort with logging.

3. **Hysteresis maturity:** Never use simple threshold comparison. Always check current tier before promoting/demoting (see `determineTier()`).

4. **Structural loss detection on UPDATE:** Before overwriting an existing file, parse the old content. If the LLM dropped sections (rules, diagrams, facts), auto-merge them back. Elevate impact to "high" if structural loss is detected.

5. **Backup first-write-wins:** Review backups only capture the first write state. Subsequent operations on the same file between pushes do not overwrite the backup.

6. **MERGE atomicity:** If the sidecar merge fails after markdown merge succeeds, the source sidecar becomes an orphan. Track via `pruneOrphans()` in the backlog.

7. **MiniSearch requirement:** The Rust port must implement or bind a BM25 full-text search library supporting: field boosting, fuzzy matching (0.2 threshold), prefix search, and score normalization `s/(1+s)`.

8. **Context.md creation rule:** context.md files are NEVER created automatically with templates. The LLM must explicitly provide `domainContext`, `topicContext`, or `subtopicContext` data.

9. **Path format invariant:** Paths are always `domain/topic` (2 segments) or `domain/topic/subtopic` (3 segments). NEVER include filenames or extensions in path.

10. **snake_case everywhere:** Domain names, topic names, subtopic names, and titles are all normalized to snake_case automatically.
