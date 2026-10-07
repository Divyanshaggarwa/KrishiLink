import { NextResponse } from "next/server";
import { fairPrices } from "@/lib/fairPrice/engine";

export async function GET(request: Request) {
  const crop = new URL(request.url).searchParams.get("crop")?.trim() ?? "";
  if (!crop) {
    return NextResponse.json({ error: "A crop name is required." }, { status: 400 });
  }

  const grades = fairPrices(crop);
  if (grades.length === 0) {
    return NextResponse.json(
      { error: `No Fair Price market data is available for '${crop}'.` },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { crop: crop.toLowerCase(), grades, source: "historical-market-data" },
    { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" } }
  );
}
