# Littlebird Design DNA

## Overview

Littlebird's UI is defined by **radical simplicity** and **warm minimalism**. It strips away every non-essential visual element until only the conversation remains. The design philosophy is: "The content is the interface."

---

## 1. Color Palette

### Background
- **Primary background**: `#FAFAF8` — warm off-white with a subtle cream undertone. Not pure white (`#FFFFFF`), not gray. It feels like high-quality paper.
- **Thinking block background**: `#F7F7F5` — slightly warmer than the main background, creating a barely-there elevation.
- **Tag background**: `#EFEFED` — warm light gray for search query pills.
- **User bubble background**: `#EFEFED` — same warm gray, creating visual distinction without harsh contrast.

### Text
- **Primary text**: `#1A1A1A` — near-black with warmth, never pure `#000000`.
- **Secondary text**: `#6B6B6B` — medium gray for labels, placeholders, and muted content.
- **Tertiary text**: `#9E9E9E` — light gray for the most subtle elements.

### Accents
- **Links**: `#0066CC` — classic blue, underlined or clearly differentiated.
- **Borders**: `rgba(0, 0, 0, 0.06)` — barely visible, used only when necessary for containment.
- **Dark mode header**: `#1A1A1A` — the app header is dark regardless of theme, creating a visual anchor.

### Principle
> Colors are restrained. The palette has at most 4-5 distinct values. Everything else is derived through opacity. Warmth is prioritized over cool neutrality.

---

## 2. Typography

### Font Stack
- **Primary**: System UI font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
- **Weight**: Predominantly `400` (regular). Headings within content use `600` (semibold).
- **No custom fonts**. The system font provides native familiarity and crisp rendering.

### Scale
- **Body text**: `15px` / `1.6` line-height. Generous leading makes long responses breathable.
- **User bubble text**: `15px` / `1.5` line-height.
- **Step labels**: `12px` / `1.4`, medium weight (`500`).
- **Tag text**: `11px` / `1`, medium weight.
- **Placeholder**: `15px`, secondary color, `opacity: 0.5`.

### Hierarchy
- No explicit hierarchy through size variation. Instead:
  - **Bold** (`600`) for section headings within responses.
  - *Italic* for emphasis, book titles, etc.
  - Regular weight for everything else.

---

## 3. Layout & Spacing

### Container
- **Max-width**: `680px` centered. The narrow column creates intimacy and readability.
- **Side padding**: `16px` on mobile, `24px` on desktop.

### Spacing Rhythm
- **Between messages**: `32px` — generous breathing room.
- **Within assistant message**: `16px` between thinking block and content.
- **Within thinking block**: `12px` between steps.
- **Tag gap**: `6px` horizontal, `8px` vertical wrapping.

### Density
> Littlebird is **low-density by design**. Every element needs room to breathe. Crowding is avoided at all costs.

---

## 4. Components

### User Message Bubble
- **Alignment**: Right-aligned, max-width `75%`.
- **Shape**: `border-radius: 16px` with `border-bottom-right-radius: 4px` — a subtle speech tail effect.
- **Background**: `#EFEFED` (warm light gray).
- **Text**: `#1A1A1A`, `15px`.
- **No shadow**. No border. No avatar. No timestamp. Just the text in a soft bubble.

### Assistant Message
- **Alignment**: Left-aligned, full width of container.
- **Container**: **None**. The text sits directly on the background.
- **No avatar**. No role label. No header. The assistant's voice is implied by position and formatting.

### Thinking / Steps Block

**Collapsed State:**
- Plain text: `"3 Steps ▼"` or `"Thinking..."`
- No background box. No border. Just text with a chevron.
- Positioned above the assistant's response.

**Expanded State:**
- Rounded container: `border-radius: 12px`, subtle border `rgba(0,0,0,0.06)`.
- Background: `#F7F7F5` (slightly warmer than page).
- Each step:
  - Icon (`16px`, muted gray) + Label (`12px`, medium weight).
  - Search tags below: `border-radius: 6px`, `#EFEFED` background, `11px` text.
  - Each tag has a small search icon inside (`10px`).

