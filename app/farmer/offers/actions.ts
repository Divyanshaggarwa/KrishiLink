"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  estimateDistanceFromDistricts,
  estimateTransportCostPerKg,
  TRANSACTION_COST_PER_KG,
} from "@/lib/netRealization";

export type OfferActionResult = { error?: string; ok?: boolean } | null;

export async function acceptOfferAction(
  _prev: OfferActionResult,
  formData: FormData
): Promise<OfferActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "farmer") {
    return { error: "Only farmers can accept offers." };
  }

  const offerId = String(formData.get("offerId") || "");
  if (!offerId) return { error: "Offer ID missing." };

  const supabase = await createClient();

  const { data: offer, error: offerErr } = await supabase
    .from("offers")
    .select(
      "id, listing_id, buyer_id, price_per_kg, quantity_kg, status, listing:listings!inner(id, farmer_id, status, crop)"
    )
    .eq("id", offerId)
    .single();

  if (offerErr || !offer) return { error: "Offer not found." };

  const listing = Array.isArray(offer.listing)
    ? offer.listing[0]
    : offer.listing;

  if (!listing || listing.farmer_id !== profile.id) {
    return { error: "You don't own this listing." };
  }
  if (listing.status !== "active") {
    return { error: "This listing is no longer active." };
  }
  if (offer.status !== "pending") {
    return { error: "This offer is no longer pending." };
  }

  // Accept this offer
  const { error: acceptErr } = await supabase
    .from("offers")
    .update({ status: "accepted" })
    .eq("id", offerId);
  if (acceptErr) return { error: acceptErr.message };

  // Reject all other pending offers on same listing
  await supabase
    .from("offers")
    .update({ status: "rejected" })
    .eq("listing_id", listing.id)
    .eq("status", "pending")
    .neq("id", offerId);

  // Mark listing as sold
  await supabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing.id);

  // Compute distance + cost
  const [{ data: farmerProfile }, { data: buyerProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("district, state")
      .eq("id", profile.id)
      .single(),
    supabase
      .from("profiles")
      .select("district, state")
      .eq("id", offer.buyer_id)
      .single(),
  ]);

  const distance = estimateDistanceFromDistricts(
    farmerProfile?.district ?? null,
    farmerProfile?.state ?? null,
    buyerProfile?.district ?? null,
    buyerProfile?.state ?? null
  );

  const transport = estimateTransportCostPerKg(distance, offer.quantity_kg);
  const txn = TRANSACTION_COST_PER_KG;
  const netPerKg = Number((offer.price_per_kg - transport - txn).toFixed(2));
  const gross = Number((offer.price_per_kg * offer.quantity_kg).toFixed(2));
  const net = Number((netPerKg * offer.quantity_kg).toFixed(2));

  const { error: txnErr } = await supabase.from("transactions").insert({
    listing_id: listing.id,
    offer_id: offerId,
    farmer_id: profile.id,
    buyer_id: offer.buyer_id,
    final_price_per_kg: offer.price_per_kg,
    quantity_kg: offer.quantity_kg,
    logistics_cost_per_kg: transport,
    transaction_cost_per_kg: txn,
    net_realization_per_kg: netPerKg,
    gross_amount: gross,
    net_amount: net,
    distance_km: distance,
    status: "escrow_pending",
  });

  if (txnErr) {
    return {
      error: `Deal accepted, but transaction log failed: ${txnErr.message}`,
    };
  }

  // Notify the buyer
  await supabase.from("notifications").insert({
    user_id: offer.buyer_id,
    kind: "offer_accepted",
    title: `Your offer on ${listing.crop} was accepted`,
    body: `${profile.full_name} accepted your ₹${offer.price_per_kg}/kg offer for ${offer.quantity_kg} kg.`,
    link: "/buyer/orders",
  });

  // Revalidate both sides
  revalidatePath("/farmer/offers");
  revalidatePath("/farmer/listings");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer");
  revalidatePath("/buyer/bids");
  revalidatePath("/buyer/orders");
  revalidatePath("/buyer");

  return { ok: true };
}

export async function rejectOfferAction(
  _prev: OfferActionResult,
  formData: FormData
): Promise<OfferActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "farmer") {
    return { error: "Only farmers can reject offers." };
  }

  const offerId = String(formData.get("offerId") || "");
  if (!offerId) return { error: "Offer ID missing." };

  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select("id, buyer_id, listing:listings!inner(farmer_id, crop)")
    .eq("id", offerId)
    .single();

  const listing = Array.isArray(offer?.listing)
    ? offer!.listing[0]
    : offer?.listing;

  if (!listing || listing.farmer_id !== profile.id) {
    return { error: "You don't own this listing." };
  }

  const { error } = await supabase
    .from("offers")
    .update({ status: "rejected" })
    .eq("id", offerId);

  if (error) return { error: error.message };

  // Notify buyer
  if (offer?.buyer_id) {
    await supabase.from("notifications").insert({
      user_id: offer.buyer_id,
      kind: "offer_rejected",
      title: `Your offer on ${listing.crop} was declined`,
      body: "The farmer rejected this offer. You can place a new bid.",
      link: "/buyer/bids",
    });
  }

  revalidatePath("/farmer/offers");
  revalidatePath("/buyer/bids");
  return { ok: true };
}