import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDistrictCoords, jitterCoords } from "./districts";

/* ========================================================================
   Route computation — server-side with cache
   ======================================================================== */

const OSRM = "https://router.project-osrm.org";
const routeCache = new Map<string, RouteResult>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  polyline: [number, number][];
  vehicle: string;
  source: "road" | "estimate";
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
          source: "road",
          cachedAt: Date.now(),
        };
        routeCache.set(key, result);
        return result;
      }
    }
  } catch {
    /* fall through to haversine */
  }

  // Haversine fallback (× 1.3 for road factor)
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distanceKm = Number(
    (2 * R * Math.asin(Math.sqrt(h)) * 1.3).toFixed(2)
  );

  return {
    distanceKm,
    durationMin: Math.round((distanceKm / 35) * 60),
    polyline: [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ],
    vehicle: "Tempo",
    source: "estimate",
    cachedAt: Date.now(),
  };
}

async function computeMultiStopRoute(
  stops: GeoPoint[],
  vehicle: string
): Promise<RouteResult> {
  const key = `stops:${stops
    .map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`)
    .join(";")}`;
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached, vehicle };
  }

  try {
    const coordinates = stops
      .map((point) => `${point.lng},${point.lat}`)
      .join(";");
    const response = await fetch(
      `${OSRM}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
      { signal: AbortSignal.timeout(8000) }
    );
    const result = await response.json();
    const roadRoute = result.routes?.[0];
    if (response.ok && result.code === "Ok" && roadRoute) {
      const route: RouteResult = {
        distanceKm: Number((roadRoute.distance / 1000).toFixed(2)),
        durationMin: Math.round(roadRoute.duration / 60),
        polyline: roadRoute.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        ),
        vehicle,
        source: "road",
        cachedAt: Date.now(),
      };
      routeCache.set(key, route);
      return route;
    }
  } catch {
    // Keep route sharing available while clearly identifying estimated geometry.
  }

  let distanceKm = 0;
  for (let index = 1; index < stops.length; index++) {
    distanceKm += haversineKm(stops[index - 1], stops[index]) * 1.3;
  }
  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin: Math.round((distanceKm / 35) * 60),
    polyline: stops.map((point) => [point.lat, point.lng]),
    vehicle,
    source: "estimate",
    cachedAt: Date.now(),
  };
}

/* ========================================================================
   Order route context — shared payload for farmer & buyer views
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
    netRealizationPerKg: number | null;
    netRealizationTotal: number | null;
    buyerTotalPayable: number | null;
    logisticsCostPerKg: number;
    transportMode: string | null;
    distanceKm: number;
    updatedAt: string;
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
  transportCostTotal: number;
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
  routeKm: number;
  routeDurationMin: number;
  routeSource: "road" | "estimate";
  combinedPolyline: [number, number][];
  stops: Array<{
    kind: "pickup" | "drop";
    name: string;
    lat: number;
    lng: number;
    orderId: string;
    crop: string;
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
      "id, farmer_id, buyer_id, quantity_kg, gross_amount, net_realization_per_kg, net_amount, buyer_total_payable, transport_cost_total, final_price_per_kg, logistics_cost_per_kg, distance_km, status, updated_at, transport_mode, transporter_id, vehicle_type, pool_id, listing:listings(crop), pool:fpo_pools(crop, fpo_id)"
    )
    .eq("id", orderId)
    .single();

  if (!order) return null;

  // Access control
  if (
    role !== "admin" &&
    profileId !== order.farmer_id &&
    profileId !== order.buyer_id
  ) {
    return null;
  }

  const poolObj = Array.isArray(order.pool) ? order.pool[0] : order.pool;
  const pickupUserId = order.pool_id
    ? poolObj?.fpo_id ?? order.farmer_id
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

  const listingObj = Array.isArray(order.listing)
    ? order.listing[0]
    : order.listing;
  const crop = listingObj?.crop ?? poolObj?.crop ?? "Produce";

  const transportCostPerKg = Number(order.logistics_cost_per_kg || 0);
  const transportCostTotal = Number(
    order.transport_cost_total ??
      transportCostPerKg * Number(order.quantity_kg)
  );
  const mainOrder = {
    id: order.id,
    crop,
    quantityKg: Number(order.quantity_kg),
    farmerCoords,
    buyerCoords,
    farmerName: farmer.full_name,
    buyerName: buyer.business_name || buyer.full_name,
    status: order.status,
    transportMode: order.transport_mode,
    transporterId: order.transporter_id,
    transportCostTotal,
  };
  const nearbyOrders = await findNearbyOrders(mainOrder, admin);
  const consolidation = await buildConsolidation(
    {
      id: order.id,
      crop,
      quantityKg: Number(order.quantity_kg),
      farmerCoords,
      buyerCoords,
      farmerName: farmer.full_name,
      buyerName: buyer.business_name || buyer.full_name,
      transportCostTotal,
    },
    nearbyOrders
  );

  return {
    order: {
      id: order.id,
      shortId: order.id.slice(0, 8),
      status: order.status,
      crop,
      quantityKg: Number(order.quantity_kg),
      pricePerKg: Number(order.final_price_per_kg),
      grossAmount: Number(order.gross_amount),
      netRealizationPerKg:
        order.net_realization_per_kg == null
          ? null
          : Number(order.net_realization_per_kg),
      netRealizationTotal:
        order.net_amount == null ? null : Number(order.net_amount),
      buyerTotalPayable:
        order.buyer_total_payable == null
          ? null
          : Number(order.buyer_total_payable),
      logisticsCostPerKg: transportCostPerKg,
      transportMode: order.transport_mode,
      distanceKm: route.distanceKm,
      updatedAt: order.updated_at,
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
    route: { ...route, vehicle: order.vehicle_type || vehicle },
    transportCostTotal,
    perKgTransport: transportCostPerKg,
    nearbyOrders,
    consolidation,
  };
}

/* ========================================================================
   Nearby orders
   ======================================================================== */

