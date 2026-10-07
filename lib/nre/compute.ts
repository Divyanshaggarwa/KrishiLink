/* ========================================================================
   KrishiLink Net Realization Engine — v2
   - Farmer's net EXCLUDES transport (buyer bears transport)
   - Buyer's landed cost INCLUDES transport + buyer fee
   - Dual-sided platform fee (farmer_fee_pct + buyer_fee_pct)
   - Transporter fee charged on transport revenue
   ======================================================================== */

export type QualityGrade = "A" | "B" | "C";

export interface FeeConfig {
  farmer_fee_pct: number;       // % deducted from farmer's proceeds
  buyer_fee_pct: number;        // % added to buyer's payable
  transporter_fee_pct: number;  // % of transport cost (charged to transporter)
  handling_per_kg: number;      // ₹/kg handling (farmer side)
  gateway_pct: number;
  quality_deduction_A: number;
  quality_deduction_B: number;
  quality_deduction_C: number;
}

export interface TransportRate {
  vehicle: string;
  rate_per_km: number;
  min_weight_kg: number;
  max_weight_kg: number;
}

/* ------------------------------------------------------------------ */
/*  Farmer-side realization                                          */
/* ------------------------------------------------------------------ */

export interface RealizationInput {
  offerPricePerKg: number;
  quantityKg: number;
  grade: QualityGrade;
  feeConfig: FeeConfig;
}

export interface RealizationBreakdown {
  gross: number;
  farmerFee: number;
  gatewayFee: number;
  handling: number;
  qualityDeduction: number;
  totalDeductions: number;
  netRealization: number;
  netPerKg: number;
  breakdownPerKg: {
    pricePerKg: number;
    farmerFeePerKg: number;
    gatewayPerKg: number;
    handlingPerKg: number;
    qualityPerKg: number;
    netPerKg: number;
  };
}

export function qualityDeductionFor(
  grade: QualityGrade,
  config: FeeConfig
): number {
  if (grade === "A") return config.quality_deduction_A;
  if (grade === "B") return config.quality_deduction_B;
  return config.quality_deduction_C;
}

