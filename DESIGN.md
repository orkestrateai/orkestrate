# Orkestrate Design Language

Inspired by the minimalist, high-fidelity aesthetic of modern cognitive tools like Littlebird, the Orkestrate design system prioritizes data density, typographical clarity, and surgical minimalism.

## 1. Principles
- **No-Slop Design**: Eliminate all decorative elements that do not serve a functional purpose. No generic shadows, no "AI bot" icons, no rounded-corner cards for every item.
- **Typographic Hierarchy**: Use font weight and size to distinguish information layers rather than backgrounds or borders.
- **Vibrant Warmth**: A baseline palette of warm off-whites (`#FCFBF8`) and deep, softened grays ensures the workspace feels like a "digital paper" rather than a software interface.
- **Temporal Flow**: Messages and "Vault" records are presented with generous vertical rhythm to emphasize the chronological progression of thought.

## 2. Visual Palette (Tokens)
- **Background**: `#FCFBF8` (Light) / `#151515` (Dark)
- **Primary Text**: `#292929` (Light) / `#EDEDED` (Dark)
- **Secondary Text**: `#71717A`
- **Accent**: `#007AFF` (Apple Blue)
- **Border**: `rgba(0, 0, 0, 0.06)` (Light) / `rgba(255, 255, 255, 0.08)` (Dark)

## 3. Component Patterns

### The Chat Feed
- **Assistant Messages**: Rendered as raw, formatted markdown on the canvas. No containing bubble. 100% width.
- **User Messages**: Right-aligned, minimal pill containers. Subtle background contrast without heavy shadows.
- **Thinking Trace**: Sub-textual reasoning blocks, italicized or low-opacity, collapsible to maintain focus on the final thought.

### The Input Orbit
- **Rounded Base**: 20px border radius with a thin, sharp border.
- **Interactive Cluster**: Bottom-row integration of the "Context Meter" (Circle), Model Selector, and functional toggles (`+`, `Search`).
- **Send Trigger**: High-contrast circular button with a single-stroke arrow icon.

### The Memory Vault
- **Dynamic Graph**: A minimalist SVG network with varying stroke weights based on connection priority.
- **Dense Records**: A multi-column layout for entities and memory feeds, using monospace timestamps for chronological rigor.

## 4. Typography
- **Primary**: "Inter", UI-standard sans-serif stack.
- **Headings**: Medium weight with tighter letter-spacing (-0.03em) to feel premium and grounded.
- **Labels**: Small (10px - 11px) with slight tracking for functional headers (e.g., "VAULT").

## 5. Interactions
- **State Transitions**: 0.4s cubic-bezier cross-fades between Chat and Vault views.
- **Physics**: Nodes in the Vault have simulated momentum and friction, responding to user drags without layout "popping."
- **Focus States**: Active inputs and buttons use subtle border-color changes rather than outer glows.
