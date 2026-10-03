/* Legacy shim — all AI now lives in lib/ai/ */
export {
  predictFairPrice,
  predictQuality,
  predictDemand,
  optimizeRoute,
  evaluateFairness,
} from "./ai/client";