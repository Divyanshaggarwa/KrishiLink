/* ========================================================================
   Roboflow Quality AI — Onion & Potato → Grade A / B / C + detected crop
   Uses our Next.js API proxy (server-side key).
   ======================================================================== */

export const ROBOFLOW_SUPPORTED_CROPS = ["onion", "potato"] as const;

/* ------------------------------------------------------------------
   Crop name canonicalization — handles typos & aliases from the model
   (e.g. "patato" → "potato", "aaloo" → "potato", "pyaz" → "onion")
   ------------------------------------------------------------------ */

const CROP_ALIASES: Record<string, string> = {
  // potato misspellings
  patato: "potato",
  potatos: "potato",
  potatoes: "potato",
  potat: "potato",
  potatto: "potato",
  batata: "potato",
  aloo: "potato",
  aaloo: "potato",
  aalu: "potato",
  // onion misspellings
  onin: "onion",
  onoin: "onion",
  onionn: "onion",
  onoins: "onion",
  onions: "onion",
  piyaz: "onion",
  pyaz: "onion",
  pyaj: "onion",
  kanda: "onion",
  // common alternate crop names
  tomatoe: "tomato",
  tomatoes: "tomato",
  tamatar: "tomato",
};

/**
 * Normalize a raw detected crop string to a canonical lowercase form.
 * Steps:
 *   1. Strip non-letters, lowercase
 *   2. Look up exact alias map
 *   3. Fuzzy-match against ROBOFLOW_SUPPORTED_CROPS via Levenshtein ≤ 2
 *   4. Fallback: return cleaned string
 */
export function canonicalCrop(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().replace(/[^a-z]/g, "").trim();
  if (!cleaned) return null;

  if (CROP_ALIASES[cleaned]) return CROP_ALIASES[cleaned];

  // Fuzzy match against known crops
  let best: { crop: string; dist: number } | null = null;
  for (const crop of ROBOFLOW_SUPPORTED_CROPS) {
    const d = levenshtein(cleaned, crop);
    if (!best || d < best.dist) best = { crop, dist: d };
  }
  // Tight threshold — only correct very-close typos
  if (best && best.dist <= 2 && cleaned.length >= 4) return best.crop;

  return cleaned;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
      prev = temp;
    }
  }
  return dp[b.length];
}

/* ------------------------------------------------------------------ */

export interface RoboflowQualityResult {
  grade: "A" | "B" | "C" | null;
  confidence: number;
  detectedCrop: string | null;
  cropVerified: boolean; // true if crop was actually returned by the model
  raw: unknown;
}

export function isRoboflowSupported(crop: string): boolean {
  return ROBOFLOW_SUPPORTED_CROPS.includes(
    crop.toLowerCase().trim() as (typeof ROBOFLOW_SUPPORTED_CROPS)[number]
  );
}

