import raw from "./data.json";

export type Grade = "A" | "B" | "C";

export type FairPrice = {
  crop: string;
  grade: Grade;
  fairPrice: number;
  low: number;
  high: number;
  trendPct7d: number | null;
  expectedNextWeek: number;
  confidence: "low" | "medium" | "high";
  flags: string[];
  dataPoints: number;
  lastDataDate: string;
  reason: string;
};

export type Listing = {
  id: string;
  crop: string;
  grade: Grade;
  askingPrice: number;
  distanceKm: number;
  transportCostPerKg?: number;
};

const GRADE_RATIO: Record<Grade, number> = { A: 1, B: 0.85, C: 0.7 };
const USABLE: Record<Grade, number> = { A: 1, B: 0.92, C: 0.8 };
const TRANSPORT_PER_KG_KM = 0.02;
const HALF_LIFE_DAYS = 5;
const DAY = 86_400_000;

type Row = { t: number; crop: string; grade: Grade; p: number };

let rows: Row[] = (raw as [string, string, Grade, number][]).map(
  ([date, crop, grade, price]) => ({
    t: Date.parse(`${date}T00:00:00Z`),
    crop: crop.toLowerCase(),
    grade,
    p: price,
  })
);

export function setRows(next: [string, string, Grade, number][]) {
  rows = next.map(([date, crop, grade, price]) => ({
    t: Date.parse(`${date}T00:00:00Z`),
    crop: crop.toLowerCase(),
    grade,
    p: price,
  }));
}

export const crops = () => [...new Set(rows.map((row) => row.crop))].sort();

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const pstdev = (values: number[]) => {
  const average = mean(values);
  return Math.sqrt(
    mean(values.map((value) => (value - average) ** 2))
  );
};

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const round2 = (value: number) => Math.round(value * 100) / 100;

export function fairPrice(
  cropInput: string,
  gradeInput: string,
  now = Date.now(),
  msp?: number
): FairPrice | null {
  const crop = cropInput.trim().toLowerCase();
  const grade = gradeInput.toUpperCase() as Grade;
  if (!crop || !(grade in GRADE_RATIO)) return null;

  const today = Math.floor(now / DAY) * DAY;
  const age = (time: number) => Math.round((today - time) / DAY);
  let points = rows
    .filter((row) => row.crop === crop && row.grade === grade)
    .map(({ t, p }) => ({ t, p }));
  let estimated = false;

  if (
    grade !== "A" &&
    points.filter((point) => age(point.t) >= 0 && age(point.t) <= 30).length < 3
  ) {
    points = rows
      .filter((row) => row.crop === crop && row.grade === "A")
      .map(({ t, p }) => ({ t, p: p * GRADE_RATIO[grade] }));
    estimated = true;
  }
  if (points.length === 0) return null;

  let weightedTotal = 0;
  let totalWeight = 0;
  for (const point of points) {
    const weight = 0.5 ** (Math.max(age(point.t), 0) / HALF_LIFE_DAYS);
    weightedTotal += weight * point.p;
    totalWeight += weight;
  }
  let price = weightedTotal / totalWeight;
  const latest = Math.max(...points.map((point) => point.t));
  const relativeAge = (time: number) => Math.round((latest - time) / DAY);
  const lastWeek = points
    .filter((point) => relativeAge(point.t) < 7)
    .map((point) => point.p);
  const previousWeek = points
    .filter((point) => relativeAge(point.t) >= 7 && relativeAge(point.t) < 14)
    .map((point) => point.p);
  const trend =
    lastWeek.length >= 3 && previousWeek.length >= 3
      ? (mean(lastWeek) / mean(previousWeek) - 1) * 100
      : null;
  const recentValues = points
    .filter((point) => relativeAge(point.t) < 14)
    .map((point) => point.p);
  const recent = recentValues.length > 0 ? recentValues : points.map((point) => point.p);
  const coefficientOfVariation =
    recent.length > 1 ? pstdev(recent) / mean(recent) : 0.1;
  const spread = Math.min(0.12, Math.max(0.05, coefficientOfVariation));
  let low = price * (1 - spread);
  let high = price * (1 + spread);
  const flags: string[] = [];

  if (estimated) flags.push("estimated_from_grade_A");
  if (msp && price < msp) {
    price = msp;
    low = Math.max(low, msp);
    high = Math.max(high, msp);
    flags.push("msp_floor");
  }

  const stale = age(latest) > 7;
  if (stale) flags.push("stale_data");
  const confidence =
    estimated || stale || recent.length < 4
      ? "low"
      : recent.length >= 10 && coefficientOfVariation < 0.1
        ? "high"
        : "medium";
  const trendValue = trend ?? 0;
  const nextWeekPrice =
    price *
    (1 + Math.max(-0.1, Math.min(0.1, (trendValue / 100) * 0.5)));
  const trendWord =
    trendValue > 0.5 ? "up" : trendValue < -0.5 ? "down" : "steady";
  const reason =
    `${crop[0].toUpperCase()}${crop.slice(1)} Grade ${grade} is about ₹${price.toFixed(1)}/kg` +
    (trend === null
      ? ""
      : trendWord === "steady"
        ? ", steady this week"
        : `, ${trendWord} ${Math.abs(trendValue).toFixed(1)}% this week`) +
    `. Based on ${points.length} records, latest ${isoDate(latest)}.`;

  return {
    crop,
    grade,
    fairPrice: round2(price),
    low: round2(low),
    high: round2(high),
    trendPct7d:
      trend === null ? null : Math.round(trend * 10) / 10,
    expectedNextWeek: round2(nextWeekPrice),
    confidence,
    flags,
    dataPoints: points.length,
    lastDataDate: isoDate(latest),
    reason,
  };
}

export function fairPrices(crop: string) {
  return (["A", "B", "C"] as Grade[])
    .map((grade) => fairPrice(crop, grade))
    .filter((value): value is FairPrice => value !== null);
}

export function recommend(
  listings: Listing[],
  ratePerKgKm = TRANSPORT_PER_KG_KM
) {
  const ranked = listings
    .flatMap((listing) => {
      const marketPrice = fairPrice(listing.crop, listing.grade);
      if (!marketPrice) return [];
      const transportCostPerKg =
        listing.transportCostPerKg ??
        listing.distanceKm * ratePerKgKm;
      const landedCost = listing.askingPrice + transportCostPerKg;
      const effectiveCost = landedCost / USABLE[listing.grade];
      const verdict =
        listing.askingPrice > marketPrice.high
          ? "overpriced"
          : listing.askingPrice < marketPrice.low
            ? "below_fair_check_quality"
            : "fair";

      return [
        {
          ...listing,
          transportCostPerKg: round2(transportCostPerKg),
          landedCost: round2(landedCost),
          effectiveCost: round2(effectiveCost),
          verdict,
          fairPrice: marketPrice.fairPrice,
          fairLow: marketPrice.low,
          fairHigh: marketPrice.high,
        },
      ];
    })
    .sort((first, second) => first.effectiveCost - second.effectiveCost);

  if (ranked.length === 0) {
    return {
      best: null,
      ranked,
      reason: "No market price data is available for these crops yet.",
    };
  }

  const best = ranked[0];
  const verdictText = {
    fair: "within the fair range",
    overpriced: "above the fair range",
    below_fair_check_quality: "below the fair range, so check quality",
  }[best.verdict];
  const reason =
    `Best estimated buy: Grade ${best.grade} listing ${best.id} at about ₹${best.effectiveCost}/kg ` +
    `after delivery and quality adjustment. The asking price is ${verdictText}.`;

  return { best, ranked, reason };
}
