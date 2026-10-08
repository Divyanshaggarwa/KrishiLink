import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight health probe for the Route AI subsystem.
 * Checks env keys + pings OSRM + (optionally) Geoapify.
 */
export async function GET() {
  const geoapifyKey = process.env.GEOAPIFY_KEY ?? "";

  let osrm: "ok" | "degraded" = "degraded";
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(
      "https://router.project-osrm.org/route/v1/driving/73.85,18.52;72.87,19.07?overview=false",
      { signal: ctl.signal }
    );
    clearTimeout(t);
    if (r.ok) {
      const j = await r.json();
      if (j?.code === "Ok") osrm = "ok";
    }
  } catch {
    osrm = "degraded";
  }

  return NextResponse.json({
    geoapify: geoapifyKey ? "ok" : "missing_key",
    osrm,
    timestamp: new Date().toISOString(),
  });
}