export function computeRealization(
  input: RealizationInput
): RealizationBreakdown {
  const { offerPricePerKg, quantityKg, grade, feeConfig } = input;

  const gross = offerPricePerKg * quantityKg;
  const farmerFee = gross * (feeConfig.farmer_fee_pct / 100);
  const gatewayFee = gross * (feeConfig.gateway_pct / 100);
  const handling = feeConfig.handling_per_kg * quantityKg;
  const qualityDeduction = qualityDeductionFor(grade, feeConfig) * quantityKg;

  const totalDeductions = farmerFee + gatewayFee + handling + qualityDeduction;
  const netRealization = gross - totalDeductions;
  const netPerKg = quantityKg > 0 ? netRealization / quantityKg : 0;

  return {
    gross: round2(gross),
    farmerFee: round2(farmerFee),
    gatewayFee: round2(gatewayFee),
    handling: round2(handling),
    qualityDeduction: round2(qualityDeduction),
    totalDeductions: round2(totalDeductions),
    netRealization: round2(netRealization),
    netPerKg: round2(netPerKg),
    breakdownPerKg: {
      pricePerKg: round2(offerPricePerKg),
      farmerFeePerKg: round2(farmerFee / quantityKg),
      gatewayPerKg: round2(gatewayFee / quantityKg),
      handlingPerKg: round2(handling / quantityKg),
      qualityPerKg: round2(qualityDeduction / quantityKg),
      netPerKg: round2(netPerKg),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Buyer-side landed cost                                           */
/* ------------------------------------------------------------------ */

export interface BuyerLandedInput {
  offerPricePerKg: number;
  quantityKg: number;
  distanceKm: number;
  feeConfig: FeeConfig;
  transportRates: TransportRate[];
}

export interface BuyerLandedBreakdown {
  gross: number;
  buyerFee: number;
  gatewayFee: number;
  transportCost: number;
  totalPayable: number;
  landedPerKg: number;
  vehicle: string;
  breakdownPerKg: {
    pricePerKg: number;
    buyerFeePerKg: number;
    gatewayPerKg: number;
    transportPerKg: number;
    landedPerKg: number;
  };
}

export function pickVehicle(
  quantityKg: number,
  rates: TransportRate[]
): TransportRate {
  const match = rates.find(
    (r) => quantityKg >= r.min_weight_kg && quantityKg <= r.max_weight_kg
  );
  return match ?? rates[rates.length - 1];
}

export function computeBuyerLandedCost(
  input: BuyerLandedInput
): BuyerLandedBreakdown {
  const { offerPricePerKg, quantityKg, distanceKm, feeConfig, transportRates } =
    input;

  const gross = offerPricePerKg * quantityKg;
  const buyerFee = gross * (feeConfig.buyer_fee_pct / 100);
  const gatewayFee = gross * (feeConfig.gateway_pct / 100);

  const vehicle = pickVehicle(quantityKg, transportRates);
  const transportCost = distanceKm * vehicle.rate_per_km;

  const totalPayable = gross + buyerFee + gatewayFee + transportCost;
  const landedPerKg = quantityKg > 0 ? totalPayable / quantityKg : 0;

  return {
    gross: round2(gross),
    buyerFee: round2(buyerFee),
    gatewayFee: round2(gatewayFee),
    transportCost: round2(transportCost),
    totalPayable: round2(totalPayable),
    landedPerKg: round2(landedPerKg),
    vehicle: vehicle.vehicle,
    breakdownPerKg: {
      pricePerKg: round2(offerPricePerKg),
      buyerFeePerKg: round2(buyerFee / quantityKg),
      gatewayPerKg: round2(gatewayFee / quantityKg),
      transportPerKg: round2(transportCost / quantityKg),
      landedPerKg: round2(landedPerKg),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Mandi benchmark (unchanged — farmer's alternative)                */
/* ------------------------------------------------------------------ */

export interface MandiBenchmarkInput {
  mandiModalPricePerKg: number;
  quantityKg: number;
  distanceToMandiKm: number;
  transportRates: TransportRate[];
  mandiCommissionPct: number;
  spoilagePct: number;
}

export interface MandiBenchmark {
  grossAtMandi: number;
  mandiCommission: number;
  transportToMandi: number;
  spoilageLoss: number;
  mandiNet: number;
  mandiNetPerKg: number;
}

export function computeMandiBenchmark(
  input: MandiBenchmarkInput
): MandiBenchmark {
  const {
    mandiModalPricePerKg,
    quantityKg,
    distanceToMandiKm,
    transportRates,
    mandiCommissionPct,
    spoilagePct,
  } = input;

  const grossAtMandi = mandiModalPricePerKg * quantityKg;
  const mandiCommission = grossAtMandi * (mandiCommissionPct / 100);
  const vehicle = pickVehicle(Math.min(quantityKg, 500), transportRates);
  const transportToMandi = distanceToMandiKm * vehicle.rate_per_km;
  const spoilageLoss = grossAtMandi * (spoilagePct / 100);
  const mandiNet =
    grossAtMandi - mandiCommission - transportToMandi - spoilageLoss;

  return {
    grossAtMandi: round2(grossAtMandi),
    mandiCommission: round2(mandiCommission),
    transportToMandi: round2(transportToMandi),
    spoilageLoss: round2(spoilageLoss),
    mandiNet: round2(mandiNet),
    mandiNetPerKg: round2(quantityKg > 0 ? mandiNet / quantityKg : 0),
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                          */
/* ------------------------------------------------------------------ */

export function estimateTransportCostPerKg(
  distanceKm: number,
  quantityKg: number
): number {
  if (distanceKm <= 0 || quantityKg <= 0) return 0;
  let ratePerKm: number;
  if (quantityKg < 500) ratePerKm = 18;
  else if (quantityKg < 2000) ratePerKm = 28;
  else ratePerKm = 42;
  return Number(((distanceKm * ratePerKm) / quantityKg).toFixed(2));
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}