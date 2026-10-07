import { NextResponse } from "next/server";
import { recommend, type Grade, type Listing } from "@/lib/fairPrice/engine";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isListing(value: unknown): value is Listing {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.crop === "string" &&
    value.crop.length > 0 &&
    (value.grade === "A" || value.grade === "B" || value.grade === "C") &&
    typeof value.askingPrice === "number" &&
    Number.isFinite(value.askingPrice) &&
    value.askingPrice > 0 &&
    typeof value.distanceKm === "number" &&
    Number.isFinite(value.distanceKm) &&
    value.distanceKm >= 0 &&
    (value.transportCostPerKg === undefined ||
      (typeof value.transportCostPerKg === "number" &&
        Number.isFinite(value.transportCostPerKg) &&
        value.transportCostPerKg >= 0))
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    !Array.isArray(body.listings) ||
    body.listings.length === 0 ||
    body.listings.length > 100 ||
    !body.listings.every(isListing)
  ) {
    return NextResponse.json({ error: "Invalid listings." }, { status: 400 });
  }

  const listings = body.listings.map((listing) => ({
    ...listing,
    grade: listing.grade as Grade,
  }));
  return NextResponse.json(recommend(listings));
}
