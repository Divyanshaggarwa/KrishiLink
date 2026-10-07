/* ========================================================================
   KrishiLink — Net Realization Engine (v2)

   Two calculations:
   1. FARMER net realization — what farmer receives per kg
        NET = price − farmer_fee − gateway_fee − handling − quality_deduction
        (transport is NO LONGER subtracted — buyer bears it)

   2. BUYER landed cost — what buyer actually pays per kg
        LANDED = price + buyer_fee + gateway_fee + transport_cost
        (used on the buyer dashboard to find the best deal)
   ======================================================================== */

export type QualityGrade = "A" | "B" | "C";

export const DEFAULT_TRANSACTION_COST_PER_KG = 0.3; // legacy fallback

/* ================================================================
   FEE CONFIG
   ================================================================ */

export interface FeeConfig {
  farmer_fee_pct: number;         // % deducted from farmer's proceeds
  buyer_fee_pct: number;          // % added to buyer's payable
  transporter_fee_pct: number;    // % of transport cost (platform's cut)
  handling_per_kg: number;        // ₹/kg handling (farmer side)
  gateway_pct: number;
  quality_deduction_A: number;
  quality_deduction_B: number;
  quality_deduction_C: number;
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  farmer_fee_pct: 2.0,
  buyer_fee_pct: 1.0,
  transporter_fee_pct: 5.0,
  handling_per_kg: 0.2,
  gateway_pct: 1.8,
  quality_deduction_A: 0,
  quality_deduction_B: 0.5,
  quality_deduction_C: 1.5,
};

/* ================================================================
   TRANSPORT RATES
   ================================================================ */

export interface TransportRate {
  vehicle: string;
  rate_per_km: number;
  min_weight_kg: number;
  max_weight_kg: number;
}

export const DEFAULT_TRANSPORT_RATES: TransportRate[] = [
  { vehicle: "Tempo", rate_per_km: 18, min_weight_kg: 0, max_weight_kg: 500 },
  {
    vehicle: "Mini Truck",
    rate_per_km: 28,
    min_weight_kg: 500,
    max_weight_kg: 2000,
  },
  {
    vehicle: "Truck",
    rate_per_km: 42,
    min_weight_kg: 2000,
    max_weight_kg: 99999,
  },
];

export function pickVehicle(
  quantityKg: number,
  rates: TransportRate[] = DEFAULT_TRANSPORT_RATES
): TransportRate {
  const match = rates.find(
    (r) => quantityKg >= r.min_weight_kg && quantityKg <= r.max_weight_kg
  );
  return match ?? rates[rates.length - 1];
}

/* ================================================================
   QUALITY DEDUCTION
   ================================================================ */

export function getQualityDeduction(
  grade: QualityGrade,
  fees: FeeConfig = DEFAULT_FEE_CONFIG
): number {
  if (grade === "A") return fees.quality_deduction_A;
  if (grade === "B") return fees.quality_deduction_B;
  return fees.quality_deduction_C;
}

/* ================================================================
   FARMER SIDE — net realization (NO transport deduction)
   ================================================================ */

export interface OfferInput {
  pricePerKg: number;
  quantityKg: number;
  distanceKm?: number; // kept optional for backward compat — not used in math
}

export interface NetRealizationBreakdown {
  pricePerKg: number;
  farmerFeePerKg: number;
  gatewayFeePerKg: number;
  handlingPerKg: number;
  qualityDeduction: number;
  netRealizationPerKg: number;
  grossAmount: number;
  netAmount: number;
  totalDeductionsAmount: number;
  distanceKm: number;
  // Backward-compat fields (kept so old pages don't crash):
  transportCostPerKg: number;      // always 0 now
  transactionCostPerKg: number;    // legacy — kept as 0
}

