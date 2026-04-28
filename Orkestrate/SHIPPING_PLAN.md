# Orkestrate Shipping Plan

**Status:** Draft | **Last Updated:** 2026-04-28

---

## Table of Contents
1. [Product Vision](#product-vision)
2. [Pricing (Claude-Style)](#pricing-claude-style)
3. [Payment Stack](#payment-stack)
4. [Phase 1: MVP (Weeks 1-2)](#phase-1-mvp-weeks-1-2)
5. [Phase 2: Subscriptions (Week 3)](#phase-2-subscriptions-week-3)
6. [Phase 3: The Differentiator (Month 2)](#phase-3-the-differentiator-month-2)
7. [Open Questions](#open-questions)

---

## Product Vision

Orkestrate is a desktop AI assistant with persistent memory across sessions.
Unlike generic chatbots, it remembers what you talk about, learns your context,
and gets smarter the more you use it — without you having to repeat yourself.

**Core value prop:**
- Chat with an AI that *actually remembers* you
- No setup, no integrations, no copy-pasting context
- Works entirely on your device (privacy-first)

---

## Pricing (Claude-Style)

| Plan | Price | Usage | Features |
|------|-------|-------|----------|
| **Free** | Rs.0 | Standard | Chat, session memory, web search, 1 model (MiniMax M2.5) |
| **Pro** | Rs.499/mo | 2x Free | All models, deeper memory, file attachments, projects |
| **Max 5x** | Rs.2,499/mo | 5x Pro | Pro + Ambient Context + priority support |
| **Max 20x** | Rs.9,999/mo | 20x Pro | Unlimited everything + early access + custom features |

**Annual discount:** 15% off (like Claude's $17 vs $20)

---

## Payment Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| **Primary (India)** | Razorpay | Already verified for orkestrate.space, handles UPI/cards/GST |
| **International** | Stripe | Future — add when non-Indian users request |
| **License Validation** | Cloudflare Worker | Free tier, validates Razorpay webhooks, caches for 24h |
| **Subscription Mgmt** | Razorpay Dashboard | Built-in plans, webhooks, customer portal |

---

## Phase 1: MVP (Weeks 1-2)

### Simplified Memory System

**Keep (proven working):**
- Session summaries + last 5 messages (cross-session continuity)
- User profile (`user.md`) — fast append, periodic LLM consolidation
- Explicit `store_memory` tool — user says "remember that...", it stores
- BM25 search via `search_context` tool

**Cut (experimental/complex):**
- Multi-agent extraction pipeline (analyzer → parallel extractors → validator)
- OpenRouter embeddings (latency, cost, failure risk)
- Proactive memory agent (untested, adds 1 LLM call per turn)
- Word-boundary pronoun resolution (brittle, replaced by session summaries)

**Result:** Zero background LLM calls per turn. Fast. Reliable. Solid.

### Settings Modal (build now)

| Tab | Content |
|-----|---------|
| **API Keys** | OpenRouter key (required), Exa key (optional) |
| **Account** | Name, avatar, subscription tier |
| **Memory** | Toggle on/off, clear data, export |
| **Subscription** | Current plan, usage meter, upgrade → Razorpay checkout |
| **Appearance** | Theme (already exists) |

### Onboarding (first launch)

```
Step 1: Welcome to Orkestrate
        "Your AI that remembers."

Step 2: What's your name?
        [________]

Step 3: Enter your OpenRouter API key
        [____________________]  [? What's this?]
        → Link to openrouter.ai sign-up
        → "Orkestrate never stores your key. It stays on your device."

Step 4: Start chatting
        [Start]

Skip for now → Demo mode (no AI responses, explore UI)
```

### UI Polish

- [ ] App name: `Orkestrate` (not `orkestrate`)
- [ ] Window size: 1280x800 (currently 980x660 — too cramped)
- [ ] Remove dead `ai-elements` components (50+ unused files)
- [ ] Fix `cargo check` warnings (29 currently)
- [ ] Add loading states for tool calls
- [ ] Add error toast for missing API key

---

## Phase 2: Subscriptions (Week 3)

### Razorpay Integration

1. Create plans in Razorpay dashboard:
   - `orkestrate-pro-monthly` — Rs.499
   - `orkestrate-pro-yearly` — Rs.5,088 (15% off)
   - `orkestrate-max5-monthly` — Rs.2,499
   - `orkestrate-max20-monthly` — Rs.9,999

2. Cloudflare Worker (`api.orkestrate.space`):
   ```
   POST /validate
   { license_key: "rzp_live_xxx" }
   → { valid: true, plan: "pro", expires_at: "..." }
   ```

3. App flow:
   - User clicks "Upgrade" → Razorpay checkout
   - Payment success → webhook → worker generates license key
   - App stores key, validates on startup, caches 24h

### Usage Metering (Pro/Max tiers)

| Tier | Monthly Messages | Models | Ambient Context |
|------|-----------------|--------|----------------|
| Free | 100 | MiniMax only | No |
| Pro | 500 | All | No |
| Max 5x | 2,500 | All | Yes |
| Max 20x | Unlimited | All + early | Yes + custom |

---

## Phase 3: The Differentiator (Month 2)

### Problem Statement

Littlebird reads screen text — that's their moat. We need something:
1. **Different** — not a rip-off
2. **Useful** — genuinely helps users
3. **Feasible** — buildable in <1 month
4. **Privacy-safe** — no screenshots, no content scraping

### Candidate: "Project Pulse" (working name)

**What it does:**
Tracks your **project context** through metadata (not content):
- Active application + window title
- Recent file changes in working directory
- Time spent per project
- Recent clipboard (non-sensitive only)

**What it DOESN'T do:**
- No screenshots
- No window text reading
- No keystroke logging
- No browser history

**Example:**
```
[PROJECT PULSE]
Current: VS Code — orkestrate/src/ai/memory/session.rs
Recent files: session.rs (2m ago), handler.rs (5m ago), Cargo.toml (1h ago)
Project: orkestrate (Rust AI desktop app)
Time today: 3.5 hours
[/PROJECT PULSE]

User: "what do you think?"
→ AI: "About the session.rs refactor? The Turn struct looks clean..."
```

**Why it's differentiated:**
| | Littlebird | Orkestrate Project Pulse |
|---|---|---|
| **Data** | Reads window text | Reads file/project metadata |
| **Privacy** | Sees what you see | Sees what you're working on |
| **Use case** | General knowledge work | Developers, creators, writers |
| **Depth** | Surface-level text | Project structure, history, workflow |

### Alternative Candidates (brainstorm)

1. **"Context Bridges"** — Connect two unrelated sessions. "Last week I was talking about Mia's stress. How does that relate to what Karan said today?"

2. **"Memory Garden"** — Visual graph of your memories. Users can browse, prune, connect ideas. Not just chat — a second brain you can explore.

3. **"Workflow Memory"** — Remembers not just facts but *processes*. "You always debug Rust code by checking cargo check first, then looking at line numbers."

4. **"Time Travel"** — "What was I working on last Tuesday at 3pm?" Reconstructs your day from project metadata + session summaries.

5. **"Project DNA"** — Analyzes your coding/writing patterns per project. "In Orkestrate you prefer match over if-else. In your blog you use short paragraphs."

---

## Open Questions

1. **Is "Project Pulse" compelling enough?** Does it solve a real pain, or is it gimmicky?

2. **Should we ship with a differentiator, or launch without and add later?**
   - Risk: Launching without differentiation = "just another AI chat app"
   - Risk: Delaying launch to build differentiation = competitors move first

3. **Target audience:**
   - Developers (Project Pulse fits well)
   - General productivity (need different differentiator)
   - Writers/creators (Workflow Memory fits)
   - All of the above?

4. **Monetization timing:**
   - Launch with subscriptions active from day 1?
   - Or launch free, add subscriptions after 1,000 users?

5. **API key friction:**
   - Users hate bringing their own keys. Is there a way to simplify?
   - Could we proxy through our own backend (costly, but zero friction)?
   - Or offer "keyless mode" with a limited free tier powered by our account?

---

## Next Steps

1. Decide on the differentiator
2. Lock pricing
3. Start Phase 1 execution
4. Set launch date target

---

*This document is a living draft. Edit as decisions change.*