### Action Buttons (Below Assistant Response)
- **Copy**, **Thumbs Up**, **Thumbs Down** icons.
- `16px` size, `stroke-width: 1.5`.
- Color: `#9E9E9E` (very light gray).
- **No background**. Just the icon.
- On hover: color shifts to `#6B6B6B`.
- On active/selected: filled state with subtle background tint.

### Input Area
- **Container**: `border-radius: 16px`, subtle border, `#FFFFFF` background (slightly brighter than page).
- **Placeholder**: Large, gray, `opacity: 0.5`. "Ask Littlebird" — personal, not generic.
- **Bottom toolbar** (inside the input container):
  - Left: Attach (`+`), Tools, Sparkle icons. `16px`, muted.
  - Right: Mic icon + circular send button.
  - Send button: `32px` circle, dark fill (`#1A1A1A`), white up-arrow icon.
- **Padding**: `16px` all around.

---

## 5. Motion & Animation

### Philosophy
> Animations are **invisible helpers**, not decorative flourishes. If the user notices the animation, it's too much.

### Message Entrance
- **User messages**: Subtle `translateY(4px)` to `0` with `opacity: 0` to `1`. Duration: `200ms`. Easing: `ease-out`.
- **Assistant messages**: Same, but the thinking block may appear first, then content fades in.

### Thinking Block
- **Expand/collapse**: `height` transition over `200ms` with `ease-in-out`. The chevron rotates `180°` smoothly.

### Action Buttons
- **Hover**: Color transition `150ms`.
- **Click**: `scale(0.95)` micro-feedback, `100ms`.

### Streaming Text
- No typing animation. Text appears as it streams — natural and immediate.
- The thinking indicator (square dots) is the only animated element during loading.

---

## 6. The Square Dots Loading Animation

A signature micro-animation:
- **6 dots** traveling around the perimeter of a square.
- **Size**: `20px × 20px` canvas.
- **Dot size**: `2.5px` radius.
- **Behavior**: Each dot follows the square path (top → right → bottom → left) with equal spacing.
- **Opacity wave**: Dots pulse in opacity as they travel — brightest at the top-right, dimmest at the bottom-left.
- **Speed**: ~1.5 seconds per full loop.
- **Purpose**: Communicates "working" without the cliché of bouncing dots or spinning circles.

---

## 7. Key Principles

### 1. Content is the Interface
Remove everything that isn't the conversation. No sidebars in chat view. No metadata. No timestamps. No avatars. Just words.

### 2. Warmth Over Coolness
The color palette leans warm (cream, warm grays) rather than clinical cool (pure white, blue-tinted grays). This makes the AI feel approachable, not robotic.

### 3. Restraint in Interaction
Don't show UI until it's needed. Action buttons are invisible until hover. Steps are collapsed by default. The input is a simple box until you focus it.

### 4. Typography as Hierarchy
Instead of using size or color for hierarchy, use weight and spacing. Bold for headings. Generous line-height for readability.

### 5. Single Column Intimacy
The narrow `680px` column creates a letter-like intimacy. It feels like a direct message, not a dashboard.

### 6. Thinking is Transparent
The steps block shows the user what the AI is doing — searching context, browsing the web — but presents it as a collapsible aside, not a distraction.

---

## 8. Dark Mode Adaptation

When dark mode is active:
- Background shifts to `#0C0C0C` (near-black with warmth).
- Text shifts to `#E5E5E5`.
- User bubble becomes `#1A1A1A`.
- Thinking block becomes `#141414`.
- Tags become `rgba(255,255,255,0.06)`.
- The **header remains dark** regardless — it's the visual anchor.
- All warmth is preserved; nothing becomes clinical blue-tinted.