export async function callRoboflowQuality(
  imageUrl: string
): Promise<RoboflowQualityResult | null> {
  if (!imageUrl || !imageUrl.startsWith("http")) {
    console.warn("[roboflow] invalid image URL");
    return null;
  }

  try {
    const res = await fetch("/api/ai/quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[roboflow] proxy ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    return parseRoboflowResponse(data);
  } catch (err) {
    console.warn("[roboflow] request failed:", err);
    return null;
  }
}

/**
 * Parses Roboflow Workflow responses. Extracts grade + crop name.
 *
 * Handles multiple response shapes:
 *   A) { outputs: [ { predictions: [ { class: "onion_A", confidence: 0.91 } ] } ] }
 *   B) { outputs: [ { top: "GRADE_A", confidence: 0.91 } ] }
 *   C) { outputs: [ { class_id: 0, confidence: 0.91 } ], classes: [...] }  ← via `classes` array
 *   D) { outputs: [ { output: "A" } ] }
 *   E) { predictions: [...] }  (no `outputs` wrapper)
 */
function parseRoboflowResponse(data: unknown): RoboflowQualityResult | null {
  if (!data || typeof data !== "object") return null;

  // Debug — remove or gate behind an env flag in production
  try {
    console.log(
      "[roboflow] raw response:",
      JSON.stringify(data).slice(0, 3000)
    );
  } catch {
    /* ignore */
  }

  const grades: Array<{ grade: "A" | "B" | "C"; confidence: number }> = [];
  const crops: Array<{ crop: string; confidence: number }> = [];

  // Expanded label key set
  const labelKeys = new Set([
    "class",
    "class_name",
    "class_label",
    "classname",
    "top",
    "top_class",
    "predicted_class",
    "predicted_label",
    "predicted",
    "prediction",
    "label",
    "label_name",
    "output",
    "output_class",
    "result",
    "value",
    "name",
  ]);

  const cropKeys = new Set([
    "crop",
    "detected_crop",
    "predicted_crop",
    "crop_name",
    "cropname",
    "recognized_crop",
    "crop_type",
    "croptype",
    "variety",
  ]);

  // ---- Step 1: collect any `classes` arrays (id → name mapping) ----
  // Handles shape: { classes: ["A", "B", "C"] } + predictions with class_id.
  const classIdMap = new Map<number, string>();
  const collectClassMaps = (value: unknown, depth = 0) => {
    if (depth > 20 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => collectClassMaps(item, depth + 1));
      return;
    }
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.classes)) {
      record.classes.forEach((name, idx) => {
        if (typeof name === "string") classIdMap.set(idx, name);
      });
    }
    Object.values(record).forEach((v) => collectClassMaps(v, depth + 1));
  };
  collectClassMaps(data);

  const confidenceOf = (
    record: Record<string, unknown>,
    inherited: number
  ): number => {
    const raw =
      record.confidence ?? record.probability ?? record.score ?? inherited;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return inherited;
    return Math.min(value > 1 ? value / 100 : value, 1);
  };

  const visit = (value: unknown, inheritedConfidence = 0.7, depth = 0) => {
    if (depth > 25 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, inheritedConfidence, depth + 1));
      return;
    }

    const record = value as Record<string, unknown>;
    const confidence = confidenceOf(record, inheritedConfidence);

    for (const [key, item] of Object.entries(record)) {
      const normalizedKey = key.toLowerCase();

      // ---- Direct string label ----
      if (typeof item === "string" && labelKeys.has(normalizedKey)) {
        const parsed = parseClassLabel(item);
        if (parsed.grade) grades.push({ grade: parsed.grade, confidence });
        if (parsed.crop) crops.push({ crop: parsed.crop, confidence });
        continue;
      }

      // ---- Direct crop string ----
      if (typeof item === "string" && cropKeys.has(normalizedKey)) {
        crops.push({ crop: item.trim(), confidence });
        continue;
      }

      // ---- class_id + classes[] mapping ----
      if (
        (normalizedKey === "class_id" || normalizedKey === "classid") &&
        typeof item === "number" &&
        classIdMap.has(item)
      ) {
        const mapped = classIdMap.get(item)!;
        const parsed = parseClassLabel(mapped);
        if (parsed.grade) grades.push({ grade: parsed.grade, confidence });
        if (parsed.crop) crops.push({ crop: parsed.crop, confidence });
        continue;
      }

      // ---- Recurse (skip known heavy/noisy keys) ----
      if (
        normalizedKey === "profile_trace" ||
        normalizedKey === "profiler_trace" ||
        normalizedKey === "trace"
      ) {
        continue;
      }
      visit(item, confidence, depth + 1);
    }
  };

  visit(data);
  grades.sort((a, b) => b.confidence - a.confidence);
  crops.sort((a, b) => b.confidence - a.confidence);

  const bestGrade = grades[0];
  const detectedCrop = canonicalCrop(crops[0]?.crop ?? null);

  // If we have at least a grade, return it (crop may be null → cropVerified=false)
  if (bestGrade) {
    return {
      grade: bestGrade.grade,
      confidence: bestGrade.confidence,
      detectedCrop,
      cropVerified: !!detectedCrop,
      raw: data,
    };
  }

  // If we have only crop (no grade), still useful for verification, but
  // caller will treat grade=null and reject.
  if (detectedCrop) {
    return {
      grade: null,
      confidence: crops[0].confidence,
      detectedCrop,
      cropVerified: true,
      raw: data,
    };
  }

  const keys = Object.keys(data as Record<string, unknown>);
  console.warn(
    "[roboflow] response contained no usable crop and grade labels. keys:",
    keys
  );
  return null;
}

/* ------------------------------------------------------------------ */

interface ParsedLabel {
  grade: "A" | "B" | "C" | null;
  crop: string | null;
}

function parseClassLabel(cls: string): ParsedLabel {
  const tokens = cls
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const compact = tokens.join("");
  const compactGrade = compact.match(/^(?:grade|quality|class)?([abc])$/);
  const gradeIndex = tokens.findIndex((token) => ["a", "b", "c"].includes(token));
  const grade =
    (compactGrade?.[1] as "a" | "b" | "c" | undefined) ??
    (gradeIndex >= 0 ? (tokens[gradeIndex] as "a" | "b" | "c") : null);

  const beforeGrade = gradeIndex >= 0 ? tokens.slice(0, gradeIndex) : [];
  const afterGrade = gradeIndex >= 0 ? tokens.slice(gradeIndex + 1) : [];
  const cropTokens = beforeGrade.some(
    (token) => !["grade", "quality", "class"].includes(token)
  )
    ? beforeGrade
    : compactGrade
      ? []
      : afterGrade.length > 0
        ? afterGrade
        : tokens;
  const crop =
    cropTokens
      .filter((token) => !["grade", "quality", "class"].includes(token))
      .join(" ") || null;

  return {
    grade: grade ? (grade.toUpperCase() as "A" | "B" | "C") : null,
    crop,
  };
}