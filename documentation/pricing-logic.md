# Orkestrate — Pricing Logic & Revenue Model

> Internal reference document. Last updated: March 2026.

---

## Overview

This document details the pricing structure, monetization rationale, and profit/revenue calculations for Orkestrate — a multi-agent MCP orchestration platform. It covers infrastructure costs, tier logic, launch strategy, and break-even analysis.

---

## Infrastructure Stack & Fixed Costs

Orkestrate runs on a lean, serverless stack with no dedicated backend servers.

| Service | Plan | Cost (USD) | Cost (INR) |
|---|---|---|---|
| Vercel | Pro | $20/mo | ₹1,660/mo |
| Supabase | Pro | $25/mo | ₹2,075/mo |
| **Total fixed** | | **$45/mo** | **₹3,735/mo** |

Exchange rate assumed: **1 USD = ₹83**

### Variable Costs

**Razorpay payment processing:** 2% per transaction, no monthly fee.

Formula:
```
razorpay_fees = total_revenue × 0.02
```

**Supabase Realtime overages:** The Pro plan includes 200 concurrent realtime connections. Orkestrate's core feature relies on agents maintaining live connections to workspaces. At scale this can exceed the free allowance.

Estimation:
```
active_users_at_any_time = total_users × 0.05
realtime_connections     = active_users × 3  (avg 3 agents per session)
overage_connections      = max(0, realtime_connections - 200)
overage_cost_usd         = (overage_connections / 1000) × $10
```

At 2,000 users: ~300 realtime connections → ~$1/mo overage. Manageable until 5,000+ users, at which point a dedicated Supabase compute add-on (~$110/mo) is recommended.

---

## Pricing Tiers

### Rationale: Why These Tiers?

Orkestrate's value is in **multi-agent coordination**, not raw compute. The natural billing axes are:

- **Concurrent agents** — directly tied to coordination value
- **Workspaces** — isolation units, directly tied to project scale

