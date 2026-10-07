import type {
  FairPriceInput,
  FairPriceOutput,
  QualityOutput,
  DemandInput,
  DemandOutput,
  RouteInput,
  RouteOutput,
  FairnessInput,
  FairnessOutput,
  FairnessVerdict,
  QualityGrade,
} from "./types";

/* Crop base prices (₹/kg) — realistic Nashik APMC ranges */
const CROP_BASE: Record<string, number> = {
  tomato: 24, onion: 18, potato: 22, wheat: 27, rice: 32, maize: 21,
  chilli: 55, brinjal: 28, okra: 35, cauliflower: 30, cabbage: 18,
  carrot: 32, spinach: 22, banana: 30, mango: 65,
};

const QUALITY_MULT: Record<QualityGrade, number> = { A: 1.0, B: 0.85, C: 0.7 };

/* Crops we can plausibly "detect" in the mock classifier */
const DETECTABLE_CROPS = [
  "onion", "potato", "tomato", "wheat", "rice",
  "maize", "chilli", "brinjal", "okra", "cauliflower",
];

/* -------------------- Fair Price -------------------- */
export function mockFairPrice(input: FairPriceInput): FairPriceOutput {
  const base = CROP_BASE[input.crop.toLowerCase().trim()] ?? 25;
  const qualityMult = QUALITY_MULT[input.quality];
  const seasonMult = seasonalityMult(input.month);
  const mid = base * qualityMult * seasonMult;

  return {
    low: Number((mid - 1.5).toFixed(2)),
    high: Number((mid + 1.5).toFixed(2)),
    mid: Number(mid.toFixed(2)),
    confidence: 0.72,
    factors: [
      `Base price for ${input.crop}: ₹${base}/kg`,
      `Quality grade ${input.quality} (×${qualityMult})`,
      `Season adjustment (×${seasonMult.toFixed(2)})`,
      `District: ${input.district || "—"}`,
    ],
    source: "mock",
  };
}

function seasonalityMult(month: number): number {
  /* Harvest season = lower prices */
  const harvestMonths: Record<number, number> = {
    1: 0.95, 2: 0.92, 3: 0.95, 4: 1.0, 5: 1.02, 6: 1.05,
    7: 1.08, 8: 1.05, 9: 1.0, 10: 0.98, 11: 0.95, 12: 0.92,
  };
  return harvestMonths[month] ?? 1.0;
}

/* -------------------- Quality (with crop verification) -------------------- */
export function mockQuality(input: {
  imageBase64: string;
  cropName?: string;
}): QualityOutput {
  /* Hash the image to produce a stable grade */
  let hash = 0;
  const src = input.imageBase64;
  for (let i = 0; i < Math.min(src.length, 5000); i += 13) {
    hash = (hash * 31 + src.charCodeAt(i)) % 997;
  }

  const grade: QualityGrade = hash > 665 ? "A" : hash > 332 ? "B" : "C";
  const defects =
    grade === "A"
      ? []
      : grade === "B"
        ? ["Minor surface blemish detected"]
        : ["Visible discoloration", "Surface damage"];

  const confidence = Number((0.68 + (hash % 27) / 100).toFixed(2));

  /* -------------------- Crop verification -------------------- */
  const inputCrop = (input.cropName ?? "").toLowerCase().trim();

  let detectedCrop: string | null = null;
  if (inputCrop) {
    // 90% match the input crop, 10% mismatch (simulates a wrong photo upload)
    if (hash % 10 !== 0) {
      detectedCrop = inputCrop;
    } else {
      const others = DETECTABLE_CROPS.filter((c) => c !== inputCrop);
      detectedCrop = others[hash % others.length] ?? "onion";
    }
  }

  const cropMatchesInput =
    !inputCrop || !detectedCrop
      ? true
      : detectedCrop === inputCrop;

  const cropMatchConfidence = Number(
    (0.7 + (hash % 28) / 100).toFixed(2)
  );

  return {
    grade,
    confidence,
    defects,
    detectedCrop,
    cropMatchesInput,
    cropMatchConfidence,
    cropVerified: detectedCrop !== null,   // ← ✅ ADDED
    source: "mock",
  };
}

