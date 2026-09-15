/* ========================================================================
   Shared Fair Band — one price range that BOTH farmer and buyer see.
   Anchored on 3 signals + quality + shared costs (transport + labour + txn)
   ======================================================================== */

export type QualityGrade = "A" | "B" | "C";

export interface FairBandInput {
  farmerExpectedPrice: number;
  buyerBid: number;
  mandiModalPrice: number | null;
  grade: QualityGrade;
  quantityKg: number;
  distanceKm: number;
}

export interface FairBand {
  low: number;
  mid: number;
  high: number;
  anchor: number;
  qualityMultiplier: number;
  sharedCostPerKg: number;
  transportSharePerKg: number;
  labourPerKg: number;
  txnSharePerKg: number;
  verdict: "narrow" | "moderate" | "wide";
  message: string;
}

const QUALITY_MULT: Record<QualityGrade, number> = {
  A: 1.0,
  B: 0.92,
  C: 0.82,
};

const LABOUR_PER_KG = 0.35;
const TXN_PER_KG = 0.3;

function transportRatePerKm(quantityKg: number): number {
  if (quantityKg < 500) return 18;
  if (quantityKg < 2000) return 28;
  return 42;
}

export function computeFairBand(input: FairBandInput): FairBand {
  const {
    farmerExpectedPrice,
    buyerBid,
    mandiModalPrice,
    grade,
    quantityKg,
    distanceKm,
  } = input;

  // 3-way anchor: farmer's ask + buyer's bid + market (if known)
  const anchors = [farmerExpectedPrice, buyerBid];
  if (mandiModalPrice && mandiModalPrice > 0) anchors.push(mandiModalPrice);
  const rawAnchor = anchors.reduce((a, b) => a + b, 0) / anchors.length;

  // Quality adjustment
  const qualityMultiplier = QUALITY_MULT[grade];
  const anchor = rawAnchor * qualityMultiplier;

  // Shared costs (split 50/50 between farmer and buyer)
  const transportCostTotal = distanceKm * transportRatePerKm(quantityKg);
  const transportSharePerKg =
    quantityKg > 0 ? (transportCostTotal / quantityKg) * 0.5 : 0;
  const labourPerKg = LABOUR_PER_KG;
  const txnSharePerKg = TXN_PER_KG;

  const sharedCostPerKg =
    transportSharePerKg + labourPerKg + txnSharePerKg;

  const mid = Number((anchor + sharedCostPerKg).toFixed(2));
  const low = Number((mid - 1.5).toFixed(2));
  const high = Number((mid + 1.5).toFixed(2));

  // Verdict on how far apart they are
  const spread = Math.abs(farmerExpectedPrice - buyerBid);
  let verdict: FairBand["verdict"];
  let message: string;

  if (spread <= 1.5) {
    verdict = "narrow";
    message =
      "Your prices are already close — a quick call should close this deal.";
  } else if (spread <= 4) {
    verdict = "moderate";
    message =
      "Small gap to bridge. Use Book a Call to agree on a number in the band.";
  } else {
    verdict = "wide";
    message =
      "You're far apart. The fair band shows a reasonable middle ground.";
  }

  return {
    low,
    mid,
    high,
    anchor: Number(anchor.toFixed(2)),
    qualityMultiplier,
    sharedCostPerKg: Number(sharedCostPerKg.toFixed(2)),
    transportSharePerKg: Number(transportSharePerKg.toFixed(2)),
    labourPerKg,
    txnSharePerKg,
    verdict,
    message,
  };
}