async function findNearbyOrders(
  main: {
    id: string;
    status: string;
    transportMode: string | null;
    transporterId: string | null;
    farmerCoords: GeoPoint;
    buyerCoords: GeoPoint;
  },
  admin: ReturnType<typeof createAdminClient>
): Promise<NearbyOrder[]> {
  if (
    !["escrow_paid", "in_transit"].includes(main.status) ||
    main.transportMode !== "krishilink" ||
    !main.transporterId
  ) {
    return [];
  }

  const { data: orders } = await admin
    .from("transactions")
    .select(
      "id, farmer_id, buyer_id, quantity_kg, status, pool_id, transport_mode, transporter_id, transport_cost_total, logistics_cost_per_kg, listing:listings(crop), pool:fpo_pools(crop, fpo_id)"
    )
    .in("status", ["escrow_paid", "in_transit"])
    .eq("transport_mode", "krishilink")
    .eq("transporter_id", main.transporterId)
    .neq("id", main.id)
    .order("created_at", { ascending: true })
    .limit(50);

  if (!orders || orders.length === 0) return [];

  const userIds = new Set<string>();
  orders.forEach((o) => {
    userIds.add(o.farmer_id);
    userIds.add(o.buyer_id);
    const p = Array.isArray(o.pool) ? o.pool[0] : o.pool;
    if (p?.fpo_id) userIds.add(p.fpo_id);
  });

  const { data: users } = await admin
    .from("profiles")
    .select("id, full_name, district, state, pincode, business_name")
    .in("id", Array.from(userIds));

  const userMap = new Map((users || []).map((u) => [u.id, u]));
  const nearby: NearbyOrder[] = [];

  for (const o of orders) {
    const p = Array.isArray(o.pool) ? o.pool[0] : o.pool;
    const pickupUserId = p?.fpo_id ?? o.farmer_id;
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

    const farmerDist = haversineKm(main.farmerCoords, fCoords);
    const buyerDist = haversineKm(main.buyerCoords, bCoords);
    const sameCorridor = farmerDist < 50 && buyerDist < 50;

    if (!sameCorridor) continue;

    const listingObj = Array.isArray(o.listing) ? o.listing[0] : o.listing;
    nearby.push({
      id: o.id,
      shortId: o.id.slice(0, 8),
      crop: listingObj?.crop ?? p?.crop ?? "Produce",
      quantityKg: Number(o.quantity_kg),
      transportCostTotal: Number(
        o.transport_cost_total ??
          Number(o.logistics_cost_per_kg || 0) * Number(o.quantity_kg)
      ),
      status: o.status,
      farmerName: farmer.full_name,
      buyerName: buyer.business_name || buyer.full_name,
      farmerCoords: fCoords,
      buyerCoords: bCoords,
      sameCorridor,
      distanceFromThisOrderKm: Number(
        Math.max(farmerDist, buyerDist).toFixed(1)
      ),
    });
  }

  nearby.sort((a, b) => a.distanceFromThisOrderKm - b.distanceFromThisOrderKm);
  return nearby.slice(0, 5);
}

/* ========================================================================
   Consolidation builder
   ======================================================================== */

