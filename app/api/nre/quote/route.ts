import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  loadFeeConfig,
  loadTransportRates,
  loadMandiPrice,
} from "@/lib/nre/fetch-config";
import {
  computeRealization,
  computeMandiBenchmark,
  estimateDistanceFromDistricts,
  type QualityGrade,
} from "@/lib/nre/helpers";

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  const offerPrice = Number(url.searchParams.get("offerPrice"));

  if (!listingId || !Number.isFinite(offerPrice) || offerPrice <= 0) {
    return NextResponse.json(
      { error: "listingId and offerPrice required" },
      { status: 400 }
    );
  }

  const supabase = await import("@/lib/supabase/server").then((m) =>
    m.createClient()
  );

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, crop, quantity_kg, quality_grade, district, state, farmer_id"
    )
    .eq("id", listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Distance: farmer district → buyer district (or buyer's home district)
  const distanceKm = estimateDistanceFromDistricts(
    listing.district,
    listing.state,
    profile.district ?? null,
    profile.state ?? null
  );

  const [feeConfig, transportRates, mandi] = await Promise.all([
    loadFeeConfig(),
    loadTransportRates(),
    loadMandiPrice(listing.crop),
  ]);

  const grade = (listing.quality_grade ?? "A") as QualityGrade;

  const realization = computeRealization({
    offerPricePerKg: offerPrice,
    quantityKg: listing.quantity_kg,
    distanceKm,
    grade,
    feeConfig,
    transportRates,
  });

  // Mandi benchmark (assume 60 km to mandi for demo, 6% APMC commission, 3% spoilage)
  const mandiBenchmark = mandi
    ? computeMandiBenchmark({
        mandiModalPricePerKg: mandi.modal_price,
        quantityKg: listing.quantity_kg,
        distanceToMandiKm: 60,
        transportRates,
        mandiCommissionPct: 6,
        spoilagePct: 3,
      })
    : null;

  const deltaVsMandi = mandiBenchmark
    ? Number((realization.netRealization - mandiBenchmark.mandiNet).toFixed(2))
    : null;

  return NextResponse.json({
    listingId: listing.id,
    crop: listing.crop,
    quantityKg: listing.quantity_kg,
    distanceKm,
    grade,
    offerPrice,
    realization,
    mandiBenchmark,
    mandiMarket: mandi?.market ?? null,
    mandiModalPrice: mandi?.modal_price ?? null,
    deltaVsMandi,
    feeConfig,
  });
}