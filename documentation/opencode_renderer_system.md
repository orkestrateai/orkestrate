# OpenCode Renderer System (Reverse-Engineered)

## Purpose

This document explains the OpenCode transcript/event system that was reverse-engineered from raw telemetry and screenshots, and how the Orkestrate web renderer reproduces that behavior.

It covers:

1. The event model used by OpenCode.
2. Why naive rendering fails.
3. The normalization and reconciliation algorithm used in the dashboard.
4. The tool-call lifecycle handling.
5. The race-condition protections added in plugin + ingest paths.

---

## Files Involved

Primary renderer implementation:

- `src/app/dashboard/agent-chat/OpenCodeRenderer.tsx`

Upstream event storage + telemetry producers:

- `src/app/api/telemetry/ingest/route.ts`
- `public/tools/opencode/plugin.ts`

Event feed source consumed by dashboard:

- `src/app/api/agent-sessions/route.ts`
- `src/app/dashboard/agent-chat/hooks.ts`

---

## OpenCode Event Model (What We Confirmed)

OpenCode does not emit a single "final message payload" in one shot. It emits an event stream with incremental and canonical updates.

### Core event shapes

1. `message.updated`
- Metadata for a message (`role`, `parentID`, `modelID`, `finish`, `time.created`, `time.completed`, tokens).
- Can be emitted multiple times for the same message.

2. `message.part.delta`
- Incremental text patch for a part (`partID`, `messageID`, `field: "text"`, `delta`).
- Arrives frequently during streaming.

3. `message.part.updated`
- Canonical snapshot for a part (`text`, `type`, `state`, `time`, etc.).
- Used for text parts, reasoning parts, tool parts, step markers.

4. `tool_start` / `tool_end` (plugin side-channel telemetry)
- Provides reliable tool argument/result envelopes keyed by `callID`.
- Complements `message.part.updated` tool state changes.

5. Session-level events
- `session.status`, `session.updated`, `session.diff`, `session.idle`.
- Drive sidebar/status metadata, not core text composition.

---

## Why Naive Rendering Breaks

Raw event order is not guaranteed to be strictly chronological by logical message progression.

Observed failure modes:

1. Late deltas after a finalized part.
- Example: final canonical text is followed by older, delayed `delta` fragments.
- Naive append corrupts tail text.

2. Tool status regressions.
- Example: `running` -> `pending` -> `running` -> `completed` due to out-of-order snapshots.
- Naive replacement can visually "go backwards."

3. Multi-message assistant turns.
- OpenCode may emit `finish: "tool-calls"` message, then a continuation assistant message with same `parentID`.
- Naive "one assistant message per turn" splits what is visually one turn in OpenCode UI.

---

## Renderer Architecture in Orkestrate

The renderer builds a normalized in-memory graph before any UI output.

### Normalized entities

1. `MessageNode` keyed by `messageID`
- Stores role, parentID, model, finish state, created/completed times.
- Contains ordered part IDs.

2. `PartNode` keyed by `partID` inside each message
- Stores part type (`text`, `reasoning`, `tool`, `step-start`, `step-finish`), text, tool state, time.
- Tracks `sealed` state for finalized text/reasoning parts.

3. `callID -> (messageID, partID)` map
- Links tool side-channel (`tool_start`, `tool_end`) to the authoritative tool part.

4. Pending side-channel buffers
- `pendingToolStart` and `pendingToolEnd` hold tool events that arrive before tool part snapshot.

### Build flow

1. Iterate logs once and upsert messages/parts.
2. Apply deltas to text parts only when allowed.
3. Reconcile tool state from both event stream and side-channel.
4. Sort messages by stable key (`createdAtMs`, then first-seen order).
5. Group assistant messages by same `parentID` into one visual block.
6. Render parts in stable part order, hiding internal step markers.

---

## Reconciliation Rules

### Text/reasoning parts

1. `message.part.updated` is canonical.
2. `message.part.delta` appends only if:
- `field === "text"`
- delta is non-empty
- part is not sealed
3. Seal behavior:
- A part is sealed when part snapshot has `time.end`, or when parent message has `time.completed`.
- Sealed parts ignore late deltas.

This is the key fix for "tail text corruption" like malformed `Using skills ...` endings.

### Tool parts

Tool state is deep-merged, not replaced.

Rules:

1. Status precedence:
- `pending < running < completed`
- Never downgrade status from out-of-order events.

2. Input merge:
- Prefer non-empty incoming input fields.

3. Output merge:
- Prefer richer/longer output if one output contains the other.

4. Time merge:
- `start = min(start)`
- `end = max(end)`

5. Side-channel correlation:
- `tool_start` and `tool_end` attach by `callID`.
- If part not present yet, queue and replay after part appears.

---

## Turn Grouping Logic

OpenCode frequently emits:

1. Assistant message A with `finish: "tool-calls"` (reasoning + tool actions).
2. Assistant message B (same `parentID`) with final user-facing response and `finish: "stop"`.

Renderer behavior:

- Adjacent assistant messages with the same `parentID` are grouped into one visual assistant block.

Result:

- Matches OpenCode UX where tool card and follow-up answer appear in one continuous turn.

---

## Rendering Output Contract

The current renderer intentionally mirrors OpenCode-style structure:

1. User prompt block.
2. `Thinking:` reasoning block.
3. Tool card block for `type: "tool"` parts.
- Title from `state.title` or input description.
- Command line from `state.input.command`.
- Output preview with expand/collapse.
4. Assistant markdown text block.
5. Footer line:
- agent, model, and computed duration.

Markdown/text rendering uses Streamdown plugins:

- `cjk`
- `code`
- `math`
- `mermaid`

---

## Upstream Reliability Fixes Added

To reduce event loss before rendering, two upstream changes were implemented.

### 1) Ingest append race fix

File: `src/app/api/telemetry/ingest/route.ts`

Previous behavior:

- Read transcript array -> append in JS -> write full array.
- Concurrent requests could overwrite each other.

Current behavior:

- Atomic SQL append inside transaction using JSONB array operations.
- Per-request append is done in database expression, preventing lost updates under concurrency.

### 2) Plugin burst handling

File: `public/tools/opencode/plugin.ts`

Previous behavior:

- Fire-and-forget `fetch`.
- Under burst/network jitter, events could fail silently.

Current behavior:

- Bounded local queue.
- Retry with backoff.
- Timeout protection.
- Graceful disconnect flush.
- Sequence numbers in envelope for better observability.

---

## What This Means Operationally

With these changes, the dashboard behaves like OpenCode even when telemetry is noisy:

1. Correct final text after streaming.
2. Stable tool cards despite status jitter.
3. Proper grouping of tool-call continuation turns.
4. Reduced upstream loss from both producer and ingest sides.

---

## Known Constraints

1. If upstream emits completely conflicting canonical snapshots with different full texts, the latest canonical snapshot wins.
2. Event timestamps are used for display, not as strict source-of-truth ordering.
3. This system is optimized for OpenCode event semantics; other agent families may need adapter-specific rules.

---

## Future Enhancements (Optional)

1. Persist normalized transcript artifacts per session to avoid recompute on every refresh.
2. Add explicit event monotonic counters per part from producer to make merge decisions deterministic.
3. Render tool output with syntax-aware shell blocks and richer truncation controls.
4. Add debug inspector toggle showing normalized graph vs raw events.
