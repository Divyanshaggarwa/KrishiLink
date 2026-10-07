# KrishiLink (कृषिलिंक) — Direct Farmer-to-Buyer Agricultural Marketplace
**Smart India Hackathon (SIH) 2026 | Problem Statement ID: #33**  
**Team: KrishiVanta** | **Status: Live & Feature-Complete** | **Demo URL:** [krishilink-beta.vercel.app](https://krishilink-beta.vercel.app)

---

## 1. Executive Summary & Vision

**KrishiLink** is a direct agricultural marketplace connecting Indian farmers, Farmer Producer Organisations (FPOs), institutional buyers, and village kiosks. By eliminating unnecessary layers of commission agents (*arthiyas* and middlemen), KrishiLink addresses the structural 30–40% value loss suffered by farmers.

The platform is anchored by proprietary innovations:
1. **Net Realization Engine (NRE)**: Calculates the farmer's *actual take-home* earnings (gross offer price minus platform fees, handling, and quality adjustments; transport is paid separately by the buyer) and shows real-time comparison badges against the nearest mandi benchmark.
2. **Shared Fair Band**: A transparent, dual-sided pricing corridor computed from farmer ask, buyer bid, and APMC modal prices, adjusted for quality grade and shared logistics.
3. **Multi-Role IVR Voice Gateway**: Accessible in **Hindi, English, and Kannada** for feature-phone and low-literacy users, supporting Farmers, Buyers, and FPOs through KrishiLink ID (`KL-XXXXXX`) and OTP verification.
4. **FPO Collective Pooling**: Enables FPO heads to aggregate member harvests into bulk commercial lots, accept bulk bids, and automatically distribute escrow payouts to individual member wallets.
5. **30/70 Digital Wallet Escrow**: Anti-fraud financial flow (30% advance on order confirmation, 70% released on buyer delivery verification) built on PostgreSQL stored procedures.
6. **AI Produce Quality Grading**: Computer Vision integration via Roboflow Serverless Workflow (grading produce into Grade A, B, or C with confidence scores).
7. **Route AI & Logistics Optimization**: Live road routing via OSRM, interactive Leaflet maps, Clarke-Wright vehicle pooling, and 2-opt TSP route improvement.
8. **PDS Village Kiosk Support**: Allows Fair Price Shop (PDS) operators to look up village farmers and list produce on their behalf.

---

## 2. Key Differentiators & Core Features

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   KRISHILINK ECOSYSTEM                                 │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│    FARMER & FPO HUB      │      BUYER MARKETPLACE      │       INCLUSIVE ACCESS        │
│  • Produce Listing       │  • Direct Farmer Catalog    │  • 3-Language IVR Gateway     │
│  • NRE Take-Home Quotes  │  • FPO Bulk Pools           │  • KrishiLink ID + SMS OTP    │
│  • FPO Bulk Pooling      │  • Shared Fair Band         │  • PDS Village Operator Kiosk │
│  • Member Payout Ledger  │  • 30% Advance Escrow       │  • Realtime WebSocket Sync    │
│  • Self/KrishiLink Cargo │  • Route Map Tracking       │  • Judge 1-Click Demo Mode    │
└──────────────────────────┴─────────────────────────────┴───────────────────────────────┘
```

### 2.1 Net Realization Engine (NRE)
Traditional marketplaces quote gross prices, hiding commission deductions until settlement. NRE calculates farmer take-home before offer acceptance:
$$\text{Farmer Net Realization} = \text{Offer Price} - \text{Farmer Fee} - \text{Gateway Fee} - \text{Handling} - \text{Quality Deduction}$$
Transport is not deducted from farmer proceeds; buyers compare transport costs separately.
Farmers compare offers against the Mandi Benchmark:
$$\text{Mandi Net} = \text{Modal Price} - \text{APMC Commission (6\%)} - \text{Transport to Mandi} - \text{Spoilage (3\%)}$$

### 2.2 Shared Fair Band
For onion, potato, and tomato, historical observations in
`lib/fairPrice/data.json` are used for negotiation only when the listing is in
Agra and the latest observation is within seven days. Stale or out-of-region
sample prices are not used to block offers. Otherwise, the configured Fairness
AI is checked against a stable local reference, with implausible ranges falling
back to an indicative calculation. Buyer negotiation and server-side offer
validation use the same range, which does not move when the buyer changes their
bid. Grade B/C market references may be estimated from Grade A and are flagged.

### 2.3 FPO Collective Pooling & Member Revenue Splitting
Smallholders (<2 acres) cannot fulfill bulk buyer orders independently. KrishiLink enables:
- FPO registration validated against existing KrishiLink farmer IDs.
- Creation of pooled bulk lots with individual member contribution quotas (`fpo_pool_contributions`).
- Automated proportional revenue distribution to member wallets (`fpo_pool_payouts`) upon delivery confirmation.

### 2.4 Digital Wallet & 30/70 Escrow State Machine
- **30% Advance**: Buyer wallet is debited 30% of crop value; the corresponding 30% of farmer net is held as locked escrow in the seller/FPO wallet until final payment.
- **Final Settlement**: After delivery confirmation, the buyer pays the remaining crop value plus configured fees and transport; the locked funds are released, platform/transporter fees are credited, member shares are distributed, and trust scores increment (+2).

### 2.5 Computer Vision Quality AI (Roboflow Serverless)
- Farmers upload produce photos during listing.
- Server-side proxy (`app/api/ai/quality`) sends image to Roboflow workflow.
- Roboflow classes must include both crop and grade, for example `Onion_A`.
- The response parser supports nested workflow outputs and separate crop and
  grade classification outputs, including `class`, `class_name`, and `top`
  labels. Both labels must be present before the AI grade is applied.
- The listing form compares the detected crop with the entered crop; a mismatch
  clears and disables grade selection, and the listing cannot be published.
- A grade-only response is insufficient for verification. When the AI cannot
  identify the crop, it does not auto-select a grade; the farmer can enter a
  grade manually if the image is not reported as a mismatch.

### 2.6 Route AI & Logistics Optimization
- OSRM live routing (`router.project-osrm.org`) with 30-minute in-memory caching.
- Clarke-Wright savings algorithm for vehicle assignment (Tempo: 500kg, Mini Truck: 2000kg, Truck: 5000kg).
- Multi-order corridor consolidation within 50km radius, calculating shared logistics savings in ₹/kg.
- Interactive Leaflet maps (`OrderMapView.tsx`, `RouteOptimizer.tsx`) with ESRI satellite and street tiles.

### 2.7 Net realization and settlement
- Farmer net realization deducts configured farmer fees, gateway fees, handling,
  and grade deductions; it never deducts transport.
- Buyers compare projected farmer take-home and see buyer-paid transport
  estimates for eligible vehicles.
- Buyer escrow is 30% of crop value. The corresponding 30% farmer proceeds stay
  locked until the buyer's final payment completes the order.
- Buyer, farmer, and KrishiLink transporter fees are credited only on order
  completion. KrishiLink-arranged transport uses the platform admin profile as
  its transport account; self-delivery transport reimbursement goes to the
  farmer.
- Buyer offers run Fair Price AI first, then confirm the buyer-adjusted demo
  negotiated price, and only then estimate delivery with Route AI. If Route AI
  is unavailable or returns an invalid result, the estimate uses the mock route
  calculation. Delivery cost is included in the buyer estimate, not deducted
  from farmer net realization.
- Fair Price AI uses the historical Agra market sample in `lib/fairPrice/data.json`
  for onion, potato, and tomato when available. The resulting grade-specific
  range is used both in buyer negotiation and server-side offer validation.
  Farmer listing forms show the same reference; buyer browsing gets an
  advisory recommendation based on configured delivery estimates and quality.
  This seed dataset is not a live market feed; check the displayed observation
  date and confidence. Update the JSON observations to refresh the reference.
- `GET /api/fair-price?crop=onion` returns available grade ranges;
  `POST /api/recommend` accepts buyer-visible listing and delivery estimates.
- Run [`supabase/finance-workflow.sql`](./supabase/finance-workflow.sql) once in
  the Supabase SQL Editor before deploying these changes.

### 2.8 Interactive Voice Response (IVR) Gateway
Accessible at `/ivr-sim` (mirrors Exotel/Twilio production webhooks):
- 26-state machine supporting English, Hindi, and Kannada.
- **Farmer flow**: List produce, hear top offers ranked by Net Realization, accept/reject deals.
- **Buyer flow**: Browse crop listings, place numeric bids via keypad, review bids/orders.
- **FPO flow**: Create pooled lots, record member contributions sequentially over voice.

---

## 3. System Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND CLIENT LAYER                           │
│     Next.js 16 (App Router) + React 18 + Tailwind CSS + Framer Motion  │
│  Farmer Portal │ FPO Hub │ Buyer Marketplace │ PDS Kiosk │ Admin Suite │
├────────────────────────────────────────────────────────────────────────┤
│                      BACKEND & SERVER ACTION LAYER                     │
│  • Next.js Server Actions ("use server") + Route Handlers              │
│  • Edge Middleware (role protection & route redirection)               │
│  • NRE Pure Computation Engine (lib/nre/compute.ts)                    │
│  • Route AI Server & District Resolvers (lib/route-ai/)                │
│  • Roboflow Computer Vision Proxy (app/api/ai/quality/route.ts)        │
│  • IVR State Machine (lib/ivr/stateMachine.ts)                         │
│  • Digital Wallet Engine (lib/wallet/actions.ts)                       │
├────────────────────────────────────────────────────────────────────────┤
│                      DATA, STORAGE & SECURITY LAYER                    │
│  • Supabase PostgreSQL 15 (12+ tables with strict Row Level Security)   │
│  • SQL Stored Procedures: wallet_credit, wallet_debit, bump_trust      │
│  • Supabase Storage: 'listing-photos' bucket                           │
│  • Supabase Realtime: WebSocket event broadcasting to all clients      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. User Roles & Capabilities

| Role | Primary Route | Key Capabilities |
| :--- | :--- | :--- |
| **Farmer** | `/farmer` | List crops (with CV camera grading), view offers ranked by Net Realization, accept partial/full deals, choose transport mode, track orders, book calls, manage digital wallet. |
| **FPO Head** | `/farmer/fpo/dashboard` | Manage member roster, create bulk collective pools, review pooled buyer bids, accept deals, monitor automated member revenue distributions. |
| **Buyer** | `/buyer` | Browse individual & FPO bulk listings, filter by crop/grade/region, view Fair Band, place bids, pay 30% advance escrow, track Leaflet delivery map, confirm delivery. |
| **PDS Operator** | `/pds-operator` | Assisted access kiosk: look up village farmers by KrishiLink ID (`KL-XXXXXX`), list produce on their behalf, monitor local village listings, earn trust credits. |
| **Platform Admin** | `/admin` | Configure platform fees & vehicle transport rates, approve KYC verifications, review FPO applications, manage disputes, inspect transaction ledger, run Route Optimizer. |

---

## 5. Judge Demo & Evaluation Mode

For rapid hackathon evaluation without manual registration, use the **Judge Demo** button on the landing page:

- **Judge Demo PIN**: `SIH-2026-KL`
- **Session Duration**: 10 minutes (stored via secure cookie)

### Pre-Configured Persona Accounts:

| Persona | Role | Location | Demo Email | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Farmer 1** | Farmer | Nashik, MH (Tomato) | `farmer1demo@gmail.com` | `123456` |
| **Farmer 2** | Farmer | Pune, MH (Onion) | `farmer2demo@gmail.com` | `123456` |
| **Buyer 1** | Buyer | Mumbai, MH (Wholesaler) | `buyer1demo@gmail.com` | `123456` |
| **Buyer 2** | Buyer | Thane, MH (Retail Chain) | `buyer2demo@gmail.com` | `123456` |
| **FPO Head** | FPO | Nashik, MH (Sahyadri FPO) | `fpodeemo@gmail.com` | `123456` |
| **PDS Operator** | PDS Kiosk | Dindori, MH (Village Kiosk)| `pdsdemo@gmail.com` | `123456` |
| **Platform Admin**| Admin | Platform Headquarters | `admin@gmail.com` | `123456` |

---

## 6. Project Structure

```
krishilink/
├── app/
│   ├── admin/                   # Admin suite (fees, FPO approvals, verifications, disputes, logistics)
│   ├── api/
│   │   ├── ai/quality/          # Roboflow Computer Vision proxy
│   │   ├── notifications/       # Real-time notifications API
│   │   ├── nre/quote/           # Net Realization Engine calculation endpoint
│   │   └── orders/[id]/map/     # Order GeoJSON & route coordinates endpoint
│   ├── auth/                    # Sign out route handler
│   ├── buyer/
│   │   ├── bids/                # Active and past bids
│   │   ├── browse/              # Catalog with filters & detail pages
│   │   ├── orders/              # Order tracking & escrow payments
│   │   └── pools/               # FPO bulk pools marketplace
│   ├── demo/                    # Judge Demo PIN unlock & persona switching actions
│   ├── farmer/
│   │   ├── fpo/                 # FPO application & dashboard (pools, members, wallet)
│   │   ├── list/                # Produce listing with photo & CV camera grading
│   │   ├── listings/            # My listings management
│   │   ├── offers/              # Offers received ranked by Net Realization
│   │   └── orders/              # Order tracking & fulfillment
│   ├── ivr-sim/                 # Multi-role, 3-language IVR browser simulator
│   ├── login/ & signup/         # Role-based authentication
│   ├── orders/[id]/             # Detailed order view with Leaflet route map & consolidation
│   ├── pds-operator/            # Assisted access kiosk & village farmers management
│   ├── wallet/                  # Digital wallet (balance, top-up, withdrawal, transactions)
│   ├── layout.tsx & page.tsx    # Root layout & hero landing page
├── components/
│   ├── logistics/
│   │   ├── OrderMapView.tsx     # Interactive Leaflet order route map
│   │   └── RouteOptimizer.tsx   # Admin multi-truck route planning & consolidation tool
│   ├── nre/
│   │   ├── FairBandCard.tsx     # Dual-sided Fair Band card
│   │   └── RealizationCard.tsx  # Stacked deduction breakdown card
│   ├── orders/Timeline.tsx      # Multi-stage fulfillment timeline
│   ├── JudgeDemoButton.tsx      # 1-click evaluation persona switcher
│   ├── LiveSyncProvider.tsx     # 12-table Supabase Realtime WebSocket provider
│   ├── NotificationBell.tsx     # Notification dropdown
│   └── SiteHeader.tsx           # Global navigation
├── lib/
│   ├── ai/                      # AI client, types, mocks, and Roboflow integration
│   ├── auth.ts                  # Profile types and role-guard utilities
│   ├── ivr/stateMachine.ts      # 26-state IVR engine with i18n prompts
│   ├── netRealization.ts        # Core formula & district distance estimation
│   ├── nre/                     # Pure NRE calculations, fair band, and fee loaders
│   ├── route-ai/                # OSRM routing, Clarke-Wright algorithm, district coordinates
│   ├── supabase/                # Browser, server, and service-role admin Supabase clients
│   └── wallet/actions.ts        # Wallet top-up, withdrawal, and 30/70 escrow actions
├── public/                      # Static assets & brand logos
├── middleware.ts                # Edge role guard middleware
├── package.json
└── tsconfig.json
```

---

## 7. Environment Variables Reference

Create a `.env.local` file in the root directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Administrative Security
ADMIN_SIGNUP_CODE=KRISHI-ADMIN-2026

# Judge Evaluation PIN
JUDGE_DEMO_PIN=SIH-2026-KL

# Pre-Configured Demo Accounts
DEMO_FARMER1_EMAIL=farmer1demo@gmail.com
DEMO_FARMER1_PASSWORD=123456
DEMO_FARMER2_EMAIL=farmer2demo@gmail.com
DEMO_FARMER2_PASSWORD=123456
DEMO_BUYER1_EMAIL=buyer1demo@gmail.com
DEMO_BUYER1_PASSWORD=123456
DEMO_BUYER2_EMAIL=buyer2demo@gmail.com
DEMO_BUYER2_PASSWORD=123456
DEMO_FPO_EMAIL=fpodeemo@gmail.com
DEMO_FPO_PASSWORD=123456
DEMO_PDS_EMAIL=pdsdemo@gmail.com
DEMO_PDS_PASSWORD=123456
DEMO_ADMIN_EMAIL=admin@gmail.com
DEMO_ADMIN_PASSWORD=123456

# Roboflow Computer Vision (Server-side only)
ROBOFLOW_SERVERLESS_URL=https://serverless.roboflow.com/<workspace>/workflows/<workflow-id>
ROBOFLOW_API_KEY=<your-roboflow-key>

# Optional External AI Microservice (Falls back to local modules if unset)
NEXT_PUBLIC_AI_URL=
```

To switch the quality checker to a retrained Roboflow workflow, update
`ROBOFLOW_SERVERLESS_URL` to the new workflow endpoint and keep the existing
`ROBOFLOW_API_KEY` if its permissions cover that workflow. Restart locally or
redeploy so the server picks up the new environment value.

---

## 8. Local Setup & Installation

### Prerequisites
- Node.js 18.18+ or 20+
- npm or pnpm
- A Supabase project with PostgreSQL

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Divyanshaggarwa/Krishilink.git
   cd Krishilink
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.local.example .env.local
   # Fill in Supabase credentials and Roboflow keys
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000). Click **Judge Demo** in the navigation bar, enter `SIH-2026-KL`, and select any persona to begin testing.

6. **Verify build & types**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

---

## 9. Contributors & Acknowledgements

- **Team KrishiVanta** — Smart India Hackathon (SIH) 2026
- Built with Next.js, Supabase, Tailwind CSS, Leaflet, and Roboflow.
