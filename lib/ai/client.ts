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

export async function predictFairPrice(input: FairPriceInput): Promise<FairPriceOutput> {
  const ai = await callAI<FairPriceOutput>("/predict/price", {
    crop: input.crop,
    quality: input.quality,
    quantity_kg: input.quantityKg,
    district: input.district,
    month: input.month,
  });
  return ai ?? mockFairPrice(input);
}

export async function predictQuality(imageBase64: string): Promise<QualityOutput> {
  const ai = await callAI<QualityOutput>("/predict/quality", { image_base64: imageBase64 });
  return ai ?? mockQuality({ imageBase64 });
}

export async function predictDemand(input: DemandInput): Promise<DemandOutput> {
  const ai = await callAI<DemandOutput>("/predict/demand", {
    crop: input.crop,
    district: input.district,
    month: input.month,
  });
  return ai ?? mockDemand(input);
}

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

export async function evaluateFairness(input: FairnessInput): Promise<FairnessOutput> {
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