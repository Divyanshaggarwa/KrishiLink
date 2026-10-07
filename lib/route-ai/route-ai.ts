import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDistrictCoords, jitterCoords } from "./districts";

/* ========================================================================
   Route computation — server-side (with cache)
   ======================================================================== */

const OSRM = "https://router.project-osrm.org";
const routeCache = new Map<string, RouteResult>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  polyline: [number, number][];
  vehicle: string;
  cachedAt: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

function pickVehicle(weightKg: number): string {
  if (weightKg < 500) return "Tempo";
  if (weightKg < 2000) return "Mini Truck";
  return "Truck";
}

export async function computeRoute(
  a: GeoPoint,
  b: GeoPoint
): Promise<RouteResult> {
  const key = `${a.lat.toFixed(4)},${a.lng.toFixed(4)}->${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const url = `${OSRM}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (res.ok) {
      const j = await res.json();
      if (j.code === "Ok" && j.routes?.length) {
        const r = j.routes[0];
        const result: RouteResult = {
          distanceKm: Number((r.distance / 1000).toFixed(2)),
          durationMin: Math.round(r.duration / 60),
          polyline: r.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          ),
          vehicle: "Tempo",
          cachedAt: Date.now(),
        };
        routeCache.set(key, result);
        return result;
      }
    }
  } catch {
    /* fall through to haversine */
  }

  // Haversine fallback
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distanceKm = Number((2 * R * Math.asin(Math.sqrt(h)) * 1.3).toFixed(2));

  return {
    distanceKm,
    durationMin: Math.round((distanceKm / 35) * 60),
    polyline: [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ],
    vehicle: "Tempo",
    cachedAt: Date.now(),
  };
}

/* ========================================================================
   Order route context — what both farmer & buyer see
   ======================================================================== */

export interface OrderRouteContext {
  order: {
    id: string;
    shortId: string;
    status: string;
    crop: string;
    quantityKg: number;
    pricePerKg: number;
    grossAmount: number;
    logisticsCostPerKg: number;
    distanceKm: number;
  };
  farmer: {
    id: string;
    name: string;
    district: string | null;
    state: string | null;
    coords: GeoPoint;
  };
  buyer: {
    id: string;
    name: string;
    district: string | null;
    state: string | null;
    coords: GeoPoint;
  };
  route: RouteResult;
  transportCostTotal: number;
  perKgTransport: number;
  nearbyOrders: NearbyOrder[];
  consolidation: ConsolidationSuggestion | null;
}

export interface NearbyOrder {
  id: string;
  shortId: string;
  crop: string;
  quantityKg: number;
  status: string;
  farmerName: string;
  buyerName: string;
  farmerCoords: GeoPoint;
  buyerCoords: GeoPoint;
  sameCorridor: boolean;
  distanceFromThisOrderKm: number;
}

export interface ConsolidationSuggestion {
  canConsolidate: boolean;
  sharedOrdersCount: number;
  sharedQuantityKg: number;
  vehicle: string;
  vehicleCapacityKg: number;
  utilizationPercent: number;
  originalTotalCost: number;
  consolidatedTotalCost: number;
  savingsTotal: number;
  savingsPercent: number;
  savingsPerKg: number;
  combinedPolyline: [number, number][];
  stops: Array<{
    kind: "pickup" | "drop";
    name: string;
    lat: number;
    lng: number;
    orderId: string;
  }>;
}

const VEHICLE_CAPACITY: Record<string, number> = {
  Tempo: 500,
  "Mini Truck": 2000,
  Truck: 5000,
};

