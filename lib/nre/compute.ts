/* ========================================================================
   KrishiLink — Net Realization Engine (NRE)
   Pure functions. Fee-config aware. Testable. The single source of truth.
   ======================================================================== */

export type QualityGrade = "A" | "B" | "C";

export interface FeeConfig {
  commission_pct: number;
  handling_flat: number;
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

export interface RealizationInput {
  offerPricePerKg: number;
  quantityKg: number;
  distanceKm: number;
  grade: QualityGrade;
  feeConfig: FeeConfig;
  transportRates: TransportRate[];
}

export interface RealizationBreakdown {
  gross: number;
  commission: number;
  gatewayFee: number;
  handling: number;
  transportCost: number;
  qualityDeduction: number;
  totalDeductions: number;
  netRealization: number;
  netPerKg: number;
  breakdownPerKg: {
    pricePerKg: number;
    commissionPerKg: number;
    gatewayPerKg: number;
    handlingPerKg: number;
    transportPerKg: number;
    qualityPerKg: number;
    netPerKg: number;
  };
  vehicle: string;
}

export interface MandiBenchmarkInput {
  mandiModalPricePerKg: number;
  quantityKg: number;
  distanceToMandiKm: number;
  transportRates: TransportRate[];
  mandiCommissionPct: number;  // typically 6-8% in APMCs
  spoilagePct: number;         // 2-5% typical wastage
}

export interface MandiBenchmark {
  grossAtMandi: number;
  mandiCommission: number;
  transportToMandi: number;
  spoilageLoss: number;
  mandiNet: number;
  mandiNetPerKg: number;
}

/* -------------------------------------------------------------------- */
export function pickVehicle(
  quantityKg: number,
  rates: TransportRate[]
): TransportRate {
  const match = rates.find(
    (r) => quantityKg >= r.min_weight_kg && quantityKg <= r.max_weight_kg
  );
  return match ?? rates[rates.length - 1];
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
  const { offerPricePerKg, quantityKg, distanceKm, grade, feeConfig, transportRates } = input;

  const gross = offerPricePerKg * quantityKg;
  const commission = gross * (feeConfig.commission_pct / 100);
  const gatewayFee = gross * (feeConfig.gateway_pct / 100);
  const handling = feeConfig.handling_flat;

  const vehicle = pickVehicle(quantityKg, transportRates);
  const transportCost = distanceKm * vehicle.rate_per_km;

  const qualityDeduction =
    qualityDeductionFor(grade, feeConfig) * quantityKg;

  const totalDeductions =
    commission + gatewayFee + handling + transportCost + qualityDeduction;

  const netRealization = gross - totalDeductions;
  const netPerKg = quantityKg > 0 ? netRealization / quantityKg : 0;

  return {
    gross: round2(gross),
    commission: round2(commission),
    gatewayFee: round2(gatewayFee),
    handling: round2(handling),
    transportCost: round2(transportCost),
    qualityDeduction: round2(qualityDeduction),
    totalDeductions: round2(totalDeductions),
    netRealization: round2(netRealization),
    netPerKg: round2(netPerKg),
    breakdownPerKg: {
      pricePerKg: round2(offerPricePerKg),
      commissionPerKg: round2(commission / quantityKg),
      gatewayPerKg: round2(gatewayFee / quantityKg),
      handlingPerKg: round2(handling / quantityKg),
      transportPerKg: round2(transportCost / quantityKg),
      qualityPerKg: round2(qualityDeduction / quantityKg),
      netPerKg: round2(netPerKg),
    },
    vehicle: vehicle.vehicle,
  };
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}