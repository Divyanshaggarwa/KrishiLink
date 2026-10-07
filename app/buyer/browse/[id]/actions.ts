"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { evaluateFairness } from "@/lib/ai";
import { redirect } from "next/navigation";

export type OfferState = { error?: string; ok?: boolean } | null;

export async function placeOfferAction(
  listingId: string,
  _prev: OfferState,
  formData: FormData
): Promise<OfferState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") {
    return { error: "Only buyers can place offers." };
  }

  const pricePerKg = Number(formData.get("price_per_kg"));
  const quantityKg = Number(formData.get("quantity_kg"));
  const pickupMode = String(formData.get("pickup_mode") || "pickup");
  const message = String(formData.get("message") || "").trim();

  if (!pricePerKg || pricePerKg <= 0) {
    return { error: "Please enter a valid price per kg." };
  }
  if (!quantityKg || quantityKg <= 0) {
    return { error: "Please enter a valid quantity." };
  }
  if (pickupMode !== "pickup" && pickupMode !== "delivery") {
    return { error: "Please choose a valid pickup mode." };
  }

  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "crop, quality_grade, quantity_kg, expected_price_per_kg, district, harvest_date, created_at, status"
    )
    .eq("id", listingId)
    .single();

  if (!listing) return { error: "Listing not found." };
  if (listing.status !== "active") {
    return { error: "This listing is no longer active." };
  }
  if (quantityKg > listing.quantity_kg) {
    return {
      error: `Only ${listing.quantity_kg} kg available on this listing.`,
    };
  }

  const harvestMonth = new Date(
    listing.harvest_date || listing.created_at
  ).getMonth() + 1;
  const quality =
    listing.quality_grade === "B" || listing.quality_grade === "C"
      ? listing.quality_grade
      : "A";
  const fairness = await evaluateFairness({
    crop: listing.crop,
    quality,
    quantityKg,
    district: listing.district,
    month: harvestMonth,
    farmerExpectedPrice: Number(listing.expected_price_per_kg),
    buyerBid: pricePerKg,
  });
  if (
    !Number.isFinite(fairness.fairLow) ||
    !Number.isFinite(fairness.fairHigh) ||
    fairness.fairLow > fairness.fairHigh
  ) {
    return { error: "Fair Price AI could not provide a valid price range. Please try again." };
  }
  if (
    pricePerKg < fairness.fairLow ||
    pricePerKg > fairness.fairHigh
  ) {
    return {
      error: `Your offer must be within Fair Price AI's range of ₹${fairness.fairLow.toFixed(2)}–₹${fairness.fairHigh.toFixed(2)}/kg.`,
    };
  }

  const { error: insertError } = await supabase.from("offers").insert({
    listing_id: listingId,
    buyer_id: profile.id,
    price_per_kg: pricePerKg,
    quantity_kg: quantityKg,
    pickup_mode: pickupMode,
    message: message || null,
    status: "pending",
  });

  if (insertError) {
    return { error: `Could not save offer: ${insertError.message}` };
  }

  redirect("/buyer/bids");
}