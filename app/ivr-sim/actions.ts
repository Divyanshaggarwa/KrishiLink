"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateNetRealization,
  estimateDistanceFromDistricts,
  TRANSACTION_COST_PER_KG,
  type QualityGrade,
} from "@/lib/netRealization";

export type IvrActionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/*  Look up user by KrishiLink ID + send OTP                          */
/*  Accepts ANY role — role-specific gating happens after OTP.        */
/* ------------------------------------------------------------------ */
export async function sendIvrOtp(
  rawId: string
): Promise<IvrActionResult & { demoOtp?: string }> {
  const digits = rawId.replace(/\D/g, "");

  if (digits.length !== 6) {
    return { ok: false, error: "Please enter exactly 6 digits." };
  }

  const admin = createAdminClient();
  const candidates = [
    `KL-${digits}`,
    digits,
    `KL${digits}`,
    `kl-${digits}`,
  ];

  let profile: {
    id: string;
    phone: string | null;
    role: string;
    full_name: string;
    fpo_status: string | null;
    fpo_id: string | null;
  } | null = null;

  for (const candidate of candidates) {
    const { data } = await admin
      .from("profiles")
      .select("id, phone, role, full_name, fpo_status, fpo_id")
      .ilike("krishilink_id", candidate)
      .maybeSingle();

    if (data) {
      profile = data;
      break;
    }
  }

  if (!profile) {
    return {
      ok: false,
      error: `No account found for KL-${digits}. Please check your KrishiLink ID.`,
    };
  }

  if (!profile.phone) {
    return {
      ok: false,
      error: "No phone number on this account. Contact support.",
    };
  }

  // Generate OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Invalidate prior unverified OTPs
  await admin
    .from("ivr_otps")
    .update({ verified: true })
    .eq("krishilink_id", `KL-${digits}`)
    .eq("verified", false);

  const { error: insertErr } = await admin.from("ivr_otps").insert({
    krishilink_id: `KL-${digits}`,
    phone: profile.phone,
    otp,
    expires_at: expiresAt,
  });

  if (insertErr) {
    return { ok: false, error: `Could not create OTP: ${insertErr.message}` };
  }

  return {
    ok: true,
    data: {
      phone: maskPhone(profile.phone),
      farmerName: profile.full_name,
      role: profile.role,
      fpoStatus: profile.fpo_status,
      fpoId: profile.fpo_id,
    },
    demoOtp: otp,
  };
}