export function calculateNetRealization(
  offer: OfferInput,
  grade: QualityGrade,
  fees: FeeConfig = DEFAULT_FEE_CONFIG
): NetRealizationBreakdown {
  const farmerFeePerKg = (fees.farmer_fee_pct / 100) * offer.pricePerKg;
  const gatewayFeePerKg = (fees.gateway_pct / 100) * offer.pricePerKg;
  const handlingPerKg = fees.handling_per_kg;
  const qualityDeduction = getQualityDeduction(grade, fees);

  const netPerKg =
    offer.pricePerKg -
    farmerFeePerKg -
    gatewayFeePerKg -
    handlingPerKg -
    qualityDeduction;

  const grossAmount = offer.pricePerKg * offer.quantityKg;
  const netAmount = netPerKg * offer.quantityKg;
  const totalDeductionsPerKg =
    farmerFeePerKg + gatewayFeePerKg + handlingPerKg + qualityDeduction;

  return {
    pricePerKg: round2(offer.pricePerKg),
    farmerFeePerKg: round2(farmerFeePerKg),
    gatewayFeePerKg: round2(gatewayFeePerKg),
    handlingPerKg: round2(handlingPerKg),
    qualityDeduction: round2(qualityDeduction),
    netRealizationPerKg: round2(netPerKg),
    grossAmount: round2(grossAmount),
    netAmount: round2(netAmount),
    totalDeductionsAmount: round2(totalDeductionsPerKg * offer.quantityKg),
    distanceKm: round2(offer.distanceKm ?? 0),
    // Backward-compat
    transportCostPerKg: 0,
    transactionCostPerKg: 0,
  };
}

/* ================================================================
   BUYER SIDE — landed cost (INCLUDES transport)
   ================================================================ */

export interface BuyerLandedInput {
  pricePerKg: number;
  quantityKg: number;
  distanceKm: number;
}

export interface BuyerLandedBreakdown {
  pricePerKg: number;
  buyerFeePerKg: number;
  gatewayFeePerKg: number;
  transportPerKg: number;
  landedPerKg: number;
  grossAmount: number;
  totalPayable: number;
  vehicle: string;
  distanceKm: number;
}

export function calculateBuyerLandedCost(
  input: BuyerLandedInput,
  fees: FeeConfig = DEFAULT_FEE_CONFIG,
  transportRates: TransportRate[] = DEFAULT_TRANSPORT_RATES
): BuyerLandedBreakdown {
  const buyerFeePerKg = (fees.buyer_fee_pct / 100) * input.pricePerKg;
  const gatewayFeePerKg = (fees.gateway_pct / 100) * input.pricePerKg;

  const vehicle = pickVehicle(input.quantityKg, transportRates);
  const transportTotal = input.distanceKm * vehicle.rate_per_km;
  const transportPerKg =
    input.quantityKg > 0 ? transportTotal / input.quantityKg : 0;

  const landedPerKg =
    input.pricePerKg + buyerFeePerKg + gatewayFeePerKg + transportPerKg;

  const grossAmount = input.pricePerKg * input.quantityKg;
  const totalPayable = landedPerKg * input.quantityKg;

  return {
    pricePerKg: round2(input.pricePerKg),
    buyerFeePerKg: round2(buyerFeePerKg),
    gatewayFeePerKg: round2(gatewayFeePerKg),
    transportPerKg: round2(transportPerKg),
    landedPerKg: round2(landedPerKg),
    grossAmount: round2(grossAmount),
    totalPayable: round2(totalPayable),
    vehicle: vehicle.vehicle,
    distanceKm: round2(input.distanceKm),
  };
}

/* ================================================================
   LEGACY EXPORTS (kept so existing imports don't break)
   ================================================================ */

export const TRANSACTION_COST_PER_KG = DEFAULT_TRANSACTION_COST_PER_KG;

export type TransportMode = "krishilink" | "self";

/** @deprecated — no longer subtracted from farmer's realization.
 *  Kept only for buyer-side transport estimate. */
export function estimateTransportCostPerKg(
  distanceKm: number,
  quantityKg: number
): number {
  if (distanceKm <= 0 || quantityKg <= 0) return 0;
  const vehicle = pickVehicle(quantityKg);
  return round2((distanceKm * vehicle.rate_per_km) / quantityKg);
}

/* ================================================================
   DISTANCE HELPERS (unchanged)
   ================================================================ */

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function estimateDistanceFromDistricts(
  farmerDistrict: string | null,
  farmerState: string | null,
  buyerDistrict: string | null,
  buyerState: string | null
): number {
  if (!farmerDistrict || !buyerDistrict) return 100;
  const sameState =
    !!farmerState &&
    !!buyerState &&
    farmerState.toLowerCase() === buyerState.toLowerCase();
  const sameDistrict =
    farmerDistrict.toLowerCase() === buyerDistrict.toLowerCase();
  if (sameState && sameDistrict) return 25;
  if (sameState) return 90;
  return 300;
}

/* ================================================================
   UTILITY
   ================================================================ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}