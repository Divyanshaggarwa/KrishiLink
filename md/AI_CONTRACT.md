# KrishiLink AI & Logistics Services — Interface Contract
**Version 2.0 | Last updated: 2026-10-07 | Status: Verified & Live**

---

## 1. Overview & 3-Tier AI Architecture

KrishiLink employs a resilient, 3-tier artificial intelligence and optimization architecture designed for high availability during live hackathon evaluation and production deployment:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          3-TIER AI ARCHITECTURE                        │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 1: LIVE CLOUD AI SERVICES (Primary)                              │
│  • Produce Quality Grading: Roboflow Serverless Workflow (ResNet34)    │
│  • Live Road Logistics: OSRM Driving Matrix (router.project-osrm.org)  │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 2: OPTIONAL PYTHON FASTAPI MICROSERVICE                          │
│  • Enabled when NEXT_PUBLIC_AI_URL is specified in .env.local          │
│  • Exposes 5 standard endpoints (Price, Quality, Demand, Route, Fair)  │
├────────────────────────────────────────────────────────────────────────┤
│  TIER 3: DETERMINISTIC RULE-BASED FALLBACK ENGINE (Local)              │
│  • Implemented in lib/ai/mock.ts & lib/netRealization.ts               │
│  • Transparently flags all outputs with `source: "mock"`               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Roboflow Computer Vision Quality AI (Live)

### 2.1 Architecture
The produce listing form uploads images to the Supabase Storage bucket `listing-photos`. The client invokes the server-side Next.js proxy route `POST /api/ai/quality`, which authenticates against the Roboflow Serverless Workflow using server-only environment variables.

### 2.2 Next.js API Proxy Contract
- **Endpoint**: `POST /api/ai/quality`
- **Headers**: `Content-Type: application/json`
- **Request Payload**:
  ```json
  {
    "imageUrl": "https://<supabase-project>.supabase.co/storage/v1/object/public/listing-photos/temp/farmer-123.jpg"
  }
  ```
- **Upstream Workflow**:
  ```
  POST ${ROBOFLOW_SERVERLESS_URL}
  Authorization: Bearer ${ROBOFLOW_API_KEY}
  Body: { "inputs": { "image": { "type": "url", "value": imageUrl } } }
  ```
- **Supported Crops**: `onion`, `potato` (expandable via workflow retraining).
- **Normalized Client Response**:
  ```json
  {
    "grade": "A",
    "confidence": 0.91,
    "raw": { ... }
  }
  ```
- **Grade Normalization**:
  - `A` / `GRADEA` / `A_*` → **Grade A** (Premium)
  - `B` / `GRADEB` / `B_*` → **Grade B** (Standard)
  - `C` / `GRADEC` / `C_*` → **Grade C** (Economy)

---

## 3. Route AI & Logistics Optimization (Live)

### 3.1 Live OSRM Road Routing
KrishiLink directly queries Open Source Routing Machine (OSRM) driving tables to obtain true driving distance and duration rather than unrealistic straight-line Euclidean distances:
- **Matrix Endpoint**: `https://router.project-osrm.org/table/v1/driving/{lng1},{lat1};{lng2},{lat2}?annotations=distance,duration`
- **Route Endpoint**: `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson`
- **Caching**: 30-minute in-memory LRU cache on the Next.js server to prevent rate limits.
- **Fallback**: Haversine distance $\times 1.3$ road tortuosity factor if the OSRM service is unreachable.

### 3.2 Clarke-Wright Vehicle Routing & 2-Opt TSP
- **Vehicle Weight Classes**:
  - **Tempo**: Maximum capacity 500 kg (₹18/km)
  - **Mini Truck**: Maximum capacity 2,000 kg (₹28/km)
  - **Heavy Truck**: Maximum capacity 5,000 kg (₹42/km)