/* -------------------- Demand Forecast -------------------- */
export function mockDemand(input: DemandInput): DemandOutput {
  const base = 0.6 + ((input.month + input.crop.length) % 4) * 0.1;
  const trend: DemandOutput["trend"] =
    input.month >= 8 && input.month <= 11
      ? "rising"
      : input.month >= 3 && input.month <= 6
        ? "falling"
        : "stable";

  return {
    demandIndex: Number(base.toFixed(2)),
    trend,
    forecast: Array.from({ length: 6 }, (_, i) =>
      Number((base + i * 0.03).toFixed(2))
    ),
    source: "mock",
  };
}

/* -------------------- Route -------------------- */
export function mockRoute(input: RouteInput): RouteOutput {
  const R = 6371;
  const dLat = ((input.buyerLat - input.farmLat) * Math.PI) / 180;
  const dLng = ((input.buyerLng - input.farmLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((input.farmLat * Math.PI) / 180) *
      Math.cos((input.buyerLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const distanceKm = 2 * R * Math.asin(Math.sqrt(a));

  let vehicle = "Tempo";
  let ratePerKm = 18;
  if (input.weightKg >= 500 && input.weightKg < 2000) {
    vehicle = "Mini Truck";
    ratePerKm = 28;
  } else if (input.weightKg >= 2000) {
    vehicle = "Truck";
    ratePerKm = 42;
  }

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    costPerKg: Number(
      ((distanceKm * ratePerKm) / Math.max(input.weightKg, 1)).toFixed(2)
    ),
    vehicle,
    etaMin: Math.round((distanceKm / 35) * 60),
    source: "mock",
  };
}

/* -------------------- Fairness -------------------- */
export function mockFairness(input: FairnessInput): FairnessOutput {
  const cropBase = CROP_BASE[input.crop.toLowerCase()] ?? 25;
  const anchor = (input.farmerExpectedPrice + cropBase) / 2;
  const mid = anchor * QUALITY_MULT[input.quality];
  const margin = Math.max(1.5, mid * 0.12);
  const low = Number(Math.max(0, mid - margin).toFixed(2));
  const high = Number((mid + margin).toFixed(2));

  const farmerVerdict = verdict(input.farmerExpectedPrice, low, high);
  const buyerVerdict = verdict(input.buyerBid, low, high);

  const suggestions: string[] = [];
  if (farmerVerdict === "above_fair")
    suggestions.push(
      `Farmer's ask is ₹${(input.farmerExpectedPrice - high).toFixed(2)}/kg above the fair band`
    );
  if (farmerVerdict === "below_fair")
    suggestions.push(
      `Farmer could ask ₹${(low - input.farmerExpectedPrice).toFixed(2)}/kg higher`
    );
  if (buyerVerdict === "above_fair")
    suggestions.push(
      `Buyer's bid is above the fair band — counter-offer likely to work`
    );
  if (buyerVerdict === "below_fair")
    suggestions.push(
      `Buyer needs to raise by ₹${(low - input.buyerBid).toFixed(2)}/kg`
    );

  return {
    fairLow: low,
    fairHigh: high,
    fairMid: Number(mid.toFixed(2)),
    confidence: 0.74,
    factors: [
      `Crop reference: ₹${cropBase}/kg`,
      `Farmer asks ₹${input.farmerExpectedPrice}/kg`,
      "The fair range stays fixed while the buyer adjusts their offer.",
    ],
    farmerVerdict,
    buyerVerdict,
    suggestions,
    source: "mock",
  };
}

function verdict(v: number, low: number, high: number): FairnessVerdict {
  if (v < low) return "below_fair";
  if (v > high) return "above_fair";
  return "fair";
}