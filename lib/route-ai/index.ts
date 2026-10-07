/* ========================================================================
   KrishiLink Route AI
   - OSRM for real road distances + durations (free, no API key)
   - Clarke-Wright savings algorithm for vehicle routing
   - 2-opt local search for TSP improvement
   - Risk-zone avoidance
   - Falls back to straight-line estimates if OSRM unreachable
   ======================================================================== */

/* -------------------- Types -------------------- */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface DropPoint extends LatLng {
  name: string;
}

export interface PickupPoint extends LatLng {
  name: string;
  kg: number;
  crop: string;
  pricePerKg: number;
  dropIndex: number;
}

export interface RiskZone extends LatLng {}

export interface TruckRoute {
  truckNumber: number;
  color: string;
  dropIndex: number;
  stops: PickupPoint[];
  totalKg: number;
  totalKm: number;
  totalMin: number;
  cost: number;
  riskHits: number;
  detourKm: number;
  polyline: [number, number][];
}

export interface PickupRealization {
  pickupName: string;
  truckNumber: number;
  dropLetter: string;
  grossRevenue: number;
  transportShare: number;
  netRealization: number;
  netIfSolo: number;
}

export interface OptimizeResult {
  trucks: TruckRoute[];
  realizations: PickupRealization[];
  savingsPerKg: number;
  totalKmBefore: number;
  totalKmAfter: number;
  totalCostBefore: number;
  totalCostAfter: number;
  costSaved: number;
  savingsPercent: number;
  riskHits: number;
  usedLiveRoadData: boolean;
}

/* -------------------- Constants -------------------- */
export const COLORS = [
  "#d1495b",
  "#2e86ab",
  "#e8a317",
  "#6a4c93",
  "#2a9d8f",
  "#8d5524",
  "#c2185b",
  "#455a64",
];

/* -------------------- Haversine -------------------- */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dx =
    (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  const dy = (b.lat - a.lat) * 110540;
  return Math.hypot(dx, dy);
}

/* -------------------- OSRM -------------------- */
const OSRM = "https://router.project-osrm.org";
const ll = (p: LatLng) => `${p.lng},${p.lat}`;

export interface Matrix {
  distances: number[][];
  durations: number[][];
}

export async function getDistanceMatrix(pts: LatLng[]): Promise<Matrix> {
  const url = `${OSRM}/table/v1/driving/${pts
    .map(ll)
    .join(";")}?annotations=distance,duration`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("OSRM table failed");
  const j = await res.json();
  if (j.code !== "Ok") throw new Error("OSRM table returned non-OK");
  return { distances: j.distances, durations: j.durations };
}

export function fallbackMatrix(pts: LatLng[]): Matrix {
  const distances = pts.map((a) =>
    pts.map((b) => distanceMeters(a, b) * 1.3)
  );
  const durations = distances.map((r) =>
    r.map((d) => d / 8.33) // avg 30 km/h in m/s
  );
  return { distances, durations };
}

/* -------------------- OSRM Leg (with alternative roads) -------------------- */
export interface LegResult {
  polyline: [number, number][];
  distance: number;
  duration: number;
  riskHits: number;
  fastDistance: number | null;
  fastDuration: number | null;
}

const legCache = new Map<string, OSRMLeg[]>();

interface OSRMLeg {
  polyline: [number, number][];
  distance: number;
  duration: number;
}

export async function getLeg(
  a: LatLng,
  b: LatLng,
  riskZones: RiskZone[],
  preferSafe: boolean,
  live: boolean
): Promise<LegResult> {
  const key = `${ll(a)};${ll(b)}`;

  if (live) {
    try {
      if (!legCache.has(key)) {
        const url = `${OSRM}/route/v1/driving/${key}?overview=full&geometries=geojson&alternatives=true`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error("OSRM route failed");
        const j = await res.json();
        if (j.code !== "Ok" || !j.routes?.length) throw new Error("no route");

        const legs: OSRMLeg[] = j.routes.map(
          (r: {
            geometry: { coordinates: [number, number][] };
            distance: number;
            duration: number;
          }) => ({
            polyline: r.geometry.coordinates.map(
              ([lng, lat]) => [lat, lng] as [number, number]
            ),
            distance: r.distance,
            duration: r.duration,
          })
        );
        legCache.set(key, legs);
      }

      const alts = legCache.get(key)!.map((r) => ({
        ...r,
        hits: countZonesHit(r.polyline, riskZones),
      }));

      let best = alts[0];
      if (preferSafe) {
        best = alts.reduce((m, r) =>
          r.hits * 1e7 + r.distance < m.hits * 1e7 + m.distance ? r : m
        );
      }

      return {
        polyline: best.polyline,
        distance: best.distance,
        duration: best.duration,
        riskHits: best.hits,
        fastDistance: alts[0].distance,
        fastDuration: alts[0].duration,
      };
    } catch {
      /* fall through */
    }
  }

  // Fallback: straight line
  const d = distanceMeters(a, b) * 1.3;
  return {
    polyline: [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ],
    distance: d,
    duration: d / 8.33,
    riskHits: 0,
    fastDistance: null,
    fastDuration: null,
  };
}

