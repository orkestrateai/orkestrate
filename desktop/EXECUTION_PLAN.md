# Orkestrate v2 Execution Plan

**Status:** To execute | **Goal:** Ship a local-first AI desktop app

---

## The Big Picture

```
User downloads Orkestrate
→ First launch: hardware scan → download Gemma 4 model → start chatting
→ Zero API keys, zero signup, zero cloud
→ Everything runs on their machine
```

---

## Execution Steps (Ordered)

### Step 1: Strip the Memory System
Remove all cloud dependencies and expensive pipeline. Keep only what's solid.

**Files to delete:**
- `src-tauri/src/ai/memory/extraction/` (entire folder — analyzer, extractors, validator, types)
- `src-tauri/src/ai/memory/embeddings.rs`
- `src-tauri/src/ai/memory/proactive.rs`
- `src-tauri/src/ai/memory/retrieval.rs`
- `src-tauri/src/ai/memory/profile.rs`
- `src-tauri/src/ai/memory/entity.rs`
- `src-tauri/src/ai/memory/constants.rs`
- `src-tauri/src/ai/memory/signals.rs`
- `src-tauri/src/ai/memory/scoring.rs`

**Files to simplify:**
- `session.rs` — remove topic_history, entity_bindings, active_entities. Keep: recent_turns, summary, last_messages
- `manager.rs` — remove search_semantic. Keep: search (BM25 only), store_extracted_fact, get_user_profile, update_user_profile
- `storage.rs` — remove embedding methods. Keep: file reads/writes, frontmatter
- `service.rs` — simplify extract_and_store (no pipeline, just store)
- `handler.rs` — remove `aisdk` usage, remove proactive memory, remove entity_ctx, simplify to use local inference

**Dependencies to remove from Cargo.toml:**
- `aisdk` (entire git dependency)
- `strsim`
- Remove `schemars` if only used by aisdk

### Step 2: Add Local Inference Dependencies
**Add to Cargo.toml:**
- `llama-cpp-rs = "2"`
- `sysinfo = "0.33"`
- `reqwest` (keep, needed for downloads + web search)
- `tokio-util` (streaming downloads with progress)
- `sha2`, `hex` (model integrity verification)

### Step 3: Build `local_inference/` Module
Create these files:
- `hardware.rs` — detect CPU/GPU/RAM/disk
- `model.rs` — llama-cpp-rs wrapper (load, cache, unload, warm-up)
- `inference.rs` — token generation with streaming, embeddings
- `chat.rs` — chat prompt assembly + system prompt

### Step 4: Build `model_manager/` Module
- `download.rs` — HuggingFace GGUF download with resume + progress bars
- `onboarding.rs` — model selection logic, hardware rec

### Step 5: Build Onboarding UI
- Welcome screen (first launch only)
- Hardware scan screen (animated, shows detected specs)
- Model selection (auto-recommended, user can override)
- Download progress (speed, ETA, resumable)
- Loading screen (model warm-up)

### Step 6: Wire Everything
- Replace aisdk chat handler with local inference
- Rebuild system prompt (simpler, no extraction context)
- Connect web search (SearXNG or remove)
- Connect fetch_url tool

### Step 7: Polish + Ship
- Tauri window size: 1280x800
- App name: "Orkestrate"
- Icons (already exist)
- Tauri updater (GitHub releases)
- GitHub Actions build pipeline (Windows + macOS + Linux)

---

## Architecture Diagrams

### Filesystem Layout
```
.brv/
├── models/
│   ├── gemma-4-2b-q4.gguf
│   ├── gemma-4-9b-q4.gguf
│   ├── gemma-4-27b-q4.gguf
│   └── active_model.txt        # Which model is selected
├── context-tree/               # Existing memory store
│   ├── user.md
│   ├── identity/
│   ├── relationships/
│   └── ...
├── session-summaries/          # Existing session summaries
│   └── {session_id}.json
└── settings.json               # App settings
```

### Chat Flow (Single Local Inference Call)
```
User types
  → handler.rs receives message
  → Build system prompt (persona + profile + session context + tools)
  → local_inference::chat::generate(
        model, context, prompt, sampler
     )
  → Stream tokens via mpsc channel → SSE to frontend
  → On complete: save session, generate summary
```

### Memory Flow (Zero LLM Calls)
```
User: "Remember that Mia is my sister"
  → store_memory tool
  → Write to .brv/context-tree/relationships/family/mia.md
  → Append to user.md ## Relationships
  → Done

User: "Who is Mia?"
  → search_context tool
  → BM25 search across .brv/context-tree/
  → Return results as JSON
  → Done
```

---

## Model Information

| Variant | GGUF Size | Min RAM | GPU | Source |
|---------|-----------|---------|-----|--------|
| Gemma 4 2B Q4_K_M | ~1.2 GB | 4 GB | No | huggingface.co/bartowski |
| Gemma 4 9B Q4_K_M | ~5 GB | 8 GB | Optional | huggingface.co/bartowski |
| Gemma 4 27B Q4_K_M | ~15 GB | 16 GB | Recommended | huggingface.co/bartowski |

**Download URL pattern:** `https://huggingface.co/{user}/gemma-4-{size}-GGUF/resolve/main/gemma-4-{size}-Q4_K_M.gguf`

---

## Questions for you

1. **Should I start executing Step 1 (stripping)?**
2. **SearXNG** — do you want me to research this now, or ship with fetch_url only and add web_search later?
3. **Model size for default** — should we default to 2B for the smoothest experience, and let power users upgrade to 9B/27B? Or default to 9B and warn if system is too slow?
