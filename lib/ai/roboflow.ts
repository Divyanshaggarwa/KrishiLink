/* ========================================================================
   Roboflow Quality AI — Onion & Potato → Grade A / B / C + detected crop
   Uses our Next.js API proxy (server-side key).
   ======================================================================== */

export const ROBOFLOW_SUPPORTED_CROPS = ["onion", "potato"] as const;

export interface RoboflowQualityResult {
  grade: "A" | "B" | "C" | null;
  confidence: number;
  detectedCrop: string | null;
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
    if (process.env.NODE_ENV === "development") {
      console.log("[roboflow] raw response:", data);
    }

    return parseRoboflowResponse(data);
  } catch (err) {
    console.warn("[roboflow] request failed:", err);
    return null;
  }
}

/**
 * Parses Roboflow Workflow responses. Extracts grade + crop name.
 *
 * Class label formats we support:
 *   "A"            → grade A, no crop info (not sufficient to verify a listing)
 *   "onion_A"      → crop onion, grade A
 *   "onion_A_rot"  → crop onion, grade A
 *   "GRADE_A"      → grade A
 *   "onion"        → crop onion, no grade
 */
function parseRoboflowResponse(data: unknown): RoboflowQualityResult | null {
  try {
    const d = data as Record<string, unknown>;
    const outputs = d.outputs as Array<Record<string, unknown>> | undefined;

    if (Array.isArray(outputs) && outputs.length > 0) {
      for (const out of outputs) {
        const predsContainer = out.predictions as
          | Record<string, unknown>
          | Array<Record<string, unknown>>
          | undefined;

        if (!predsContainer) continue;

        /* ---- Shape A: predictions is an OBJECT ---- */
        if (!Array.isArray(predsContainer)) {
          const nested = predsContainer.predictions as
            | Array<Record<string, unknown>>
            | undefined;

          if (Array.isArray(nested) && nested.length > 0) {
            const top = nested[0];
            const cls = String(
              top.class ?? top.class_name ?? predsContainer.top ?? ""
            );
            const conf = Number(
              top.confidence ?? predsContainer.confidence ?? 0.7
            );
            const parsed = parseClassLabel(cls);
            if (parsed.grade || parsed.crop) {
              return {
                grade: parsed.grade,
                confidence: conf,
                detectedCrop: parsed.crop,
                raw: data,
              };
            }
          }

          /* Container-level class */
          const containerClass = String(predsContainer.top ?? "");
          if (containerClass) {
            const parsed = parseClassLabel(containerClass);
            if (parsed.grade || parsed.crop) {
              return {
                grade: parsed.grade,
                confidence: Number(predsContainer.confidence ?? 0.7),
                detectedCrop: parsed.crop,
                raw: data,
              };
            }
          }
        }

        /* ---- Shape B: predictions is an ARRAY ---- */
        if (Array.isArray(predsContainer) && predsContainer.length > 0) {
          const top = predsContainer[0];
          const cls = String(top.class ?? top.class_name ?? "");
          const conf = Number(top.confidence ?? 0.7);
          const parsed = parseClassLabel(cls);
          if (parsed.grade || parsed.crop) {
            return {
              grade: parsed.grade,
              confidence: conf,
              detectedCrop: parsed.crop,
              raw: data,
            };
          }
        }
      }
    }

    /* ---- Fallback shapes ---- */
    const preds = d.predictions as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(preds) && preds.length > 0) {
      const top = preds[0];
      const parsed = parseClassLabel(String(top.class ?? top.class_name ?? ""));
      if (parsed.grade || parsed.crop) {
        return {
          grade: parsed.grade,
          confidence: Number(top.confidence ?? 0.7),
          detectedCrop: parsed.crop,
          raw: data,
        };
      }
    }

    if (d.class) {
      const parsed = parseClassLabel(String(d.class));
      if (parsed.grade || parsed.crop) {
        return {
          grade: parsed.grade,
          confidence: Number(d.confidence ?? 0.7),
          detectedCrop: parsed.crop,
          raw: data,
        };
      }
    }

    console.warn("[roboflow] could not parse response:", data);
    return null;
  } catch (err) {
    console.warn("[roboflow] parse error:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */

interface ParsedLabel {
  grade: "A" | "B" | "C" | null;
  crop: string | null;
}

function parseClassLabel(cls: string): ParsedLabel {
  const tokens = cls.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const compact = tokens.join("");
  const compactGrade = compact.match(/^(?:grade|quality|class)?([abc])$/);
  const gradeIndex = tokens.findIndex((token) =>
    ["a", "b", "c"].includes(token)
  );
  const grade =
    (compactGrade?.[1] as "a" | "b" | "c" | undefined) ??
    (gradeIndex >= 0 ? tokens[gradeIndex] as "a" | "b" | "c" : null);

  const beforeGrade =
    gradeIndex >= 0 ? tokens.slice(0, gradeIndex) : [];
  const afterGrade =
    gradeIndex >= 0 ? tokens.slice(gradeIndex + 1) : [];
  const cropTokens =
    beforeGrade.some((token) => !["grade", "quality", "class"].includes(token))
      ? beforeGrade
      : compactGrade
        ? []
        : afterGrade.length > 0
          ? afterGrade
          : tokens;
  const crop = cropTokens
    .filter((token) => !["grade", "quality", "class"].includes(token))
    .join(" ") || null;

  return {
    grade: grade ? (grade.toUpperCase() as "A" | "B" | "C") : null,
    crop,
  };
}