function countZonesHit(
  polyline: [number, number][],
  zones: RiskZone[]
): number {
  return zones.filter((z) =>
    polyline.some(
      (p) => distanceMeters({ lat: p[0], lng: p[1] }, z) < 150
    )
  ).length;
}

/* -------------------- Clarke-Wright Savings -------------------- */
interface RouteNode {
  nodes: number[];
  load: number;
}

export function savingsAlgorithm(
  D: number[][],
  loads: number[],
  capacity: number
): RouteNode[] {
  const n = D.length;
  const rt: (RouteNode | null)[] = [null];
  for (let i = 1; i < n; i++) {
    rt[i] = { nodes: [i], load: loads[i] };
  }

  const pairs: [number, number, number][] = [];
  for (let i = 1; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([D[0][i] + D[0][j] - D[i][j], i, j]);
    }
  }
  pairs.sort((a, b) => b[0] - a[0]);

  for (const [savings, i, j] of pairs) {
    if (savings <= 0) break;
    const a = rt[i];
    const b = rt[j];
    if (!a || !b || a === b) continue;
    if (a.load + b.load > capacity) continue;

    if (a.nodes[a.nodes.length - 1] !== i) {
      if (a.nodes[0] === i) a.nodes.reverse();
      else continue;
    }
    if (b.nodes[0] !== j) {
      if (b.nodes[b.nodes.length - 1] === j) b.nodes.reverse();
      else continue;
    }

    const merged: RouteNode = {
      nodes: a.nodes.concat(b.nodes),
      load: a.load + b.load,
    };
    merged.nodes.forEach((x) => (rt[x] = merged));
  }

  return [...new Set(rt.slice(1))] as RouteNode[];
}

/* -------------------- 2-opt -------------------- */
function routeLength(nodes: number[], D: number[][]): number {
  let total = D[0][nodes[0]];
  for (let k = 0; k < nodes.length - 1; k++) {
    total += D[nodes[k]][nodes[k + 1]];
  }
  return total + D[nodes[nodes.length - 1]][0];
}