export async function getOrderRouteContext(
  orderId: string,
  profileId: string,
  role: string
): Promise<OrderRouteContext | null> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("transactions")
    .select(
      "id, farmer_id, buyer_id, quantity_kg, gross_amount, final_price_per_kg, logistics_cost_per_kg, distance_km, status, pool_id, listing:listings(crop), pool:fpo_pools(crop, fpo_id)"
    )
    .eq("id", orderId)
    .single();

  if (!order) return null;

  // Access check
  if (
    role !== "admin" &&
    profileId !== order.farmer_id &&
    profileId !== order.buyer_id
  ) {
    return null;
  }

  const pickupUserId = order.pool_id
    ? (Array.isArray(order.pool) ? order.pool[0] : order.pool)?.fpo_id ??
      order.farmer_id
    : order.farmer_id;

  const [farmerRes, buyerRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, district, state, pincode, business_name")
      .eq("id", pickupUserId)
      .single(),
    admin
      .from("profiles")
      .select("id, full_name, district, state, pincode, business_name")
      .eq("id", order.buyer_id)
      .single(),
  ]);

  const farmer = farmerRes.data;
  const buyer = buyerRes.data;
  if (!farmer || !buyer) return null;

  const farmerCoords = jitterCoords(
    getDistrictCoords(farmer.district, farmer.state, farmer.pincode),
    farmer.id
  );
  const buyerCoords = jitterCoords(
    getDistrictCoords(buyer.district, buyer.state, buyer.pincode),
    buyer.id
  );

  const route = await computeRoute(farmerCoords, buyerCoords);
  const vehicle = pickVehicle(Number(order.quantity_kg));

  // Find nearby active orders (same farmer OR same buyer OR same corridor)
  const nearbyOrders = await findNearbyOrders(
    order.id,
    pickupUserId,
    order.buyer_id,
    farmerCoords,
    buyerCoords,
    admin
  );

  // Build consolidation suggestion if applicable
  const consolidation = buildConsolidation(
    {
      id: order.id,
      crop:
        (Array.isArray(order.listing) ? order.listing[0] : order.listing)
          ?.crop ??
        (Array.isArray(order.pool) ? order.pool[0] : order.pool)?.crop ??
        "Produce",
      quantityKg: Number(order.quantity_kg),
      farmerCoords,
      buyerCoords,
      routeKm: route.distanceKm,
      farmerName: farmer.full_name,
      buyerName: buyer.business_name || buyer.full_name,
    },
    nearbyOrders,
    vehicle
  );

  const transportCostPerKg = Number(order.logistics_cost_per_kg || 0);
  const transportCostTotal = transportCostPerKg * Number(order.quantity_kg);

  return {
    order: {
      id: order.id,
      shortId: order.id.slice(0, 8),
      status: order.status,
      crop:
        (Array.isArray(order.listing) ? order.listing[0] : order.listing)
          ?.crop ??
        (Array.isArray(order.pool) ? order.pool[0] : order.pool)?.crop ??
        "Produce",
      quantityKg: Number(order.quantity_kg),
      pricePerKg: Number(order.final_price_per_kg),
      grossAmount: Number(order.gross_amount),
      logisticsCostPerKg: transportCostPerKg,
      distanceKm: route.distanceKm,
    },
    farmer: {
      id: farmer.id,
      name: farmer.full_name,
      district: farmer.district,
      state: farmer.state,
      coords: farmerCoords,
    },
    buyer: {
      id: buyer.id,
      name: buyer.business_name || buyer.full_name,
      district: buyer.district,
      state: buyer.state,
      coords: buyerCoords,
    },
    route: {
      ...route,
      vehicle,
    },
    transportCostTotal,
    perKgTransport: transportCostPerKg,
    nearbyOrders,
    consolidation,
  };
}

/* ========================================================================
   Nearby orders finder
   ======================================================================== */

