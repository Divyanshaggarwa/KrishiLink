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
} from "./types";
import {
  mockFairPrice,
  mockQuality,
  mockDemand,
  mockRoute,
  mockFairness,
} from "./mock";
import {
  callRoboflowQuality,
  isRoboflowSupported,
  canonicalCrop,
} from "./roboflow";
import { fairPrice as lookupMarketFairPrice } from "@/lib/fairPrice/engine";

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || "";
const TIMEOUT_MS = 6000;

async function callAI<T>(path: string, body: unknown): Promise<T | null> {
  if (!AI_URL) return null;

  try {
    const res = await fetch(`${AI_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    return { ...data, source: "ai" } as T;
  } catch {
    return null;
  }
}

/* -------------------- Fair Price -------------------- */
export async function predictFairPrice(
  input: FairPriceInput
): Promise<FairPriceOutput> {
  const ai = await callAI<FairPriceOutput>("/predict/price", {
    crop: input.crop,
    quality: input.quality,
    quantity_kg: input.quantityKg,
    district: input.district,
    month: input.month,
  });
  return ai ?? mockFairPrice(input);
}

/* -------------------- Quality (with crop verification) -------------------- */
export async function predictQuality(
  imageBase64: string,
  crop?: string,
  imageUrl?: string
): Promise<QualityOutput> {
  const inputCrop = (crop ?? "").toLowerCase().trim();

  /* ---- 1. Try Roboflow (only for supported crops) ---- */
  if (crop && imageUrl && isRoboflowSupported(crop)) {
    const roboflow = await callRoboflowQuality(imageUrl);

    // ✅ Accept grade even if crop wasn't returned
    if (roboflow?.grade) {
      const hasCrop = !!roboflow.detectedCrop;
      const cropMatchesInput = hasCrop
        ? cropsMatch(roboflow.detectedCrop!, inputCrop)
        : true; // can't verify → don't punish the farmer

      return {
        grade: roboflow.grade,
        confidence: roboflow.confidence,
        defects: [],
        detectedCrop: roboflow.detectedCrop,
        cropMatchesInput,
        cropMatchConfidence: hasCrop ? roboflow.confidence : 0,
        cropVerified: hasCrop,
        source: "ai",
      };
    }
  }

  /* ---- 2. Try external FastAPI service ---- */
  const ai = await callAI<Partial<QualityOutput>>("/predict/quality", {
    image_base64: imageBase64,
    crop: inputCrop,
  });

  if (ai?.grade) {
    const hasCrop = !!ai.detectedCrop;
    const cropMatchesInput = hasCrop
      ? cropsMatch(ai.detectedCrop!, inputCrop)
      : true;
    return {
      grade: ai.grade,
      confidence: ai.confidence ?? 0.7,
      defects: ai.defects ?? [],
      detectedCrop: ai.detectedCrop ?? null,
      cropMatchesInput,
      cropMatchConfidence: ai.cropMatchConfidence ?? (hasCrop ? 0.7 : 0),
      cropVerified: hasCrop,
      source: "ai",
    };
  }

  /* ---- 3. Unsupported crop: return mock with manual-entry fallback ---- */
  // Rather than throwing, hand back a low-confidence mock so the UI
  // can still let the farmer pick a grade manually.
  if (inputCrop && !isRoboflowSupported(inputCrop)) {
    return {
      ...mockQuality({ imageBase64 }),
      detectedCrop: inputCrop,
      cropMatchesInput: true,
      cropVerified: false,
    };
  }

  throw new Error(
    "The AI could not identify the crop in the photo. A grade cannot be selected until the crop is verified."
  );
}

function cropsMatch(detectedCrop: string, inputCrop: string): boolean {
  const a = canonicalCrop(detectedCrop) ?? detectedCrop.toLowerCase();
  const b = canonicalCrop(inputCrop) ?? inputCrop.toLowerCase();
  return a === b;
}

/* -------------------- Demand -------------------- */
export async function predictDemand(
  input: DemandInput
): Promise<DemandOutput> {
  const ai = await callAI<DemandOutput>("/predict/demand", {
    crop: input.crop,
    district: input.district,
    month: input.month,
  });
  return ai ?? mockDemand(input);
}

/* -------------------- Route -------------------- */
export async function optimizeRoute(input: RouteInput): Promise<RouteOutput> {
  const ai = await callAI<unknown>("/optimize/route", {
    farm_lat: input.farmLat,
    farm_lng: input.farmLng,
    buyer_lat: input.buyerLat,
    buyer_lng: input.buyerLng,
    weight_kg: input.weightKg,
  });
  if (
    isRecord(ai) &&
    isFiniteNumber(ai.distanceKm) &&
    isFiniteNumber(ai.costPerKg) &&
    typeof ai.vehicle === "string" &&
    isFiniteNumber(ai.etaMin)
  ) {
    return {
      distanceKm: ai.distanceKm,
      costPerKg: ai.costPerKg,
      vehicle: ai.vehicle,
      etaMin: ai.etaMin,
      source: "ai",
    };
  }
  return mockRoute(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/* -------------------- Fairness -------------------- */
export async function evaluateFairness(
  input: FairnessInput
): Promise<FairnessOutput> {
  const marketPrice = lookupMarketFairPrice(input.crop, input.quality);
  if (
    marketPrice &&
    input.district.trim().toLowerCase() === "agra" &&
    !marketPrice.flags.includes("stale_data")
  ) {
    const verdictFor = (price: number) => {
      if (price < marketPrice.low) return "below_fair" as const;
      if (price > marketPrice.high) return "above_fair" as const;
      return "fair" as const;
    };
    const farmerVerdict = verdictFor(input.farmerExpectedPrice);
    const buyerVerdict = verdictFor(input.buyerBid);
    const confidence = {
      low: 0.5,
      medium: 0.75,
      high: 0.9,
    }[marketPrice.confidence];
    const freshness = marketPrice.flags.includes("stale_data")
      ? "The latest observation is more than 7 days old."
      : "The latest observation is within 7 days.";

    return {
      fairLow: marketPrice.low,
      fairHigh: marketPrice.high,
      fairMid: marketPrice.fairPrice,
      confidence,
      factors: [
        `Historical Agra market sample for ${input.crop}, Grade ${input.quality}.`,
        `${marketPrice.dataPoints} price records; latest observation ${marketPrice.lastDataDate}.`,
        `${freshness} Confidence: ${marketPrice.confidence}.`,
      ],
      farmerVerdict,
      buyerVerdict,
      suggestions: [
        `Keep the negotiated price within ₹${marketPrice.low.toFixed(2)}–₹${marketPrice.high.toFixed(2)}/kg.`,
        ...(marketPrice.flags.includes("estimated_from_grade_A")
          ? ["This grade's reference is estimated from Grade A prices."]
          : []),
      ],
      source: "market-data",
    };
  }

  const fallback = mockFairness({
    ...input,
    buyerBid: input.farmerExpectedPrice,
  });
  const ai = await callAI<FairnessOutput>("/predict/fairness", {
    crop: input.crop,
    quality: input.quality,
    quantity_kg: input.quantityKg,
    district: input.district,
    month: input.month,
    farmer_expected_price: input.farmerExpectedPrice,
    buyer_bid: input.farmerExpectedPrice,
  });
  if (
    !ai ||
    !Number.isFinite(ai.fairLow) ||
    !Number.isFinite(ai.fairHigh) ||
    ai.fairLow <= 0 ||
    ai.fairLow > ai.fairHigh
  ) {
    return mockFairness(input);
  }

  const aiMid = (ai.fairLow + ai.fairHigh) / 2;
  const aiWidth = ai.fairHigh - ai.fairLow;
  if (
    aiWidth > fallback.fairMid * 0.5 ||
    aiMid < fallback.fairMid * 0.7 ||
    aiMid > fallback.fairMid * 1.3
  ) {
    return mockFairness(input);
  }

  const verdictFor = (price: number) => {
    if (price < ai.fairLow) return "below_fair" as const;
    if (price > ai.fairHigh) return "above_fair" as const;
    return "fair" as const;
  };
  const farmerVerdict = verdictFor(input.farmerExpectedPrice);
  const buyerVerdict = verdictFor(input.buyerBid);

  return {
    ...ai,
    fairMid: aiMid,
    farmerVerdict,
    buyerVerdict,
    factors: [
      ...ai.factors,
      "The fair range stays fixed while the buyer adjusts their offer.",
    ],
    suggestions: [
      `Keep the negotiated price within ₹${ai.fairLow.toFixed(2)}–₹${ai.fairHigh.toFixed(2)}/kg.`,
    ],
  };
}