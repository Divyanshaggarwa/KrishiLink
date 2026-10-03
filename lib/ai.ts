/* Legacy barrel — re-exports the new lib/ai/ structure */

export {
  predictFairPrice,
  predictQuality,
  predictDemand,
  optimizeRoute,
  evaluateFairness,
} from "./ai/client";

export type {
  AiSource,
  QualityGrade,
  FairPriceInput,
  FairPriceOutput,
  FairPriceResult,
  QualityInput,
  QualityOutput,
  QualityResult,
  DemandInput,
  DemandOutput,
  RouteInput,
  RouteOutput,
  FairnessInput,
  FairnessOutput,
  FairnessResult,
  FairnessVerdict,
} from "./ai/types";