# KrishiLink — Build Blueprint (As Built & Verified)
**Version 2.0 | Last updated: 2026-10-07 | Status: 100% Complete**

---

## How to use this blueprint

This document outlines the architectural roadmap used to build KrishiLink from scratch. Every phase represents a distinct, verified subsystem. All 17 phases are complete, tested, and live in the repository.

---

### Phase Completion Table

| Phase | Subsystem / Deliverable | Key Files & Routes | Status |
|:---:|---|---|:---:|
| **0** | Foundation (Next.js 16, TypeScript, Tailwind, Supabase) | `package.json`, `tailwind.config.ts`, `lib/supabase/` | ✅ Done |
| **1** | Database Schema, Tables, RLS Policies & Stored Procedures | 15 PostgreSQL tables, `bump_trust`, `wallet_credit` | ✅ Done |
| **2** | Multi-Role Authentication & Edge Middleware | `middleware.ts`, `lib/auth.ts`, `app/login/`, `app/signup/` | ✅ Done |
| **3** | Landing Page, Layouts & Shared Component Shell | `app/page.tsx`, `components/SiteHeader.tsx`, `DashboardShell.tsx`| ✅ Done |
| **4** | Farmer Portal: Produce Listing, Photos, Offers & Orders | `app/farmer/list/`, `app/farmer/offers/`, `app/farmer/orders/` | ✅ Done |
| **5** | Buyer Portal: Marketplace Catalog, Filters, Bids & Orders | `app/buyer/browse/`, `app/buyer/bids/`, `app/buyer/orders/` | ✅ Done |
| **6** | Net Realization Engine (NRE) & Mandi Benchmark | `lib/nre/compute.ts`, `lib/netRealization.ts`, `/api/nre/quote` | ✅ Done |
| **7** | Shared Fair Band (Dual-Sided Pricing Corridor) | `lib/nre/fairBand.ts`, `components/nre/FairBandCard.tsx` | ✅ Done |
| **8** | Roboflow Computer Vision Quality AI Proxy | `app/api/ai/quality/route.ts`, `lib/ai/roboflow.ts` | ✅ Done |
| **9** | Route AI & Logistics Optimization (OSRM & Clarke-Wright)| `lib/route-ai/index.ts`, `lib/route-ai/server.ts` | ✅ Done |
| **10** | Leaflet Interactive Maps & Corridor Consolidation | `components/logistics/OrderMapView.tsx`, `RouteOptimizer.tsx` | ✅ Done |
| **11** | Multi-Role 3-Language IVR Gateway (26-State Machine) | `lib/ivr/stateMachine.ts`, `app/ivr-sim/`, `app/ivr-sim/actions.ts`| ✅ Done |
| **12** | Realtime LiveSync & Persistent Notifications | `components/LiveSyncProvider.tsx`, `/api/notifications` | ✅ Done |
| **13** | FPO Aggregation, Collective Pools & Member Payouts | `app/farmer/fpo/`, `app/buyer/pools/`, `fpo_pool_payouts` | ✅ Done |
| **14** | Digital Wallet & 30/70 Escrow State Machine | `lib/wallet/actions.ts`, `app/wallet/`, `wallets` table | ✅ Done |
| **15** | PDS Village Kiosk Assisted Access | `app/pds-operator/assist/`, `app/pds-operator/farmers/` | ✅ Done |
| **16** | Admin Suite & Platform Governance | `app/admin/fees/`, `app/admin/verifications/`, `app/admin/fpo/` | ✅ Done |
| **17** | Judge Evaluation Suite (1-Click Persona Switcher) | `components/JudgeDemoButton.tsx`, `app/demo/actions.ts` | ✅ Done |

---

## Detailed Phase Specifications

### Phase 0 — Foundation
- Initialized Next.js 16 with App Router, TypeScript strict mode, Tailwind CSS 3.
- Installed dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `leaflet`, `@types/leaflet`, `framer-motion`.
- Configured self-hosted fonts in `app/fonts/` (`inter-v20` and `manrope-v20`) using `next/font/local` to eliminate external runtime font dependencies.

### Phase 1 — Database Architecture & Stored Procedures
- 15 relational tables with primary keys, foreign key constraints, and automatic timestamps.
- Row Level Security (RLS) enabled across every table.
- PostgreSQL Stored Procedures:
  - `wallet_credit(p_user_id, p_amount, p_kind, p_reference_id, p_description)`
  - `wallet_debit(p_user_id, p_amount, p_kind, p_reference_id, p_description)`
  - `fpo_wallet_credit(p_fpo_id, p_amount, p_kind, p_reference_id, p_description)`
  - `fpo_wallet_debit(p_fpo_id, p_amount, p_kind, p_reference_id, p_description)`
  - `bump_trust(p_user, p_delta)`: Increments user trust score up to 100.
