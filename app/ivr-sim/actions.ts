"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { CROPS } from "@/lib/ivr/stateMachine";
import { calculateNetRealization, estimateDistanceFromDistricts, type QualityGrade } from "@/lib/netRealization";

export type IvrActionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

/** Called after WELCOME → confirm listing is created. */
export async function finalizeIvrListing(draft: {
  crop?: string;
  quantityKg?: number;
  grade?: "A" | "B" | "C";
  pricePerKg?: number;
}): Promise<IvrActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "farmer") {
    return { ok: false, error: "IVR listing requires a farmer session." };
  }

  if (!draft.crop || !draft.quantityKg || !draft.grade || !draft.pricePerKg) {
    return { ok: false, error: "Draft is incomplete." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("listings")
    .insert({
      farmer_id: profile.id,
      crop: draft.crop,
      quantity_kg: draft.quantityKg,
      quality_grade: draft.grade,
      expected_price_per_kg: draft.pricePerKg,
      district: profile.district ?? "Unknown",
      state: profile.state ?? "Unknown",
      pincode: profile.pincode ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await supabase.from("ivr_sessions").insert({
    farmer_phone: profile.phone ?? "unknown",
    farmer_id: profile.id,
    flow_step: "LIST_CONFIRM",
    input: JSON.stringify(draft),
    result: `listing_created:${data.id}`,
  });

  return { ok: true, data: { listingId: data.id } };
}

/** Called when farmer reaches OFFERS_LIST. Returns top offers ranked by net. */
export async function loadIvrOffers(): Promise<IvrActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "farmer") {
    return { ok: false, error: "Not a farmer." };
  }

  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, crop, quantity_kg, quality_grade, district, state")
    .eq("farmer_id", profile.id);

  if (!listings || listings.length === 0) {
    return { ok: true, data: { offers: [], count: 0 } };
  }

  const listingIds = listings.map((l) => l.id);
  const listingMap = new Map(listings.map((l) => [l.id, l]));

  const { data: offers } = await supabase
    .from("offers")
    .select("id, listing_id, buyer_id, price_per_kg, quantity_kg, status")
    .in("listing_id", listingIds)
    .eq("status", "pending");

  if (!offers || offers.length === 0) {
    return { ok: true, data: { offers: [], count: 0 } };
  }

  const buyerIds = Array.from(new Set(offers.map((o) => o.buyer_id)));
  const { data: buyers } = await supabase
    .from("public_profiles")
    .select("id, full_name, district, state")
    .in("id", buyerIds);
  const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

  const enriched = offers
    .map((o) => {
      const l = listingMap.get(o.listing_id)!;
      const b = buyerMap.get(o.buyer_id);
      const distance = estimateDistanceFromDistricts(
        l.district,
        l.state,
        b?.district ?? null,
        b?.state ?? null
      );
      const breakdown = calculateNetRealization(
        {
          pricePerKg: Number(o.price_per_kg),
          quantityKg: Number(o.quantity_kg),
          distanceKm: distance,
        },
        (l.quality_grade ?? "A") as QualityGrade
      );
      return {
        id: o.id,
        crop: l.crop,
        buyerName: b?.full_name ?? "Buyer",
        pricePerKg: Number(o.price_per_kg),
        quantityKg: Number(o.quantity_kg),
        netPerKg: breakdown.netRealizationPerKg,
      };
    })
    .sort((a, b) => b.netPerKg - a.netPerKg)
    .slice(0, 3);

  return { ok: true, data: { offers: enriched, count: enriched.length } };
}

/** Called when farmer presses 2 (accept) on an offer. */
export async function acceptIvrOffer(
  offerId: string
): Promise<IvrActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "farmer") {
    return { ok: false, error: "Not a farmer." };
  }

  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select("id, buyer_id, price_per_kg, quantity_kg, listing:listings(id, farmer_id, crop)")
    .eq("id", offerId)
    .single();

  if (!offer) return { ok: false, error: "Offer not found." };
  const listing = Array.isArray(offer.listing) ? offer.listing[0] : offer.listing;
  if (!listing || listing.farmer_id !== profile.id) {
    return { ok: false, error: "Not your offer." };
  }

  await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);
  await supabase
    .from("offers")
    .update({ status: "rejected" })
    .eq("listing_id", listing.id)
    .eq("status", "pending")
    .neq("id", offerId);
  await supabase.from("listings").update({ status: "sold" }).eq("id", listing.id);

  await supabase.from("notifications").insert({
    user_id: offer.buyer_id,
    kind: "offer_accepted",
    title: `Your offer on ${listing.crop} was accepted via IVR`,
    body: `${profile.full_name} accepted your ₹${offer.price_per_kg}/kg offer.`,
    link: "/buyer/orders",
  });

  return { ok: true, data: { accepted: true } };
}

/** Called on PRICES_MENU to fetch mandi rates. */
export async function loadIvrPrices(): Promise<IvrActionResult> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mandi_prices")
    .select("crop, modal_price, market")
    .order("recorded_date", { ascending: false })
    .limit(5);

  return { ok: true, data: { prices: data || [] } };
}