export function twoOpt(nodes: number[], D: number[][]): number[] {
  let best = nodes.slice();
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = best
          .slice(0, i)
          .concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        if (routeLength(candidate, D) < routeLength(best, D) - 1) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

/* -------------------- Main Optimizer -------------------- */
export async function optimizeRoutes(input: {
  drops: DropPoint[];
  pickups: PickupPoint[];
  riskZones: RiskZone[];
  truckCapacityKg: number;
  costPerKm: number;
  preferSafe: boolean;
}): Promise<OptimizeResult> {
  const { drops, pickups, riskZones, truckCapacityKg, costPerKm, preferSafe } =
    input;

  const trucks: TruckRoute[] = [];
  const realizations: PickupRealization[] = [];
  let live = true;
  let truckNumber = 0;
  let kmAfter = 0;
  let kmBefore = 0;
  let riskHitsTotal = 0;
  const allPoints: LatLng[] = [];

  for (let di = 0; di < drops.length; di++) {
    const group = pickups.filter((p) => p.dropIndex === di);
    if (group.length === 0) continue;

    const pts: LatLng[] = [drops[di], ...group];
    const loads = [0, ...group.map((g) => g.kg)];

    let D: number[][];
    try {
      if (!live) throw new Error("offline");
      const matrix = await getDistanceMatrix(pts);
      D = matrix.distances;
    } catch {
      live = false;
      D = fallbackMatrix(pts).distances;
    }

    kmBefore +=
      group.reduce((sum, _, idx) => sum + 2 * D[0][idx + 1], 0) / 1000;

    const routes = savingsAlgorithm(D, loads, truckCapacityKg).map((r) => ({
      load: r.load,
      nodes: twoOpt(r.nodes, D),
    }));

    for (const r of routes) {
      const color = COLORS[truckNumber % COLORS.length];
      truckNumber++;

      const seq: LatLng[] = [
        pts[0],
        ...r.nodes.map((i) => pts[i]),
        pts[0],
      ];

      let km = 0;
      let mins = 0;
      let hits = 0;
      let detour = 0;
      const combinedPolyline: [number, number][] = [];

      for (let k = 0; k < seq.length - 1; k++) {
        const leg = await getLeg(
          seq[k],
          seq[k + 1],
          riskZones,
          preferSafe,
          live
        );
        combinedPolyline.push(...leg.polyline);
        km += leg.distance / 1000;
        mins += leg.duration / 60;
        hits += leg.riskHits;
        if (leg.fastDistance !== null) {
          detour += (leg.distance - leg.fastDistance) / 1000;
        }
      }

      kmAfter += km;
      riskHitsTotal += hits;

      const cost = km * costPerKm;

      const stopList = r.nodes.map((idx) => group[idx - 1]);
      for (let sIdx = 0; sIdx < r.nodes.length; sIdx++) {
        const idx = r.nodes[sIdx];
        const f = group[idx - 1];
        const gross = f.kg * f.pricePerKg;
        const share = (cost * f.kg) / r.load;
        const solo = ((2 * D[0][idx]) / 1000) * costPerKm;

        realizations.push({
          pickupName: f.name,
          truckNumber,
          dropLetter: String.fromCharCode(65 + di),
          grossRevenue: gross,
          transportShare: share,
          netRealization: gross - share,
          netIfSolo: gross - solo,
        });
      }

      trucks.push({
        truckNumber,
        color,
        dropIndex: di,
        stops: stopList,
        totalKg: r.load,
        totalKm: km,
        totalMin: mins,
        cost,
        riskHits: hits,
        detourKm: detour,
        polyline: combinedPolyline,
      });
    }

    allPoints.push(...pts);
  }

  const costBefore = kmBefore * costPerKm;
  const costAfter = kmAfter * costPerKm;
  const costSaved = costBefore - costAfter;
  const savingsPercent =
    costBefore > 0 ? Math.round((costSaved / costBefore) * 100) : 0;

  const totalKg = realizations.reduce(
    (s, r) => s + (r.netIfSolo - r.netRealization > 0 ? 1 : 0),
    0
  );
  const totalSavedOnKg = realizations.reduce(
    (s, r) => s + (r.netRealization - r.netIfSolo),
    0
  );
  const totalNetRealization = realizations.reduce(
    (s, r) => s + r.netRealization,
    0
  );
  const savingsPerKg =
    totalNetRealization > 0
      ? Number((totalSavedOnKg / Math.max(totalKg, 1)).toFixed(2))
      : 0;

  return {
    trucks,
    realizations,
    savingsPerKg,
    totalKmBefore: kmBefore,
    totalKmAfter: kmAfter,
    totalCostBefore: costBefore,
    totalCostAfter: costAfter,
    costSaved,
    savingsPercent,
    riskHits: riskHitsTotal,
    usedLiveRoadData: live,
  };
}

/* -------------------- Reset / demo data -------------------- */
export const BOUNDS_DEHRADUN = {
  south: 30.22,
  north: 30.42,
  west: 77.92,
  east: 78.14,
};

export const PRESET_PLACES: DropPoint[] = [
  { name: "Clock Tower (Ghanta Ghar)", lat: 30.3243, lng: 78.0415 },
  { name: "Railway Station", lat: 30.3165, lng: 78.0322 },
  { name: "ISBT Dehradun", lat: 30.2893, lng: 77.999 },
  { name: "Ballupur Chowk", lat: 30.333, lng: 78.001 },
  { name: "Rajpur Road", lat: 30.354, lng: 78.06 },
];

export const CROPS_ROUTE = [
  { name: "Tomato", pricePerKg: 22 },
  { name: "Potato", pricePerKg: 18 },
  { name: "Onion", pricePerKg: 24 },
  { name: "Peas", pricePerKg: 40 },
  { name: "Cauliflower", pricePerKg: 20 },
  { name: "Beans", pricePerKg: 35 },
];

export function createDefaultState(): {
  drops: DropPoint[];
  pickups: PickupPoint[];
  riskZones: RiskZone[];
} {
  const drops: DropPoint[] = [
    { ...PRESET_PLACES[0] },
    { ...PRESET_PLACES[2] },
  ];

  const seed: [string, number, number, number, string, number, number][] = [
    ["Raipur", 30.299, 78.095, 300, "Tomato", 22, 0],
    ["Premnagar", 30.334, 77.97, 250, "Cauliflower", 20, 1],
    ["Selaqui", 30.356, 77.93, 200, "Onion", 24, 1],
    ["Rajpur", 30.372, 78.078, 350, "Peas", 40, 0],
    ["Clement Town", 30.273, 78.0, 450, "Potato", 18, 1],
    ["Harrawala", 30.278, 78.099, 300, "Beans", 35, 0],
  ];

  const pickups: PickupPoint[] = seed.map(
    ([name, lat, lng, kg, crop, pricePerKg, dropIndex]) => ({
      name,
      lat,
      lng,
      kg,
      crop,
      pricePerKg,
      dropIndex,
    })
  );

  return { drops, pickups, riskZones: [] };
}