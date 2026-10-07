"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { loadFeeConfig, loadTransportRates } from "@/lib/nre/fetch-config";
import {
  calculateNetRealization,
  calculateTransportOptions,
  estimateDistanceFromDistricts,
  type TransportMode,
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
  const modeRaw = String(formData.get("transport_mode") || "krishilink");
  if (!["self", "krishilink"].includes(modeRaw)) {
    return { error: "Choose a valid delivery option." };
  }
  const transportMode: TransportMode =
    modeRaw === "self" ? "self" : "krishilink";
  const relistLeftover = formData.get("relist_leftover") === "on";

  if (!offerId) return { error: "Offer ID missing." };

  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select(
      "id, listing_id, buyer_id, price_per_kg, quantity_kg, pickup_mode, status, listing:listings(id, farmer_id, status, crop, quantity_kg, quality_grade, district, state)"
    )
    .eq("id", offerId)
    .single();

  if (!offer) return { error: "Offer not found." };

  const listing = Array.isArray(offer.listing) ? offer.listing[0] : offer.listing;
  if (!listing || listing.farmer_id !== profile.id) {
    return { error: "You don't own this listing." };
  }
  if (listing.status !== "active") {
    return { error: "This listing is no longer active." };
  }
  if (offer.status !== "pending") {
    return { error: "This offer is no longer pending." };
  }
  if (offer.quantity_kg > listing.quantity_kg) {
    return { error: "Offer quantity exceeds available stock." };
  }

  // Accept this offer
  await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);

  const remaining = Number(listing.quantity_kg) - Number(offer.quantity_kg);

  if (remaining <= 0) {
    // Fully sold — reject other pending, mark listing sold
    await supabase
      .from("offers")
      .update({ status: "rejected" })
      .eq("listing_id", listing.id)
      .eq("status", "pending")
      .neq("id", offerId);

    await supabase.from("listings").update({ status: "sold" }).eq("id", listing.id);
  } else if (relistLeftover) {
    // Partial + farmer chose to re-list → keep listing active, update qty
    await supabase
      .from("listings")
      .update({ quantity_kg: remaining, status: "active" })
      .eq("id", listing.id);

    // Auto-reject other pending offers that exceed the new remaining
    const { data: overOffers } = await supabase
      .from("offers")
      .select("id, quantity_kg")
      .eq("listing_id", listing.id)
      .eq("status", "pending");

    const toReject = (overOffers || [])
      .filter((o) => Number(o.quantity_kg) > remaining)
      .map((o) => o.id);

    if (toReject.length > 0) {
      await supabase.from("offers").update({ status: "rejected" }).in("id", toReject);
    }
  } else {
    // Partial + farmer declined to re-list → expire listing, reject others
    await supabase
      .from("listings")
      .update({ status: "expired", quantity_kg: remaining })
      .eq("id", listing.id);

    await supabase
      .from("offers")
      .update({ status: "rejected" })
      .eq("listing_id", listing.id)
      .eq("status", "pending")
      .neq("id", offerId);
  }

  // Distance + cost
  const [{ data: farmerProfile }, { data: buyerProfile }] = await Promise.all([
    supabase.from("profiles").select("district, state").eq("id", profile.id).single(),
    supabase.from("profiles").select("district, state").eq("id", offer.buyer_id).single(),
  ]);

  const distance = estimateDistanceFromDistricts(
    farmerProfile?.district ?? null,
    farmerProfile?.state ?? null,
    buyerProfile?.district ?? null,
    buyerProfile?.state ?? null
  );

  const [fees, transportRates] = await Promise.all([
    loadFeeConfig(),
    loadTransportRates(),
  ]);
  const requiresDelivery = offer.pickup_mode === "delivery";
  const transportOption = requiresDelivery
    ? calculateTransportOptions(
        Number(offer.quantity_kg),
        distance,
        transportRates
      )[0]
    : null;
  const transportCostTotal = transportOption?.totalCost ?? 0;
  const transport =
    offer.quantity_kg > 0 ? transportCostTotal / offer.quantity_kg : 0;
  const breakdown = calculateNetRealization(
    {
      pricePerKg: Number(offer.price_per_kg),
      quantityKg: Number(offer.quantity_kg),
    },
    (listing.quality_grade ?? "A") as "A" | "B" | "C",
    fees
  );
  const gross = breakdown.grossAmount;
  const netPerKg = breakdown.netRealizationPerKg;
  const net = breakdown.netAmount;
  const buyerTotalPayable = Number(
    (
      gross +
      (gross * (fees.buyer_fee_pct + fees.gateway_pct)) / 100 +
      transportCostTotal
    ).toFixed(2)
  );
  const transporterFeeTotal =
    requiresDelivery && transportMode === "krishilink"
      ? Number(
          ((transportCostTotal * fees.transporter_fee_pct) / 100).toFixed(2)
        )
      : 0;
  const farmerFeeTotal = Number(
    ((gross * fees.farmer_fee_pct) / 100).toFixed(2)
  );
  const buyerFeeTotal = Number(
    ((gross * fees.buyer_fee_pct) / 100).toFixed(2)
  );
  const gatewayFeeTotal = Number(
    ((gross * fees.gateway_pct * 2) / 100).toFixed(2)
  );
  const handlingTotal = Number(
    (fees.handling_per_kg * Number(offer.quantity_kg)).toFixed(2)
  );
  const qualityDeductionTotal = Number(
    (breakdown.qualityDeduction * Number(offer.quantity_kg)).toFixed(2)
  );
  const platformFeeTotal = Number(
    (
      farmerFeeTotal +
      buyerFeeTotal +
      gatewayFeeTotal +
      handlingTotal +
      qualityDeductionTotal +
      transporterFeeTotal
    ).toFixed(2)
  );
  let transporterId: string | null = null;
  if (requiresDelivery && transportMode === "krishilink") {
    const admin = createAdminClient();
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!adminProfile) {
      return { error: "KrishiLink's transport payout account is not configured." };
    }
    transporterId = adminProfile.id;
  } else if (requiresDelivery) {
    transporterId = profile.id;
  }

  const { error: transactionError } = await supabase.from("transactions").insert({
    listing_id: listing.id,
    offer_id: offerId,
    farmer_id: profile.id,
    buyer_id: offer.buyer_id,
    final_price_per_kg: offer.price_per_kg,
    quantity_kg: offer.quantity_kg,
    logistics_cost_per_kg: transport,
    transaction_cost_per_kg: 0,
    net_realization_per_kg: netPerKg,
    gross_amount: gross,
    net_amount: net,
    distance_km: distance,
    transport_mode: requiresDelivery ? transportMode : "self",
    transporter_id: transporterId,
    buyer_total_payable: buyerTotalPayable,
    transport_cost_total: transportCostTotal,
    farmer_fee_total: farmerFeeTotal,
    buyer_fee_total: buyerFeeTotal,
    gateway_fee_total: gatewayFeeTotal,
    handling_total: handlingTotal,
    quality_deduction_total: qualityDeductionTotal,
    platform_fee_total: platformFeeTotal,
    transporter_fee_total: transporterFeeTotal,
    transporter_payout_total: Number(
      (transportCostTotal - transporterFeeTotal).toFixed(2)
    ),
    status: "escrow_pending",
  });
  if (transactionError) {
    return { error: `Could not create the order: ${transactionError.message}` };
  }

  await supabase.from("notifications").insert({
    user_id: offer.buyer_id,
    kind: "offer_accepted",
    title: `Your offer on ${listing.crop} was accepted`,
    body: `${profile.full_name} accepted your ₹${offer.price_per_kg}/kg offer for ${offer.quantity_kg} kg.`,
    link: "/buyer/orders",
  });

  revalidatePath("/farmer/offers");
  revalidatePath("/farmer/listings");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer");
  revalidatePath("/buyer/bids");
  revalidatePath("/buyer/orders");
  revalidatePath("/buyer/browse");
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
  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select("id, buyer_id, listing:listings(farmer_id, crop)")
    .eq("id", offerId)
    .single();

  const listing = Array.isArray(offer?.listing) ? offer!.listing[0] : offer?.listing;
  if (!listing || listing.farmer_id !== profile.id) {
    return { error: "You don't own this listing." };
  }

  const { error } = await supabase
    .from("offers")
    .update({ status: "rejected" })
    .eq("id", offerId);
  if (error) return { error: error.message };

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

export async function requestCallAction(
  _prev: OfferActionResult,
  formData: FormData
): Promise<OfferActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated." };

  const offerId = String(formData.get("offerId") || "");
  const listingId = String(formData.get("listingId") || "");
  const receiverId = String(formData.get("receiverId") || "");
  const preferred = String(formData.get("preferred_time") || "");
  const notes = String(formData.get("notes") || "").trim();

  if (!offerId || !listingId || !receiverId) {
    return { error: "Missing required fields." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("call_requests").insert({
    offer_id: offerId,
    listing_id: listingId,
    requester_id: profile.id,
    receiver_id: receiverId,
    preferred_time: preferred ? new Date(preferred).toISOString() : null,
    notes: notes || null,
    status: "pending",
  });

  if (error) return { error: error.message };

  await supabase.from("notifications").insert({
    user_id: receiverId,
    kind: "call_request",
    title: "New call request",
    body: `${profile.full_name} wants to discuss your offer. Check Book a Call.`,
    link: "/farmer/offers",
  });

  revalidatePath("/farmer/offers");
  revalidatePath("/buyer/bids");
  return { ok: true };
}