# Orkestrate Design System

This document outlines the core design philosophy, visual tokens, interaction patterns, and perceptual strategies for the Orkestrate orchestration environment.

---

## 1. Design Philosophy

Our interface is built for developers and operators managing complex multi-agent systems. The aesthetic is heavily inspired by high-density, high-utility tools like Claude and Linear.

- **Quiet Hierarchy:** Avoid heavy boxes, thick borders, and high-contrast containers. Use subtle background shifts (`hover:bg-white/[0.03]`) and typography to group information.
- **Hide, Don't Disable:** If a user cannot change a system-required setting, do not show a disabled toggle. Hide the interactive element entirely or remove the item from the list to reduce cognitive load.
- **Data over Decoration:** Text is the primary interface. Use monospace fonts for technical entities (tool IDs, agent names) to separate them from prose.
- **Tactile Micro-interactions:** UI changes should feel physical but snappy. We rely on custom spring-like bezier curves rather than flat linear transitions.

---

## 2. Color Palette (Dark Mode First)

We use a strictly controlled, neutral grayscale palette to prevent color fatigue. Color is reserved *exclusively* for semantic meaning (e.g., Red for destructive actions, Green for success).

### Backgrounds

| Token | Hex | Usage |
|---|---|---|
| App Background | `#0A0A0B` | Deepest black — main app canvas |
| Surface Default | `#16181A` | Standard cards, inputs, isolated panels |
| Surface Elevated | `#1C1C1D` | Slightly raised surfaces |
| Surface Hover | `#2B2D31` / `white/[0.03]` | Interactive element backgrounds |

### Borders

| Token | Value | Usage |
|---|---|---|
| Subtle / Dividers | `white/5` or `#232529` | Section separators, list dividers |
| Interactive / Focus | `#3A3F4A` | Input outlines, focused states |

### Typography (Text)

| Token | Hex | Usage |
|---|---|---|
| Primary | `#EBEBEB` | Headings, active labels |
| Secondary | `#D1D3D8` | Body, standard UI copy |
| Tertiary | `#8A8F98` | Descriptions, muted hints |
| Disabled / Inactive | `#5E626B` | Placeholder, inactive items |

### Semantic Color

Color is introduced only to communicate system state. Never use color for decoration.

| State | Color | Usage |
|---|---|---|
| Destructive | Red | Delete, remove, irreversible actions |
| Success | Green | Completion, active agent, healthy status |
| Warning | Amber | Degraded, rate-limited, approaching threshold |
| Info / Accent | Blue | Links, selected state, focused ring |

---

## 3. Typography

We use a two-font system: a clean sans-serif for general UI and a strict monospace for all technical data.

- **Sans-Serif (UI):** System fonts — Inter, Geist, SF Pro.
- **Monospace (Data):** System mono — Geist Mono, JetBrains Mono, SF Mono.

### Scale & Usage

| Role | Size | Style | Color |
|---|---|---|---|
| Page Title | `24px` | `font-bold tracking-tight` | `#FFFFFF` |
| Section Title | `18px` | `font-medium` | `#F2F2F2` |
| Standard UI Label | `14px` | `font-medium` | `#EBEBEB` |
| Secondary Text | `13px` | `font-normal` | `#8A8F98` |
| Micro / Badges | `11px` | `font-medium uppercase tracking-wider` | — |
| Technical Entities | `13px` | `font-mono` | `#D1D3D8` |

### Golden Ratio Type Scale

The scale above is anchored by φ (1.618). Starting from a `13px` base, each step multiplies by ~1.618:

```
13px  →  base (Secondary Text)
14px  →  UI Label     (pragmatic rounding)
18px  →  Section Title
29px  →  Page Title   (pure φ³ from 13px ≈ 29px; rounded to 24px for density)
```

Use this to derive any future type levels. Never add a size that breaks the harmonic ladder by less than a ~1.2× jump.

---

## 4. Spacing & Layout

We use a dense but breathable spacing scale optimized for desktop command centers.

### Rhythm

| Context | Token |
|---|---|
| Between major sections | `space-y-6` or `space-y-8` |
| Tight lists / grouped items | `space-y-1` or `space-y-2` |

### Click Targets

Interactive rows and buttons must never be shorter than **36–40px**.

| Element | Padding |
|---|---|
| Standard button | `px-4 py-1.5` |
| List item row | `py-2.5 px-3.5` |

### Golden Ratio Spacing Scale

For spacing tokens, derive values from a φ-based ladder starting at `4px`. Each step ≈ previous × 1.618:

| Token | Value | Usage |
|---|---|---|
| `space-1` | `4px` | Atomic unit — icon gap, tight nudge |
| `space-2` | `6px` | Inline element gap |
| `space-3` | `10px` | Label to input |
| `space-4` | `16px` | Row padding, standard gap |
| `space-5` | `26px` | Section internal padding |
| `space-6` | `42px` | Between major sections |

This scale produces a subliminal rhythm — proportions resolve without the eye consciously noticing the grid.

### Two-Column Layout Split