- **Savings Formula**: For any two farms $i$ and $j$ delivering to depot $D$:
  $$\text{Savings}_{i,j} = \text{Distance}(D, i) + \text{Distance}(D, j) - \text{Distance}(i, j)$$
- **Corridor Consolidation**: Any two active orders with farms or buyers within 50 km are automatically evaluated for merged vehicle sharing, reporting solo cost vs consolidated cost and savings in ₹/kg.

---

## 4. External FastAPI Microservice Contract (Tier 2 Optional)

If a separate Python FastAPI service is deployed (e.g. on Render or Railway), set `NEXT_PUBLIC_AI_URL=https://<your-service>.onrender.com`. The adapter in `lib/ai/client.ts` will automatically route requests to these 5 endpoints:

### Endpoint 1: Price Prediction (`POST /predict/price`)
- **Request**:
  ```json
  {
    "crop": "Tomato",
    "quality": "A",
    "quantity_kg": 500,
    "district": "Nashik",
    "month": 10
  }
  ```
- **Response**:
  ```json
  {
    "low": 22.5,
    "high": 25.5,
    "mid": 24.0,
    "confidence": 0.85,
    "factors": ["Seasonal peak in Nashik", "High wholesale demand"],
    "source": "ai"
  }
  ```

### Endpoint 2: Quality Inspection (`POST /predict/quality`)
- **Request**:
  ```json
  {
    "image_base64": "<base64 encoded string>"
  }
  ```
- **Response**:
  ```json
  {
    "grade": "A",
    "confidence": 0.91,
    "defects": [],
    "source": "ai"
  }
  ```

### Endpoint 3: Demand Prediction (`POST /predict/demand`)
- **Request**:
  ```json
  {
    "crop": "Tomato",
    "district": "Nashik",
    "month": 10
  }
  ```
- **Response**:
  ```json
  {
    "demand_index": 0.72,
    "trend": "rising",
    "forecast": [0.60, 0.65, 0.70, 0.75, 0.80, 0.85],
    "source": "ai"
  }
  ```

### Endpoint 4: Route Optimization (`POST /optimize/route`)
- **Request**:
  ```json
  {
    "farm_lat": 20.0059,
    "farm_lng": 73.7898,
    "buyer_lat": 19.0760,
    "buyer_lng": 72.8777,
    "weight_kg": 500
  }
  ```
- **Response**:
  ```json
  {
    "distance_km": 167.4,
    "cost_per_kg": 6.02,
    "vehicle": "Mini Truck",
    "eta_min": 210,
    "source": "ai"
  }
  ```

### Endpoint 5: Fairness Evaluation (`POST /predict/fairness`)
- **Request**:
  ```json
  {
    "crop": "Tomato",
    "quality": "A",
    "quantity_kg": 500,
    "district": "Nashik",
    "month": 10,
    "farmer_expected_price": 24.0,
    "buyer_bid": 26.0
  }
  ```
- **Response**:
  ```json
  {
    "fair_low": 23.5,
    "fair_high": 26.5,
    "fair_mid": 25.0,
    "confidence": 0.78,
    "factors": ["Historical mandi benchmark ₹23.8", "Standard transport overhead ₹1.2"],
    "farmer_verdict": "fair",
    "buyer_verdict": "fair",
    "suggestions": ["Prices are within 1.5 rupees — quick call should close this deal"],
    "source": "ai"
  }
  ```

---

## 5. Client Adapter Behavior (`lib/ai/client.ts`)

1. **Timeout Guard**: Calls to `NEXT_PUBLIC_AI_URL` timeout after 6,000 ms.
2. **Source Tagging**: Every response object contains `source: "ai" | "mock"` for UI auditability.
3. **No Uncaught Exceptions**: If `fetch` throws a network or CORS exception, the adapter silently falls back to the deterministic Tier 3 engine in `lib/ai/mock.ts`.

---

*End of AI_CONTRACT.md — Version 2.0, updated 2026-10-07*