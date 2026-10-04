/* ========================================================================
   Roboflow Quality AI — Onion & Potato → Grade A / B / C
   Uses our Next.js API proxy (server-side key).
   ======================================================================== */

export const ROBOFLOW_SUPPORTED_CROPS = ["onion", "potato"] as const;

export interface RoboflowQualityResult {
  grade: "A" | "B" | "C";
  confidence: number;
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
 * Parses Roboflow Workflow responses.
 * Real shape (confirmed):
 *   { outputs: [ { predictions: { prediction_type: "classification",
 *                                 predictions: [ { class: "A", confidence: 0.91 } ] } } ] }
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

        /* ---- Shape A: predictions is an OBJECT with nested .predictions[] ---- */
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
            const grade = normalizeGrade(cls);
            if (grade) {
              return { grade, confidence: conf, raw: data };
            }
          }

          /* Some workflows put the class at the container level */
          const containerClass = String(predsContainer.top ?? "");
          if (containerClass) {
            const grade = normalizeGrade(containerClass);
            if (grade) {
              return {
                grade,
                confidence: Number(predsContainer.confidence ?? 0.7),
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
          const grade = normalizeGrade(cls);
          if (grade) return { grade, confidence: conf, raw: data };
        }
      }
    }

    /* ---- Fallback shapes ---- */
    const preds = d.predictions as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(preds) && preds.length > 0) {
      const top = preds[0];
      const grade = normalizeGrade(String(top.class ?? top.class_name ?? ""));
      if (grade) {
        return { grade, confidence: Number(top.confidence ?? 0.7), raw: data };
      }
    }

    if (d.class) {
      const grade = normalizeGrade(String(d.class));
      if (grade) {
        return { grade, confidence: Number(d.confidence ?? 0.7), raw: data };
      }
    }

    console.warn("[roboflow] could not parse response:", data);
    return null;
  } catch (err) {
    console.warn("[roboflow] parse error:", err);
    return null;
  }
}

function normalizeGrade(cls: string): "A" | "B" | "C" | null {
  const cleaned = cls.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (
    cleaned === "A" ||
    cleaned === "GRADEA" ||
    cleaned.startsWith("A_") ||
    cleaned.endsWith("_A")
  )
    return "A";
  if (
    cleaned === "B" ||
    cleaned === "GRADEB" ||
    cleaned.startsWith("B_") ||
    cleaned.endsWith("_B")
  )
    return "B";
  if (
    cleaned === "C" ||
    cleaned === "GRADEC" ||
    cleaned.startsWith("C_") ||
    cleaned.endsWith("_C")
  )
    return "C";

  return null;
}