When dividing a panel into two columns (e.g., sidebar + main content), use a **38% / 62%** split — the golden section — rather than `33/67` or `50/50`. This mirrors how the eye naturally prefers to rest on the wider area, and creates a composition that feels resolved without instruction.

### Border Radius

| Element | Radius |
|---|---|
| Large panels / cards | `rounded-[12px]` |
| Buttons / inputs | `rounded-[6px]` or `rounded-lg` |
| Pills / controls | `rounded-full` |
| Agent avatars / identity icons | `border-radius: 22.2%` (squircle — see §8) |

---

## 5. Icons

We use **Lucide React**. Icons should always feel balanced with the text they sit next to.

| Spec | Value |
|---|---|
| Standard size | `w-[18px] h-[18px]` |
| Micro size (inside badges / small buttons) | `w-[14px] h-[14px]` |
| Stroke weight | `strokeWidth={2}` (bump to `2.5` for micro icons) |
| Flex behavior | Always `shrink-0` to prevent flexbox crushing |

**Icon placement:** The natural eye-rest point in a bounding box falls at the **61.8% mark** (φ reciprocal), not at geometric center. When composing icon + text pairs, weight visual anchors slightly above geometric center in tall containers for better perceived balance.

---

## 6. Motion & Animation

Animations should feel like high-quality hardware: fast, deliberate, and smooth. We avoid floaty linear animations.

### The "Spring" Bezier

For toggles, sliding pills, and positional changes, use this custom cubic-bezier. It mimics a physical spring snapping into place:

```css
transition-all duration-300 ease-[cubic-bezier(0.3,0.8,0.15,1)]
```

### Guidelines

| Rule | Rationale |
|---|---|
| Duration 150–300ms | Fast enough to feel immediate; slow enough to read |
| Spring bezier for state changes | Physical feel — object has mass and momentum |
| Linear only for opacity fades | Opacity has no spatial dimension; spring would feel odd |
| No animation for purely data updates | Table rows updating, badge counts — instant, no transition |
| Use `will-change: transform` on animated elements | Promotes to GPU layer, avoids repaints |

---

## 7. Component Patterns

### Buttons

```
Primary:   bg-white text-black    — Single dominant CTA per view
Secondary: bg-[#1C1C1D] border border-[#3A3F4A] text-[#EBEBEB]
Ghost:     bg-transparent text-[#8A8F98] hover:text-[#EBEBEB]
Danger:    bg-red-900/30 border border-red-700/50 text-red-400
```

- Never show more than one Primary button per screen region.
- Destructive actions use the Danger style and require a confirmation step.

### Inputs & Forms

```css
/* Base input */
background: #16181A;
border: 1px solid #232529;
border-radius: 6px;
color: #EBEBEB;
font-size: 14px;
padding: 8px 12px;

/* Focus state */
border-color: #3A3F4A;
outline: 2px solid rgba(58, 63, 74, 0.4);
outline-offset: 1px;
```

- Monospace font for inputs that accept technical values (API keys, agent IDs, JSON).
- Never disable an input that cannot be edited. Remove it from the layout entirely.

### Status Badges

```
Running:   bg-emerald-900/30 text-emerald-400 border border-emerald-700/30
Idle:      bg-[#1C1C1D] text-[#8A8F98] border border-[#232529]
Error:     bg-red-900/30 text-red-400 border border-red-700/30
Queued:    bg-amber-900/30 text-amber-400 border border-amber-700/30
```

All badges use `text-[11px] font-medium uppercase tracking-wider` and `rounded-full` pill shape.

### Empty States

Empty states must communicate three things in order:

1. **What is missing** — state it plainly in Secondary text.
2. **Why it is empty** — brief, human-readable reason.
3. **What to do** — a single action CTA, never more.

Never use illustrations or icons as the primary communication in empty states. Lead with text.

---

## 8. Proportional Harmony & Curvature

This section documents the perceptual design strategies borrowed from Apple's approach to proportion and shape — specifically the **Golden Ratio** and the **Squircle**. These are not decorative choices; they are perceptual tools that reduce cognitive friction and build subconscious trust.

---

### 8.1 The Golden Ratio (φ = 1.618)

The Golden Ratio is a mathematical proportion (~1.61803) found across nature, architecture, and enduring interface systems. Apple applies it to icon dimensions, layout splits, and typographic scale — never announcing it, but letting it operate subliminally.

**Why it works:**

When users encounter a product for the first time, they decide whether they like it within seconds — a visceral reaction that precedes conscious thought. Design built on golden proportions has a positive influence on that initial visual perception, shaping first impressions before a user reads a single word. The ratio acts as an unspoken visual language that leads users through a harmonious experience and instinctively directs them toward desired actions.

**In practice for Orkestrate:**

- **Type scale** — See §3. Each step ×1.618 from the previous.
- **Layout split** — See §4. `38% / 62%` for two-column layouts.
- **Spacing ladder** — See §4. φ-derived spacing tokens.
- **Icon composition** — The visual weight anchor in any container falls at the 61.8% mark, not geometric center. Use this for status indicators, focus rings, and composed icon+text pairs.

---

### 8.2 The Squircle (Continuous Curvature Corners)

