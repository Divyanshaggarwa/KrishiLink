/* ========================================================================
   KrishiLink AI — Shared Type Contracts
   Every AI response includes `source: "ai" | "mock"` for transparency.
   ======================================================================== */

export type AiSource = "ai" | "mock";
export type QualityGrade = "A" | "B" | "C";

/* -------------------- Fair Price -------------------- */
export interface FairPriceInput {
  crop: string;
  quality: QualityGrade;
  quantityKg: number;
  district: string;
  month: number;
}

export interface FairPriceOutput {
  low: number;
  high: number;
  mid: number;
  confidence: number;
  factors: string[];
  source: AiSource;
}

/* -------------------- Quality -------------------- */
export interface QualityInput {
  imageBase64: string;
  cropName?: string;
}

export interface QualityOutput {
  grade: QualityGrade;
  confidence: number;
  defects: string[];
  /** Crop name the AI actually detected in the photo (null if unsupported). */
  detectedCrop: string | null;
  /** Does the detected crop match the farmer's input crop? */
  cropMatchesInput: boolean;
  /** AI's confidence in the crop detection (0–1). */
  cropMatchConfidence: number;
  source: AiSource;
}

/* -------------------- Demand Forecast -------------------- */
export interface DemandInput {
  crop: string;
  district: string;
  month: number;
}

export interface DemandOutput {
  demandIndex: number;
  trend: "rising" | "stable" | "falling";
  forecast: number[];
  source: AiSource;
}

/* -------------------- Route Optimization -------------------- */
export interface RouteInput {
  farmLat: number;
  farmLng: number;
  buyerLat: number;
  buyerLng: number;
  weightKg: number;
}

export interface RouteOutput {
  distanceKm: number;
  costPerKg: number;
  vehicle: string;
  etaMin: number;
  source: AiSource;
}

/* -------------------- Fairness Evaluation -------------------- */
export interface FairnessInput {
  crop: string;
  quality: QualityGrade;
  quantityKg: number;
  district: string;
  month: number;
  farmerExpectedPrice: number;
  buyerBid: number;
}

export type FairnessVerdict = "fair" | "above_fair" | "below_fair";

export interface FairnessOutput {
  fairLow: number;
  fairHigh: number;
  fairMid: number;
  confidence: number;
  factors: string[];
  farmerVerdict: FairnessVerdict;
  buyerVerdict: FairnessVerdict;
  suggestions: string[];
  source: AiSource;
}

/* ============================================================
   Legacy aliases (for files written before the refactor)
   ============================================================ */
export type FairPriceResult = FairPriceOutput;
export type QualityResult = QualityOutput;
export type FairnessResult = FairnessOutput;