We do not meter on API calls or tokens — Orkestrate is not an AI provider, and usage-based billing creates unpredictable costs that erode developer trust (see: Cursor's June 2025 backlash).

### Tier Structure

| Tier | Price | Workspaces | Agents (concurrent) | Members |
|---|---|---|---|---|
| Hobby | Free | 3 | 3 | 1 |
| Pro | ₹799/mo | Unlimited | 10 | 1 |
| Team | ₹799/mo | Unlimited | Unlimited | 5 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

> The free tier is intentionally generous — 3 workspaces and 3 concurrent agents is enough for a real solo project. A crippled free tier means users churn before they experience the coordination value that drives upgrades.

---

## Launch Pricing Strategy

### The Offer

**First month at ₹299, then ₹799/mo — fully transparent.**

Displayed as: ~~₹799~~ → **₹299 / first month**, with a clear footnote:

> *First month billed at ₹299. Renews at ₹799/mo from month two. Cancel anytime before renewal and you won't be charged again.*

### Why This Structure

| Option | Problem |
|---|---|
| ₹299 → ₹799 after 1 month | 167% jump — high churn risk at renewal |
| Founding member lock-in (₹499 forever) | Complex to explain, harder to implement |
| Free trial, no card | Low intent signal, hard to convert |
| **₹299 first month, transparent renewal** | ✅ Low friction entry, clear expectations, simple Razorpay implementation |

### Razorpay Implementation

Create a **₹799/mo subscription plan**, then apply a **one-time coupon** reducing the first cycle to ₹299. The subscription auto-renews at full price. No manual intervention needed after setup.

```
Plan:   ₹799/mo recurring
Coupon: -₹500 applied to first invoice only
Result: Month 1 = ₹299, Month 2+ = ₹799
```

---

## Revenue & Profit Calculations

### Variables

```
total_users        = N
free_pct           = % on Hobby tier (typically 60–70%)
pro_pct            = % on Pro tier
team_pct           = 1 - free_pct - pro_pct

free_users         = N × free_pct
pro_users          = N × pro_pct
team_users         = N × team_pct

INR_PER_USD        = 83
INFRA_COST_USD     = 45
INFRA_COST_INR     = 45 × 83 = ₹3,735
```

### Revenue Formula

```
pro_revenue   = pro_users  × 799
team_revenue  = team_users × 799
total_revenue = pro_revenue + team_revenue

razorpay_fees = total_revenue × 0.02
total_costs   = INFRA_COST_INR + razorpay_fees

profit        = total_revenue - total_costs
margin        = profit / total_revenue × 100
```

### Break-Even Analysis

Minimum paying users to cover all fixed infrastructure:

```
break_even_users = ceil(INFRA_COST_INR / 799)
                 = ceil(3,735 / 799)
                 = 5 users
```

**You need just 5 paying users to cover all infrastructure costs.** Everything beyond that is profit.

### Scenario Modelling

#### Scenario A — Early Stage (500 users)

| Segment | Users | Revenue |
|---|---|---|
| Free (70%) | 350 | ₹0 |
| Pro (25%) | 125 | ₹99,875 |
| Team (5%) | 25 | ₹19,975 |
| **Total** | **500** | **₹1,19,850** |

```
Razorpay fees  = ₹1,19,850 × 0.02 = ₹2,397
Total costs    = ₹3,735 + ₹2,397  = ₹6,132
Profit         = ₹1,19,850 - ₹6,132 = ₹1,13,718/mo
Margin         = ~94.9%
Annual profit  = ₹13,64,616
```

#### Scenario B — Growth Stage (2,000 users)

| Segment | Users | Revenue |
|---|---|---|
| Free (70%) | 1,400 | ₹0 |
| Pro (25%) | 500 | ₹3,99,500 |
| Team (5%) | 100 | ₹79,900 |
| **Total** | **2,000** | **₹4,79,400** |

```
Razorpay fees  = ₹4,79,400 × 0.02 = ₹9,588
Realtime overage (est.) = ₹830
Total costs    = ₹3,735 + ₹9,588 + ₹830 = ₹14,153
Profit         = ₹4,79,400 - ₹14,153 = ₹4,65,247/mo
Margin         = ~97%
Annual profit  = ₹55,82,964
```

#### Scenario C — Launch Month (₹299 promo, 200 users)

Assume all Pro users are on the ₹299 first-month price.

| Segment | Users | Revenue |
|---|---|---|
| Free (75%) | 150 | ₹0 |
| Pro @ ₹299 (20%) | 40 | ₹11,960 |
| Team (5%) | 10 | ₹7,990 |
| **Total** | **200** | **₹19,950** |

```
Razorpay fees  = ₹19,950 × 0.02 = ₹399
Total costs    = ₹3,735 + ₹399  = ₹4,134
Profit         = ₹19,950 - ₹4,134 = ₹15,816/mo
Margin         = ~79.3%
```

Even during launch month at discounted pricing, the business is profitable from day one.

---

## Key Metrics to Track

| Metric | Target (Month 3) |
|---|---|
| Total signups | 500+ |
| Free → Pro conversion rate | 15–25% |
| Month 2 retention (post ₹299 → ₹799) | >60% |
| MRR | ₹50,000+ |
| Churn rate | <10%/mo |

### The Critical Number: Month 2 Retention

The launch offer's success hinges entirely on how many ₹299 users convert to ₹799 at renewal. If retention drops below 50%, the offer is generating noise but not sustainable revenue. Track this obsessively.

If retention is low, the signal is one of three things:
1. Users haven't integrated Orkestrate deeply enough in one month → extend trial to 3 months
2. ₹799 is too high for the perceived value → revisit Pro pricing
3. Wrong users are converting → tighten messaging to attract power users, not casual experimenters

---

## Scaling Considerations

### When to Upgrade Infrastructure

| Threshold | Action | Est. New Cost |
|---|---|---|
| >1,000 active users | Monitor Supabase realtime connections | No change yet |
| >200 peak concurrent connections | Add Supabase compute add-on | +$110/mo |
| >10,000 users | Consider dedicated backend (Railway/Fly.io) | +$50–200/mo |
| Enterprise customers | Private deployment option | Priced into contract |

### Vercel Considerations

Vercel serverless functions have a 10-second execution limit on Pro. MCP tool calls (especially `read_team_state` with large workspaces) should be benchmarked against this limit. If P95 latency approaches 8 seconds, migrate the MCP endpoint to a persistent backend.

---

## Summary

- **Infrastructure floor:** ₹3,735/mo regardless of user count
- **Break-even:** 5 paying users
- **Margins at scale:** 94–97% (infrastructure costs are nearly fixed)
- **Launch offer:** ₹299 first month → ₹799/mo, fully transparent
- **Primary risk:** Month 2 retention after price step-up
- **Secondary risk:** Supabase Realtime overages at 1,000+ concurrent agent sessions