- `public_profiles` SQL View: Masks sensitive PII (phone, email, full address) when browsing listings.

### Phase 2 — Multi-Role Authentication & Edge Middleware
- Roles: `farmer`, `buyer`, `pds_operator`, `admin`, `fpo`.
- `middleware.ts`: Evaluates Supabase session cookie, verifies user role from `profiles`, redirects to `ROLE_HOME` (`/farmer`, `/buyer`, `/pds-operator`, `/admin`).
- Unauthenticated requests to protected paths redirect to role-specific login views (`/login/farmer`, `/login/buyer`, etc.).
- Admin signup guarded by server-side `ADMIN_SIGNUP_CODE`.

### Phase 3 — Shared UI Shell & Earth Theme
- Root layout with dynamic metadata, favicon, and earth-toned theme tokens.
- Shared components: `DashboardShell.tsx`, `SiteHeader.tsx`, `BackButton.tsx`, `ButtonSpinner.tsx`, `LoadingScreen.tsx`, `SkeletonCard.tsx`, `VerificationStatusCard.tsx`.
- Landing page with responsive hero, 3-step NRE explanation, animated value counters, role cards, and interactive Judge Demo modal.

### Phase 4 — Farmer Portal
- Produce listing form (`app/farmer/list/ListProduceForm.tsx`) with image upload to Supabase Storage bucket `listing-photos`.
- Automated photo grading via Roboflow Computer Vision proxy.
- Active listings management (`app/farmer/listings/`).
- Offers Received view (`app/farmer/offers/`) sorted descending by Net Realization.
- One-click Accept modal supporting transport mode choice (KrishiLink vs self) and partial quantity acceptance with optional re-listing of remaining stock.

### Phase 5 — Buyer Marketplace
- Crop catalog (`app/buyer/browse/`) with multi-criteria filtering: crop name, district/region, quality grade, quantity range.
- Listing detail view with farm location, grade breakdown, and farmer asking price.
- Offer placement form (`OfferForm.tsx`) with real-time Fair Band and gross total calculations.
- Bids tracking view (`app/buyer/bids/`) showing pending, accepted, and rejected offers.

### Phase 6 — Net Realization Engine (NRE)
- Pure mathematical formulas in `lib/nre/compute.ts`:
  $$\text{Net} = \text{Offer} - \text{Commission} - \text{Gateway Fee} - \text{Handling} - \text{Transport} - \text{Quality Deduction}$$
- Mandi benchmark computation comparing platform net against local APMC take-home.
- Dynamic route handler `GET /api/nre/quote`: Fetches active `fee_config` and real OSRM road distance to generate single-source-of-truth quotes.

### Phase 7 — Shared Fair Band
- Shared pricing corridor `[Mid - 1.5, Mid + 1.5]` implemented in `lib/nre/fairBand.ts`.
- Blends farmer ask, buyer bid, and modal mandi price, adjusted for grade multipliers (A: 1.0, B: 0.92, C: 0.82) and 50/50 shared logistics and handling costs.
- Automatically outputs spread classification (*Narrow*, *Moderate*, *Wide*) with actionable negotiation advice.

### Phase 8 — Roboflow Computer Vision Quality AI
- Server-side proxy `app/api/ai/quality/route.ts` utilizing `ROBOFLOW_SERVERLESS_URL` and `ROBOFLOW_API_KEY`.
- Analyzes produce photos for Onion and Potato crops into Grade A, B, or C with confidence scores.
- Graceful degradation: Deterministic fallback engine handles other crops and network failures.

### Phase 9 — Route AI & Logistics Optimization
- Live road routing via OSRM (`router.project-osrm.org`) with 30-minute in-memory caching.
- 40+ agricultural districts across Maharashtra, Uttarakhand, Delhi, and Karnataka mapped with privacy jitter (`lib/route-ai/districts.ts`).
- Vehicle matching by payload weight: Tempo (<500kg), Mini Truck (500–2000kg), Heavy Truck (>2000kg).
- Clarke-Wright savings algorithm and 2-opt TSP improvement for multi-stop route planning.

### Phase 10 — Leaflet Interactive Maps & Corridor Consolidation
- `components/logistics/OrderMapView.tsx`: Interactive Leaflet map on order details page (`/orders/[id]`).
- ESRI World Street & Satellite tiles with custom emoji markers (🌾 pickup, 🏪 drop).
- 50km corridor consolidation: Detects nearby active orders, visualizes shared truck routes, and computes solo vs shared logistics costs and ₹/kg savings.
- `RouteOptimizer.tsx`: Admin-level multi-truck logistics planning workbench.