async function findNearbyOrders(
  excludeOrderId: string,
  farmerId: string,
  buyerId: string,
  farmerCoords: GeoPoint,
  buyerCoords: GeoPoint,
  admin: ReturnType<typeof createAdminClient>
): Promise<NearbyOrder[]> {
  const { data: orders } = await admin
    .from("transactions")
    .select(
      "id, farmer_id, buyer_id, quantity_kg, status, pool_id, listing:listings(crop), pool:fpo_pools(crop, fpo_id)"
    )
    .in("status", ["escrow_paid", "in_transit", "delivered"])
    .neq("id", excludeOrderId)
    .limit(20);

  if (!orders || orders.length === 0) return [];

  // Fetch all involved users
  const userIds = new Set<string>();
  orders.forEach((o) => {
    userIds.add(o.farmer_id);
    userIds.add(o.buyer_id);
    const pool = Array.isArray(o.pool) ? o.pool[0] : o.pool;
    if (pool?.fpo_id) userIds.add(pool.fpo_id);
  });

  const { data: users } = await admin
    .from("profiles")
    .select("id, full_name, district, state, pincode, business_name")
    .in("id", Array.from(userIds));

  const userMap = new Map((users || []).map((u) => [u.id, u]));

  const nearby: NearbyOrder[] = [];

  for (const o of orders) {
    const pool = Array.isArray(o.pool) ? o.pool[0] : o.pool;
    const pickupUserId = pool?.fpo_id ?? o.farmer_id;
    const farmer = userMap.get(pickupUserId);
    const buyer = userMap.get(o.buyer_id);
    if (!farmer || !buyer) continue;

    const fCoords = jitterCoords(
      getDistrictCoords(farmer.district, farmer.state, farmer.pincode),
      farmer.id
    );
    const bCoords = jitterCoords(
      getDistrictCoords(buyer.district, buyer.state, buyer.pincode),
      buyer.id
    );

    // Same corridor check: farmer within 50km AND buyer within 50km
    const farmerDist = haversineKm(farmerCoords, fCoords);
    const buyerDist = haversineKm(buyerCoords, bCoords);
    const sameCorridor = farmerDist < 50 || buyerDist < 50;

    if (!sameCorridor) continue;

    nearby.push({
      id: o.id,
      shortId: o.id.slice(0, 8),
      crop:
        (Array.isArray(o.listing) ? o.listing[0] : o.listing)?.crop ??
        pool?.crop ??
        "Produce",
      quantityKg: Number(o.quantity_kg),
      status: o.status,
      farmerName: farmer.full_name,
      buyerName: buyer.business_name || buyer.full_name,
      farmerCoords: fCoords,
      buyerCoords: bCoords,
      sameCorridor,
      distanceFromThisOrderKm: Number(
        Math.min(farmerDist, buyerDist).toFixed(1)
      ),
    });
  }

  // Sort by proximity
  nearby.sort((a, b) => a.distanceFromThisOrderKm - b.distanceFromThisOrderKm);
  return nearby.slice(0, 5);
}

/* ========================================================================
   Consolidation suggestion
   ======================================================================== */

