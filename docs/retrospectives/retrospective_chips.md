# Retrospective: High-Fidelity ContentEditable Chips

## 1. The Context
Implementing "chips" (UI blocks like `@terminal` or `dark mode`) inside a standard `ContentEditable` div while maintaining native-feeling focus and selection.

---

## 2. The Failed Approach: Destructive `innerHTML`
Initially, I attempted to replace the entire `innerHTML` of the input every time a keyword was detected.

### The Thinking
"I can just use a regex to wrap keywords in HTML, then use a character-count offset to restore the cursor position."

### Why it was Wrong
1.  **DOM Destruction**: Setting `innerHTML` destroys all existing DOM nodes. The browser loses the "active" context for selection.
2.  **Selection Slop**: Restoring selection by character offset is flaky. Indices in `innerText` (plain text) rarely map perfectly to the underlying DOM tree after complex elements are inserted.
3.  **Visual Jitter**: The entire input "flashes" because the UI is being rebuilt from scratch.

---

## 3. The Second Failure: Recursive Scanning
I switched to a `TreeWalker` to surgically insert nodes, but introduced a new glitch.

### The Thinking
"I'll walk all text nodes and replace keywords with `insertNode(chip)`."

### Why it was Wrong (The Glitch)
The walker was finding keywords **inside** the generated chips. Since the chip's label (e.g. "dark mode") was itself a text node, the scanner would find it, wrap it in *another* chip, find that, and so on. This caused the "nested icon" explosion.

---

## 4. The Final Solution: Surgical & Filtered DOM
The current implementation uses a **Surgical + Filtered** approach.

### The Implementation
1.  **Direct DOM API**: Use `Range.deleteContents()` and `Range.insertNode(chip)`. This keeps existing DOM nodes alive and preserves the browser's native history/focus.
2.  **Node Filtering**: Use a `TreeWalker` with an explicit `NodeFilter` that rejects any node residing inside a `[contenteditable="false"]` parent.
3.  **Manual Caret Hand-off**: After a chip is surgically inserted, manually move the selection to `setStartAfter(chip)` to ensure the user can keep typing immediately.

### Key Takeaways for Future Systems
> [!IMPORTANT]
> **Never use `innerHTML` in a focused input.** It is the "nuclear option" and will always break high-fidelity interactions.

> [!TIP]
> When walking a DOM tree for transformations, **always filter for boundaries**. Use `closest('[contenteditable="false"]')` or equivalent to ensure you aren't transforming your own generated UI.