/* ------------------------------------------------------------------ */
/*  Verify OTP → return farmerId + role info                          */
/* ------------------------------------------------------------------ */
export async function verifyIvrOtp(
  rawId: string,
  rawOtp: string
): Promise<IvrActionResult> {
  const digits = rawId.replace(/\D/g, "").slice(0, 6);
  const otp = rawOtp.replace(/\D/g, "").slice(0, 6);

  if (digits.length !== 6) {
    return { ok: false, error: "Invalid KrishiLink ID format." };
  }
  if (otp.length !== 6) {
    return { ok: false, error: "OTP must be 6 digits." };
  }

  const admin = createAdminClient();
  const krishilinkId = `KL-${digits}`;

  const { data: rows } = await admin
    .from("ivr_otps")
    .select("id, otp, expires_at, verified")
    .eq("krishilink_id", krishilinkId)
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(1);

  const record = rows?.[0];
  if (!record) {
    return { ok: false, error: "No active OTP. Please request a new one." };
  }
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "OTP expired. Please request a new one." };
  }
  if (record.otp !== otp) {
    return { ok: false, error: "Incorrect OTP." };
  }

  await admin.from("ivr_otps").update({ verified: true }).eq("id", record.id);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, fpo_status, fpo_id, full_name")
    .eq("krishilink_id", krishilinkId)
    .maybeSingle();

  if (!profile) {
    return { ok: false, error: "Account not found." };
  }

  await admin.from("ivr_sessions").insert({
    farmer_phone: "verified",
    farmer_id: profile.id,
    flow_step: "OTP_VERIFY",
    input: krishilinkId,
    result: "otp_verified",
  });

  return {
    ok: true,
    data: {
      farmerId: profile.id,
      role: profile.role,
      fpoStatus: profile.fpo_status,
      fpoId: profile.fpo_id,
      fullName: profile.full_name,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Create listing on behalf of the verified farmer                  */
/* ------------------------------------------------------------------ */
export async function finalizeIvrListing(
  farmerId: string,
  draft: {
    crop?: string;
    quantityKg?: number;
    grade?: "A" | "B" | "C";
    pricePerKg?: number;
  }
): Promise<IvrActionResult> {
  if (!farmerId) return { ok: false, error: "Not authenticated." };
  if (!draft.crop || !draft.quantityKg || !draft.grade || !draft.pricePerKg) {
    return { ok: false, error: "Draft incomplete." };
  }

  const admin = createAdminClient();

  const { data: farmer } = await admin
    .from("profiles")
    .select("role, district, state, pincode")
    .eq("id", farmerId)
    .maybeSingle();

  if (!farmer) return { ok: false, error: "Farmer not found." };

  const { data, error } = await admin
    .from("listings")
    .insert({
      farmer_id: farmerId,
      crop: draft.crop,
      quantity_kg: draft.quantityKg,
      quality_grade: draft.grade,
      expected_price_per_kg: draft.pricePerKg,
      district: farmer.district ?? "Unknown",
      state: farmer.state ?? "Unknown",
      pincode: farmer.pincode ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await admin.from("ivr_sessions").insert({
    farmer_phone: "verified",
    farmer_id: farmerId,
    flow_step: "LIST_CONFIRM",
    input: JSON.stringify(draft),
    result: `listing_created:${data.id}`,
  });

  return { ok: true, data: { listingId: data.id } };
}

/* ------------------------------------------------------------------ */
/*  Load top-3 pending offers for the farmer, ranked by net realization */
/* ------------------------------------------------------------------ */
export async function loadIvrOffers(farmerId: string): Promise<IvrActionResult> {
  if (!farmerId) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: listings } = await admin
    .from("listings")
    .select("id, crop, quantity_kg, quality_grade, district, state")
    .eq("farmer_id", farmerId);

  if (!listings || listings.length === 0) {
    return { ok: true, data: { offers: [], count: 0 } };
  }

  const listingIds = listings.map((l) => l.id);
  const listingMap = new Map(listings.map((l) => [l.id, l]));

  const { data: offers } = await admin
    .from("offers")
    .select("id, listing_id, buyer_id, price_per_kg, quantity_kg, status")
    .in("listing_id", listingIds)
    .eq("status", "pending");

  if (!offers || offers.length === 0) {
    return { ok: true, data: { offers: [], count: 0 } };
  }

  const buyerIds = Array.from(new Set(offers.map((o) => o.buyer_id)));
  const { data: buyers } = await admin
    .from("profiles")
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

/* ------------------------------------------------------------------ */
/*  Accept an offer                                                  */
/* ------------------------------------------------------------------ */
export async function acceptIvrOffer(
  farmerId: string,
  offerId: string
): Promise<IvrActionResult> {
  if (!farmerId) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: offer } = await admin
    .from("offers")
    .select(
      "id, buyer_id, price_per_kg, quantity_kg, listing_id, listing:listings(id, farmer_id, crop, district, state, quantity_kg, quality_grade)"
    )
    .eq("id", offerId)
    .maybeSingle();

  if (!offer) return { ok: false, error: "Offer not found." };

  const listing = Array.isArray(offer.listing)
    ? offer.listing[0]
    : offer.listing;
  if (!listing || listing.farmer_id !== farmerId) {
    return { ok: false, error: "You don't own this listing." };
  }

  await admin.from("offers").update({ status: "accepted" }).eq("id", offerId);
  await admin
    .from("offers")
    .update({ status: "rejected" })
    .eq("listing_id", listing.id)
    .eq("status", "pending")
    .neq("id", offerId);
  await admin
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listing.id);

  const [{ data: farmerProfile }, { data: buyerProfile }] = await Promise.all([
    admin
      .from("profiles")
      .select("district, state")
      .eq("id", farmerId)
      .single(),
    admin
      .from("profiles")
      .select("district, state")
      .eq("id", offer.buyer_id)
      .single(),
  ]);

  const distance = estimateDistanceFromDistricts(
    listing.district,
    listing.state,
    buyerProfile?.district ?? null,
    buyerProfile?.state ?? null
  );

  const transport = 0;
  const txn = TRANSACTION_COST_PER_KG;
  const netPerKg = Number(
    (Number(offer.price_per_kg) - transport - txn).toFixed(2)
  );
  const gross = Number(
    (Number(offer.price_per_kg) * Number(offer.quantity_kg)).toFixed(2)
  );
  const net = Number((netPerKg * Number(offer.quantity_kg)).toFixed(2));

  await admin.from("transactions").insert({
    listing_id: listing.id,
    offer_id: offerId,
    farmer_id: farmerId,
    buyer_id: offer.buyer_id,
    final_price_per_kg: offer.price_per_kg,
    quantity_kg: offer.quantity_kg,
    logistics_cost_per_kg: transport,
    transaction_cost_per_kg: txn,
    net_realization_per_kg: netPerKg,
    gross_amount: gross,
    net_amount: net,
    distance_km: distance,
    transport_mode: "self",
    status: "escrow_pending",
  });

  await admin.from("notifications").insert({
    user_id: offer.buyer_id,
    kind: "offer_accepted",
    title: `Your offer on ${listing.crop} was accepted via IVR`,
    body: `A farmer accepted your ₹${offer.price_per_kg}/kg offer over the phone.`,
    link: "/buyer/orders",
  });

  return { ok: true, data: { accepted: true } };
}

/* ------------------------------------------------------------------ */
/*  Load today's mandi prices                                        */
/* ------------------------------------------------------------------ */
export async function loadIvrPrices(): Promise<IvrActionResult> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("mandi_prices")
    .select("crop, modal_price, market")
    .order("recorded_date", { ascending: false })
    .limit(5);
  return { ok: true, data: { prices: data || [] } };
}

/* ------------------------------------------------------------------ */
/*  Utility                                                           */
/* ------------------------------------------------------------------ */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "XXXXXX";
  return "XXXXXX" + digits.slice(-4);
}