function buildConsolidation(
  main: {
    id: string;
    crop: string;
    quantityKg: number;
    farmerCoords: GeoPoint;
    buyerCoords: GeoPoint;
    routeKm: number;
    farmerName: string;
    buyerName: string;
  },
  nearby: NearbyOrder[],
  vehicle: string
): ConsolidationSuggestion | null {
  if (nearby.length === 0) return null;

  const capacity = VEHICLE_CAPACITY[vehicle] || 500;

  // Build a virtual combined load
  const allOrders = [
    {
      id: main.id,
      kg: main.quantityKg,
      farmerCoords: main.farmerCoords,
      buyerCoords: main.buyerCoords,
      farmerName: main.farmerName,
      buyerName: main.buyerName,
    },
    ...nearby.map((n) => ({
      id: n.id,
      kg: n.quantityKg,
      farmerCoords: n.farmerCoords,
      buyerCoords: n.buyerCoords,
      farmerName: n.farmerName,
      buyerName: n.buyerName,
    })),
  ];

  let sharedQty = 0;
  const canShare: typeof allOrders = [];

  for (const o of allOrders) {
    if (sharedQty + o.kg <= capacity) {
      canShare.push(o);
      sharedQty += o.kg;
    }
  }

  if (canShare.length < 2) {
    return {
      canConsolidate: false,
      sharedOrdersCount: 1,
      sharedQuantityKg: main.quantityKg,
      vehicle,
      vehicleCapacityKg: capacity,
      utilizationPercent: Math.round((main.quantityKg / capacity) * 100),
      originalTotalCost: 0,
      consolidatedTotalCost: 0,
      savingsTotal: 0,
      savingsPercent: 0,
      savingsPerKg: 0,
      combinedPolyline: [],
      stops: [],
    };
  }

  // Stops to visit
  const stops: ConsolidationSuggestion["stops"] = [];
  for (const o of canShare) {
    stops.push({
      kind: "pickup",
      name: o.farmerName,
      lat: o.farmerCoords.lat,
      lng: o.farmerCoords.lng,
      orderId: o.id,
    });
  }
  for (const o of canShare) {
    stops.push({
      kind: "drop",
      name: o.buyerName,
      lat: o.buyerCoords.lat,
      lng: o.buyerCoords.lng,
      orderId: o.id,
    });
  }

  // Rough cost estimate: sum of independent routes vs combined route
  // Independent: each order pays its own 2-way trip
  let originalCost = 0;
  let combinedDistanceKm = 0;

  for (const o of canShare) {
    const d = haversineKm(o.farmerCoords, o.buyerCoords) * 1.3;
    originalCost += d * 2; // two-way for each solo trip
  }

  // Combined: chain all stops
  combinedDistanceKm = estimateChainDistance(stops);

  const ratePerKm = 18; // baseline
  const originalTotalCost = originalCost * ratePerKm;
  const consolidatedTotalCost = combinedDistanceKm * ratePerKm;
  const savingsTotal = originalTotalCost - consolidatedTotalCost;
  const savingsPercent =
    originalTotalCost > 0
      ? Math.round((savingsTotal / originalTotalCost) * 100)
      : 0;
  const savingsPerKg =
    sharedQty > 0 ? Number((savingsTotal / sharedQty).toFixed(2)) : 0;

  const combinedPolyline: [number, number][] = stops.map((s) => [s.lat, s.lng]);

  return {
    canConsolidate: true,
    sharedOrdersCount: canShare.length,
    sharedQuantityKg: sharedQty,
    vehicle,
    vehicleCapacityKg: capacity,
    utilizationPercent: Math.round((sharedQty / capacity) * 100),
    originalTotalCost: Math.round(originalTotalCost),
    consolidatedTotalCost: Math.round(consolidatedTotalCost),
    savingsTotal: Math.round(savingsTotal),
    savingsPercent,
    savingsPerKg,
    combinedPolyline,
    stops,
  };
}

function estimateChainDistance(stops: ConsolidationSuggestion["stops"]): number {
  if (stops.length < 2) return 0;
  // Simple nearest-neighbor chain
  const remaining = [...stops];
  let total = 0;
  let current = remaining.shift()!;
  while (remaining.length > 0) {
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }
    total += minDist * 1.3;
    current = remaining.splice(closest, 1)[0];
  }
  return total;
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ========================================================================
   Net Realization helper — replaces fake distance with real OSRM distance
   ======================================================================== */

export async function getRealDistanceForNre(
  farmerDistrict: string | null,
  farmerState: string | null,
  farmerPincode: string | null,
  farmerId: string,
  buyerDistrict: string | null,
  buyerState: string | null,
  buyerPincode: string | null,
  buyerId: string
): Promise<number> {
  const a = jitterCoords(
    getDistrictCoords(farmerDistrict, farmerState, farmerPincode),
    farmerId
  );
  const b = jitterCoords(
    getDistrictCoords(buyerDistrict, buyerState, buyerPincode),
    buyerId
  );
  const route = await computeRoute(a, b);
  return route.distanceKm;
}