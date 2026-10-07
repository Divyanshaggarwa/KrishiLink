# 04_MEMORY.md — KrishiLink (SIH 2026)
> Single source of truth. Paste at the start of every new chat session.

---

## 1. PROJECT SNAPSHOT

- **Name:** KrishiLink (कृषिलिंक) — Direct Farmer-to-Buyer Marketplace with Transparent Net Realization Engine
- **Event:** Smart India Hackathon (SIH) 2026
- **Problem Statement ID:** #33
- **Team:** KrishiVanta
- **Status:** 100% Feature-Complete & Live on Vercel
- **Live URL:** [krishilink-beta.vercel.app](https://krishilink-beta.vercel.app)
- **Core Differentiators:**
  1. **Net Realization Engine (NRE)** — Shows farmer *actual take-home* after logistics, commissions, handling, and quality deductions, compared directly against mandi benchmark.
  2. **Shared Fair Band** — Dual-sided fair pricing corridor `[Mid - 1.5, Mid + 1.5]` based on 3-way anchor (Ask + Bid + Mandi) and shared logistics.
  3. **Multi-Role 3-Language IVR Gateway** — Voice access in English, Hindi, and Kannada for Farmers, Buyers, and FPOs via KrishiLink ID (`KL-XXXXXX`) and OTP.
  4. **FPO Collective Pooling & Member Payouts** — FPO heads aggregate small lots into bulk lots; escrow releases automatically split revenue to member wallets.
  5. **30/70 Digital Wallet Escrow** — Anti-fraud financial flow (30% advance on order confirmation, 70% released on buyer delivery verification).
  6. **Roboflow Computer Vision Quality AI** — Serverless workflow classifying produce into Grade A/B/C with confidence scores.
  7. **Route AI & Logistics Optimization** — Real OSRM road distance, Clarke-Wright vehicle load planning, 2-opt TSP improvement, 50km corridor consolidation, interactive Leaflet maps.
  8. **PDS Village Kiosk Assisted Access** — Offline farmers onboarded by Fair Price Shop operators.
  9. **Judge Demo Evaluation Mode** — PIN `SIH-2026-KL` unlocks 1-click login into 7 distinct test personas.

---

## 2. TECH STACK (As Built & Running)

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16.3.5 (App Router) · React 18 · TypeScript 5 (Strict) · Tailwind CSS 3.4.1 · Framer Motion 13.2.0 |
| **Mapping Engine** | Leaflet 1.9.4 · `@types/leaflet` · ESRI World Street & Satellite tiles |
| **Typography** | Self-hosted Inter + Manrope via `next/font/local` (zero external fetch) |
| **Backend** | Next.js Server Actions (`"use server"`) · Route Handlers · Edge Middleware |
| **Database** | Supabase PostgreSQL 15 with Row Level Security (RLS) on all 15 tables |
| **Stored Procedures** | `wallet_credit`, `wallet_debit`, `fpo_wallet_credit`, `fpo_wallet_debit`, `bump_trust` |
| **Auth** | Supabase Auth (Email + Password) · Custom KrishiLink ID (`KL-XXXXXX`) · FPO ID (`KF-XXXXXX`) · SMS OTP |
| **Storage** | Supabase Storage (`listing-photos` bucket) |
| **Realtime** | Supabase Realtime WebSocket channel subscribing to 12 tables |
| **Computer Vision** | Roboflow Serverless Workflow Proxy (`app/api/ai/quality`) + Mock Fallback |
| **Routing & Logistics** | OSRM Matrix API (`router.project-osrm.org`) · Clarke-Wright Savings · 2-Opt TSP · 40+ District Coordinates |
| **Deploy** | Vercel (Frontend & Serverless Functions) |

---

## 3. ACTIVE DATABASE TABLES (All with RLS)

| Table | Purpose |
|---|---|
| `profiles` | Users (farmer / buyer / pds_operator / admin / fpo), KrishiLink ID, trust score, verification status, address |
| `listings` | Farmer produce listings with quantity, grade, price, photo, status, and `listed_by` |
| `fpo_pools` | Collective bulk pools aggregated by FPO heads |
| `fpo_members` | Roster of verified farmers enrolled in an FPO |
| `fpo_pool_contributions` | Member quantity quotas committed to an active bulk pool |
| `fpo_pool_payouts` | Automated revenue distribution splits per pool member |
| `offers` | Buyer bids on individual listings and FPO pools |
| `transactions` | Final deals with transport mode, 30% advance, and 70% final escrow status |
| `wallets` | Digital wallet account balances |
| `fpo_wallets` | Collective FPO wallet account balances |
| `wallet_transactions` | Audit ledger of top-ups, withdrawals, escrow splits, and member payouts |
| `notifications` | In-app notification feed with deep links |
| `ivr_sessions` | Audit logs of IVR phone interactions and outcomes |
| `ivr_otps` | 6-digit numeric OTPs for IVR identity verification |
| `fee_config` | Dynamic platform commission %, handling, and gateway fees (admin-editable) |
| `transport_rates` | Vehicle rates per km (Tempo, Mini Truck, Truck) |
| `mandi_prices` | APMC benchmark modal prices per crop |

---

## 4. VERIFIED IMPLEMENTATION TIMELINE

- [2026-09-10] Repo scaffold, Next.js 16, Supabase project connected ✅
- [2026-09-11] Database schema, 15 tables, RLS policies, trigger functions ✅
- [2026-09-11] Multi-role auth (farmer, buyer, pds, admin, fpo), role URLs, admin code gate ✅
- [2026-09-12] Landing page with hero, NRE diagrams, earth-toned tokens ✅
- [2026-09-12] Farmer: List produce with photo upload & camera AI ✅
- [2026-09-13] Buyer: Marketplace catalog, filters, detail view, offer form ✅
- [2026-09-13] NRE Engine (`lib/nre/compute.ts`) + `/api/nre/quote` ✅
- [2026-09-13] Farmer: Offers Received ranked by Net Realization desc ✅
- [2026-09-14] Shared Fair Band (`lib/nre/fairBand.ts`) + `FairBandCard.tsx` ✅
- [2026-09-14] Order timeline & transport mode choice (KrishiLink vs self) ✅
- [2026-09-15] Self-hosted fonts via `next/font/local` ✅
- [2026-09-18] Roboflow Computer Vision Serverless Proxy (`app/api/ai/quality/route.ts`) ✅
- [2026-09-22] Route AI Engine: OSRM matrices, Clarke-Wright algorithm, 2-opt TSP (`lib/route-ai/`) ✅
- [2026-09-25] Leaflet Interactive Map: ESRI tiles, order route preview, corridor consolidation ✅
- [2026-09-28] Multi-Role IVR: 26-state machine, English/Hindi/Kannada, Farmer/Buyer/FPO flows ✅
- [2026-10-01] FPO Collective Pooling: Hub, member quotas, buyer bids, automated payouts ✅
- [2026-10-03] Digital Wallet & 30/70 Escrow: Top-up, withdrawal, advance & final delivery release ✅
- [2026-10-05] PDS Assisted Access Kiosk: Farmer ID lookup, listing on behalf of farmers ✅
- [2026-10-06] Admin Suite: KYC verifications, FPO approvals, disputes, route optimizer ✅
- [2026-10-07] Judge Demo Suite: PIN `SIH-2026-KL`, 7 evaluation personas, 1-click switcher ✅

---

## 5. CURRENT STATUS & HEALTH

- **Overall progress:** 100% of blueprint completed
- **TypeScript Health:** 0 compilation errors (`npx tsc --noEmit` clean)
- **Deployment:** Live on Vercel Production
- **Blockers:** None

---

## 6. KEY CODEBASE LOCATIONS

| Subsystem | Primary Implementation |
|---|---|
| Auth & Profiles | `lib/auth.ts`, `middleware.ts`, `lib/supabase/client.ts`, `server.ts` |
| Privileged Operations | `lib/supabase/admin.ts` (Service-role admin client) |
| NRE Math | `lib/nre/compute.ts`, `lib/netRealization.ts`, `app/api/nre/quote/route.ts` |
| Shared Fair Band | `lib/nre/fairBand.ts`, `components/nre/FairBandCard.tsx` |
| Roboflow Vision Proxy | `app/api/ai/quality/route.ts`, `lib/ai/roboflow.ts`, `lib/ai/client.ts` |
| Route AI & Consolidation | `lib/route-ai/index.ts`, `lib/route-ai/server.ts`, `lib/route-ai/districts.ts` |
| Leaflet Maps | `components/logistics/OrderMapView.tsx`, `components/logistics/RouteOptimizer.tsx` |
| IVR Finite State Machine | `lib/ivr/stateMachine.ts`, `app/ivr-sim/IvrClient.tsx`, `app/ivr-sim/actions.ts` |
| Digital Wallet & Escrow | `lib/wallet/actions.ts`, `app/wallet/page.tsx`, `WalletActions.tsx` |
| FPO Collective Pooling | `app/farmer/fpo/ApplyForm.tsx`, `dashboard/actions.ts`, `app/buyer/pools/` |
| PDS Village Kiosk | `app/pds-operator/assist/actions.ts`, `app/pds-operator/farmers/page.tsx` |
| Realtime Sync | `components/LiveSyncProvider.tsx` (12-table WebSocket listener) |
| Judge Evaluation | `components/JudgeDemoButton.tsx`, `app/demo/actions.ts` |

---

## 7. CREDENTIALS & SECURITY CONFIGURATION

- **Judge Demo PIN:** `SIH-2026-KL`
- **Admin Signup Code:** `KRISHI-ADMIN-2026`
- **Demo Personas (All Password `123456`):**
  - Farmer 1: `farmer1demo@gmail.com`
  - Farmer 2: `farmer2demo@gmail.com`
  - Buyer 1: `buyer1demo@gmail.com`
  - Buyer 2: `buyer2demo@gmail.com`
  - FPO Head: `fpodeemo@gmail.com`
  - PDS Operator: `pdsdemo@gmail.com`
  - Admin: `admin@gmail.com`

---

## 8. KNOWN GOTCHAS & MITIGATIONS

| Symptom | Root Cause | Fix Applied |
|---|---|---|
| Leaflet SSR error: `window is not defined` | Leaflet accesses DOM on load | Dynamic client-side import inside `useEffect` |
| Roboflow CORS rejection in browser | Roboflow API keys exposed in browser | Proxied server-side via Next.js route `/api/ai/quality` |
| Stale data across multi-user actions | Next.js server components cache reads | `LiveSyncProvider.tsx` triggers debounced `router.refresh()` via Supabase WebSockets |
| Stale `.next` layout validator cache | Deleted/renamed layout references persist in `.next` | Clear `.next` build directory before full rebuild |
| Duplicate IVR OTP generation | Prior pending OTPs left unverified | Auto-verify and expire older active OTPs before inserting new record |

---

*End of 04_MEMORY.md — Version 3.0, updated 2026-10-07*