A squircle is a mathematically precise shape between a square and a circle — technically a **superellipse** (Lamé curve), defined as:

```
|x/a|ⁿ + |y/b|ⁿ = 1,  where n ≈ 5
```

Apple adopted this shape for all iOS app icons from iOS 7 onward and has carried it through hardware (MacBook chassis, iPhone corners) and system UI.

**The key distinction from standard `border-radius`:**

A rounded rectangle has a curvature that *jumps* — from `0` on the flat edge to `1/r` on the circular arc. This is a mathematically abrupt transition the eye perceives subconsciously as a seam.

A squircle has **no such break**: curvature changes smoothly and continuously from edge to corner. The shape registers as a unified whole — like a smooth pebble — rather than a square with surgery performed on it.

**Why it matters:**

Humans have a subconscious aversion to sharp edges — they are associated with danger and pain. The squircle is softer than a square and more structured than a circle, striking the exact balance between friendliness and professionalism that a developer tool requires. Because the eye continuously follows the curvature without interruption, squircle containers reduce the micro-fatigue that accumulates over long sessions.

**Implementation:**

Apple's canonical squircle formula: `corner_radius = container_size × 0.222`

```css
/* Agent avatars and identity icons — the primary squircle application */
.avatar {
  border-radius: 22.2%; /* 0.222 × 100 — the Apple constant */
}

/* Native CSS (experimental — Chrome Canary, Safari TP) */
.squircle-native {
  border-radius: 12px;
  corner-shape: squircle;
}

/* Tailwind utility for avatars */
/* rounded-[22.2%] on a square container */
```

**Figma reproduction:** Set corner radius to `size × 0.222`, then open Independent Corners and set Corner Smoothing to **61%** (the iOS canonical value).

**Where to apply squircle geometry:**

| Element | Shape Rule |
|---|---|
| Agent avatar / identity icon | `border-radius: 22.2%` on square container |
| Panel / card surfaces | `rounded-[12px]` + 60% corner smoothing in design tool |
| Modal overlays | Same as cards |
| Tool badges / status pills | Keep `rounded-full` — pills must remain circles |
| Input fields | Keep `rounded-lg` — squircles on inputs read as heavy |
| Notification dots | Keep `rounded-full` |

---

### 8.3 Combined Principle: Organic Precision

The through-line between the Golden Ratio and the Squircle is the same psychological goal: **remove all perceptible seams**.

- The Golden Ratio removes the seam between "this feels big" and "this feels small" — proportions resolve without conscious negotiation.
- The Squircle removes the seam between a corner's arc and its edge — shapes resolve as unified wholes.

**For Orkestrate, this means:** surfaces should feel *inevitable*, not assembled. Apply golden proportions to layout and type scale. Apply continuous curvature to any shape that carries identity weight. The result is an interface that feels engineered to the same tolerances as the hardware it runs on.

**Implementation priority:**

1. **Highest ROI, lowest effort:** Apply `border-radius: 22.2%` to all agent avatar containers.
2. **Medium effort:** Verify the type scale follows the φ ladder and adjust as needed.
3. **Layout:** Apply `38/62` split to the next two-column panel you build.
4. **Future:** Adopt `corner-shape: squircle` natively when browser support reaches production threshold.

---

## 9. Accessibility

- **Minimum contrast:** 4.5:1 for body text, 3:1 for large text and UI components (WCAG AA).
- **Focus indicators:** All interactive elements must have a visible focus ring. Use `outline: 2px solid #3A3F4A` with `outline-offset: 2px`.
- **Reduced motion:** Wrap all non-essential animations in `@media (prefers-reduced-motion: reduce)` and provide instant alternatives.
- **Touch targets:** Minimum 44×44px for any touch-accessible surface.
- **Color alone:** Never rely on color alone to communicate state. Pair color with an icon, label, or shape change.

---

## 10. Tokens Quick Reference

```css
/* ── Backgrounds ─────────────────────────────────────── */
--bg-app:              #0A0A0B;
--bg-surface:          #16181A;
--bg-surface-elevated: #1C1C1D;
--bg-surface-hover:    #2B2D31;

/* ── Borders ─────────────────────────────────────────── */
--border-subtle:       rgba(255,255,255,0.05);
--border-interactive:  #3A3F4A;

/* ── Text ────────────────────────────────────────────── */
--text-primary:        #EBEBEB;
--text-secondary:      #D1D3D8;
--text-tertiary:       #8A8F98;
--text-disabled:       #5E626B;

/* ── Spacing (φ-ladder) ──────────────────────────────── */
--space-1: 4px;
--space-2: 6px;
--space-3: 10px;
--space-4: 16px;
--space-5: 26px;
--space-6: 42px;

/* ── Radius ──────────────────────────────────────────── */
--radius-card:    12px;
--radius-button:  6px;
--radius-pill:    9999px;
--radius-squircle: 22.2%;   /* Applied as % on square containers */

/* ── Motion ──────────────────────────────────────────── */
--ease-spring: cubic-bezier(0.3, 0.8, 0.15, 1);
--duration-fast:   150ms;
--duration-normal: 300ms;
```