async function buildConsolidation(
  main: {
    id: string;
    crop: string;
    quantityKg: number;
    farmerCoords: GeoPoint;
    buyerCoords: GeoPoint;
    farmerName: string;
    buyerName: string;
    transportCostTotal: number;
  },
  nearby: NearbyOrder[]
): Promise<ConsolidationSuggestion | null> {
  if (
    nearby.length === 0 ||
    !Number.isFinite(main.quantityKg) ||
    main.quantityKg <= 0 ||
    main.quantityKg > VEHICLE_CAPACITY.Truck
  ) {
    return null;
  }

  const candidates = [
    {
      id: main.id,
      crop: main.crop,
      kg: main.quantityKg,
      farmerCoords: main.farmerCoords,
      buyerCoords: main.buyerCoords,
      farmerName: main.farmerName,
      buyerName: main.buyerName,
      transportCostTotal: main.transportCostTotal,
    },
    ...nearby.map((n) => ({
      id: n.id,
      crop: n.crop,
      kg: n.quantityKg,
      farmerCoords: n.farmerCoords,
      buyerCoords: n.buyerCoords,
      farmerName: n.farmerName,
      buyerName: n.buyerName,
      transportCostTotal: n.transportCostTotal,
    })),
  ];

  let sharedQty = main.quantityKg;
  const canShare = [candidates[0]];
  for (const candidate of candidates.slice(1)) {
    if (
      Number.isFinite(candidate.kg) &&
      candidate.kg > 0 &&
      sharedQty + candidate.kg <= VEHICLE_CAPACITY.Truck
    ) {
      canShare.push(candidate);
      sharedQty += candidate.kg;
    }
  }
  if (canShare.length < 2) return null;

  const vehicle =
    sharedQty <= VEHICLE_CAPACITY.Tempo
      ? "Tempo"
      : sharedQty <= VEHICLE_CAPACITY["Mini Truck"]
        ? "Mini Truck"
        : "Truck";
  const capacity = VEHICLE_CAPACITY[vehicle];
  const stops = orderStopsByNearestFeasible(canShare, capacity);
  const combinedRoute = await computeMultiStopRoute(
    stops.map(({ lat, lng }) => ({ lat, lng })),
    vehicle
  );
  const individualDistanceKm = canShare.reduce(
    (sum, order) =>
      sum + haversineKm(order.farmerCoords, order.buyerCoords) * 1.3,
    0
  );
  const originalTotalCost = canShare.reduce(
    (sum, order) => sum + order.transportCostTotal,
    0
  );
  const effectiveRatePerKm =
    individualDistanceKm > 0 ? originalTotalCost / individualDistanceKm : 0;
  const consolidatedTotalCost =
    combinedRoute.distanceKm * effectiveRatePerKm;
  const savingsTotal = originalTotalCost - consolidatedTotalCost;
  const savingsPercent =
    originalTotalCost > 0
      ? Math.round((savingsTotal / originalTotalCost) * 100)
      : 0;
  const savingsPerKg =
    sharedQty > 0 ? Number((savingsTotal / sharedQty).toFixed(2)) : 0;

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
    routeKm: combinedRoute.distanceKm,
    routeDurationMin: combinedRoute.durationMin,
    routeSource: combinedRoute.source,
    combinedPolyline: combinedRoute.polyline,
    stops,
  };
}

function orderStopsByNearestFeasible(
  orders: Array<{
    id: string;
    crop: string;
    kg: number;
    farmerCoords: GeoPoint;
    buyerCoords: GeoPoint;
    farmerName: string;
    buyerName: string;
  }>,
  capacity: number
): ConsolidationSuggestion["stops"] {
  const first = orders[0];
  const stops: ConsolidationSuggestion["stops"] = [
    {
      kind: "pickup",
      name: first.farmerName,
      lat: first.farmerCoords.lat,
      lng: first.farmerCoords.lng,
      orderId: first.id,
      crop: first.crop,
    },
  ];
  const picked = new Set([first.id]);
  const delivered = new Set<string>();
  let current = first.farmerCoords;
  let loadKg = first.kg;

  while (delivered.size < orders.length) {
    const available = [
      ...orders
        .filter(
          (order) => !picked.has(order.id) && loadKg + order.kg <= capacity
        )
        .map((order) => ({
          kind: "pickup" as const,
          order,
          point: order.farmerCoords,
        })),
      ...orders
        .filter(
          (order) => picked.has(order.id) && !delivered.has(order.id)
        )
        .map((order) => ({
          kind: "drop" as const,
          order,
          point: order.buyerCoords,
        })),
    ];
    if (available.length === 0) break;

    available.sort(
      (a, b) =>
        haversineKm(current, a.point) - haversineKm(current, b.point) ||
        a.order.id.localeCompare(b.order.id) ||
        a.kind.localeCompare(b.kind)
    );
    const next = available[0];
    stops.push({
      kind: next.kind,
      name:
        next.kind === "pickup"
          ? next.order.farmerName
          : next.order.buyerName,
      lat: next.point.lat,
      lng: next.point.lng,
      orderId: next.order.id,
      crop: next.order.crop,
    });

    if (next.kind === "pickup") {
      picked.add(next.order.id);
      loadKg += next.order.kg;
    } else {
      delivered.add(next.order.id);
      loadKg -= next.order.kg;
    }
    current = next.point;
  }
  return stops;
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
   Helper for NRE — real distance between two users
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