### Phase 11 — Multi-Role 3-Language IVR Gateway
- Public IVR simulator at `/ivr-sim` powered by a 26-state finite state machine (`lib/ivr/stateMachine.ts`).
- Full trilingual support in English, Hindi, and Kannada.
- Supports 3 roles:
  - **Farmer**: List crop, listen to top offers ranked by Net Realization, accept/reject, check mandi prices.
  - **Buyer**: Browse crops, listen to top listings by price, place bids via keypad, review bids/orders.
  - **FPO**: Create pooled lots, record member contributions one by one via keypad, accept group offers.
- Identity authentication via KrishiLink ID / FPO ID and SMS OTP (`ivr_otps`).
- Writes real database rows to `listings`, `offers`, `transactions`, and `ivr_sessions`.

### Phase 12 — Realtime LiveSync & Notifications
- `LiveSyncProvider.tsx` subscribes via Supabase Realtime WebSocket to postgres changes across 12 tables.
- Triggers debounced `router.refresh()` on remote mutations without full page reloads.
- Notification feed (`NotificationBell.tsx`) with unread counters and deep links.
- Visual floating "Live" / "Syncing" pill in UI.

### Phase 13 — FPO Aggregation, Collective Pools & Member Payouts
- Farmer applies for FPO status with at least 2 member KrishiLink IDs (`app/farmer/fpo/ApplyForm.tsx`).
- Admin reviews and approves FPOs (`app/admin/fpo/`).
- Approved heads create bulk pools (`fpo_pools`) with individual member contribution quotas (`fpo_pool_contributions`).
- Institutional buyers browse bulk pools at `/buyer/pools/` and place volume bids.
- Upon delivery completion, `fpo_pool_payouts` automatically calculates each member's share % and distributes funds to their digital wallets.

### Phase 14 — Digital Wallet & 30/70 Escrow System
- Digital ledger implemented in `lib/wallet/actions.ts` via stored procedures `wallet_credit` and `wallet_debit`.
- Top-up (up to ₹5,00,000) and withdrawal (min ₹100 to bank).
- 30% Advance Escrow: Debits buyer 30% gross, credits seller/FPO 30% net, credits admin 30% fee, sets status `escrow_paid`.
- 70% Final Settlement: Triggered upon buyer delivery confirmation. Debits remaining 70% gross, credits 70% net, releases FPO member shares, sets status `completed`, increments trust scores (+2).

### Phase 15 — PDS Village Kiosk Assisted Access
- Fair Price Shop operators access `/pds-operator/assist/`.
- Look up village farmers by KrishiLink ID (`KL-XXXXXX`).
- Create produce listings on their behalf (`listed_by`), sending notifications to the farmer.
- Village farmers list (`/pds-operator/farmers/`) displays active village listings and operator trust credits (+1 per listing).

### Phase 16 — Admin Suite & Governance
- Fee configuration (`/admin/fees`) for commission %, handling flat, gateway %, quality deductions.
- Transport rate configuration per vehicle type.
- KYC verification queue (`/admin/verifications`) with document notes and status flips.
- FPO approvals queue (`/admin/fpo`).
- Dispute resolution queue (`/admin/disputes`).
- Global transaction ledger (`/admin/transactions`).

### Phase 17 — Judge Evaluation Suite
- Modal opened via **Judge Demo** button on landing page (`JudgeDemoButton.tsx`).
- Protected by PIN `SIH-2026-KL`.
- 1-click instant login into 7 distinct personas: Farmer 1, Farmer 2, Buyer 1, Buyer 2, FPO Head, PDS Operator, and Admin.

---

## Anti-Patterns & Engineering Standards (Strictly Enforced)

1. **Never compute Net Realization purely on the client**: Calculations must execute server-side or via `/api/nre/quote`.
2. **Never hardcode fees**: Platform commission, handling charges, and gateway fees must be retrieved dynamically from `fee_config`.
3. **Never bypass Row Level Security on the client**: Use `lib/supabase/client.ts` in browser components; use service-role `createAdminClient` only in authenticated server actions.
4. **Never create orphan FPO pools**: Member KrishiLink IDs and contribution quotas must be validated before pool insertion.
5. **Never expose user PII across public endpoints**: Public catalog queries must use the `public_profiles` view.

---

*End of 03_BLUEPRINT.md — Version 2.0, updated 2026-10-07*
