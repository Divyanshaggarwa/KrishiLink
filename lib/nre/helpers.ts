export {
  computeRealization,
  computeMandiBenchmark,
  pickVehicle,
  qualityDeductionFor,
} from "./compute";

export type {
  RealizationBreakdown,
  MandiBenchmark,
  FeeConfig,
  TransportRate,
  QualityGrade,
} from "./compute";

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