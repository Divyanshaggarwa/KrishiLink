/* ========================================================================
   KrishiLink AI adapter
   - Tries the teammate microservice (NEXT_PUBLIC_AI_URL)
   - Falls back to deterministic mocks so the app is never broken
   - Every result is tagged with `source: "ai" | "mock"` for transparency
   ======================================================================== */

export interface FairPriceInput {
  crop: string;
  quality: "A" | "B" | "C";
  quantityKg: number;
  district: string;
  month: number;
}

export interface FairPriceResult {
  low: number;
  high: number;
  mid: number;
  confidence: number;
  factors: string[];
  source: "ai" | "mock";
}

export interface QualityResult {
  grade: "A" | "B" | "C";
  confidence: number;
  defects: string[];
  source: "ai" | "mock";
}

const CROP_BASE_PRICES: Record<string, number> = {
  tomato: 24,
  onion: 18,
  potato: 22,
  wheat: 27,
  rice: 32,
  maize: 21,
  chilli: 55,
  brinjal: 28,
  okra: 35,
  cauliflower: 30,
  cabbage: 18,
  carrot: 32,
  spinach: 22,
  banana: 30,
  mango: 65,
};

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || "";

export async function predictFairPrice(
  input: FairPriceInput
): Promise<FairPriceResult> {
  if (AI_URL) {
    try {
      const res = await fetch(`${AI_URL}/predict/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: input.crop,
          quality: input.quality,
          quantity_kg: input.quantityKg,
          district: input.district,
          month: input.month,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as Omit<FairPriceResult, "source">;
        return { ...data, source: "ai" };
      }
    } catch {
      /* fall through to mock */
    }
  }

  const cropKey = input.crop.toLowerCase().trim();
  const base = CROP_BASE_PRICES[cropKey] ?? 25;
  const mult = { A: 1.0, B: 0.85, C: 0.7 }[input.quality];
  const mid = base * mult;

  return {
    low: Number((mid - 1.5).toFixed(2)),
    high: Number((mid + 1.5).toFixed(2)),
    mid: Number(mid.toFixed(2)),
    confidence: 0.72,
    factors: [
      `Crop base price for ${input.crop}: ₹${base}/kg`,
      `Quality grade ${input.quality} (×${mult})`,
      `District: ${input.district || "—"}`,
      `Season month: ${input.month}`,
    ],
    source: "mock",
  };
}

export async function predictQuality(
  imageBase64: string
): Promise<QualityResult> {
  if (AI_URL && imageBase64.length > 0) {
    try {
      const res = await fetch(`${AI_URL}/predict/quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imageBase64 }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as Omit<QualityResult, "source">;
        return { ...data, source: "ai" };
      }
    } catch {
      /* fall through */
    }
  }

  // Deterministic mock based on image hash
  let hash = 0;
  for (let i = 0; i < imageBase64.length; i += 97) {
    hash = (hash * 31 + imageBase64.charCodeAt(i)) % 1000;
  }
  const grade: "A" | "B" | "C" = hash > 66 ? "A" : hash > 33 ? "B" : "C";

  return {
    grade,
    confidence: Number((0.68 + (hash % 25) / 100).toFixed(2)),
    defects:
      grade === "A"
        ? []
        : grade === "B"
          ? ["Minor surface blemish"]
          : ["Visible spots / discoloration"],
    source: "mock",
  };
}