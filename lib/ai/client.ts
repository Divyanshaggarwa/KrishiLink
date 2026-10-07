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
import { callRoboflowQuality, isRoboflowSupported } from "./roboflow";

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

/* -------------------- Quality (Roboflow → AI → Mock) --------------------
   Returns grade + detectedCrop + cropMatchesInput.
   Always compares against `input.crop` if provided.
   -------------------------------------------------------------------- */
export async function predictQuality(
  imageBase64: string,
  crop?: string,
  imageUrl?: string
): Promise<QualityOutput> {
  const inputCrop = (crop ?? "").toLowerCase().trim();

  /* ---- 1. Try Roboflow (only for supported crops) ---- */
  if (crop && imageUrl && isRoboflowSupported(crop)) {
    const roboflow = await callRoboflowQuality(imageUrl);
    if (roboflow) {
      // FIXED: was `?? inputCrop || null` — replaced with `||` chain
      const detectedCrop: string | null =
        roboflow.detectedCrop || inputCrop || null;

      const cropMatchesInput =
        !inputCrop || !detectedCrop
          ? true
          : detectedCrop.toLowerCase() === inputCrop;

      return {
        grade: roboflow.grade,
        confidence: roboflow.confidence,
        defects: [],
        detectedCrop,
        cropMatchesInput,
        cropMatchConfidence: roboflow.confidence,
        source: "ai",
      };
    }
  }

  /* ---- 2. Try external FastAPI service ---- */
  const ai = await callAI<Partial<QualityOutput>>("/predict/quality", {
    image_base64: imageBase64,
    crop: inputCrop,
  });

  if (ai && ai.grade) {
    // FIXED: was `ai.detectedCrop ?? inputCrop || null` — replaced with `||` chain
    const detectedCrop: string | null =
      ai.detectedCrop || inputCrop || null;

    const cropMatchesInput =
      ai.cropMatchesInput ??
      (!inputCrop || !detectedCrop
        ? true
        : detectedCrop.toLowerCase() === inputCrop);

    return {
      grade: ai.grade,
      confidence: ai.confidence ?? 0.7,
      defects: ai.defects ?? [],
      detectedCrop,
      cropMatchesInput,
      cropMatchConfidence: ai.cropMatchConfidence ?? 0.7,
      source: "ai",
    };
  }

  /* ---- 3. Fallback to mock ---- */
  return mockQuality({ imageBase64, cropName: inputCrop });
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
  const ai = await callAI<RouteOutput>("/optimize/route", {
    farm_lat: input.farmLat,
    farm_lng: input.farmLng,
    buyer_lat: input.buyerLat,
    buyer_lng: input.buyerLng,
    weight_kg: input.weightKg,
  });
  return ai ?? mockRoute(input);
}

/* -------------------- Fairness -------------------- */
export async function evaluateFairness(
  input: FairnessInput
): Promise<FairnessOutput> {
  const ai = await callAI<FairnessOutput>("/predict/fairness", {
    crop: input.crop,
    quality: input.quality,
    quantity_kg: input.quantityKg,
    district: input.district,
    month: input.month,
    farmer_expected_price: input.farmerExpectedPrice,
    buyer_bid: input.buyerBid,
  });
  return ai ?? mockFairness(input);
}