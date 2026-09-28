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

/* ================================================================== */
/*  IDENTITY                                                          */
/* ================================================================== */

export async function sendIvrOtp(
  rawId: string
): Promise<IvrActionResult & { demoOtp?: string }> {
  const digits = rawId.replace(/\D/g, "");
  if (digits.length !== 6) {
    return { ok: false, error: "Please enter exactly 6 digits." };
  }

  const admin = createAdminClient();

  // Try KrishiLink ID first
  let profile: {
    id: string;
    phone: string | null;
    role: string;
    full_name: string;
    fpo_status: string | null;
    fpo_id: string | null;
  } | null = null;

  for (const c of [`KL-${digits}`, digits, `KL${digits}`, `kl-${digits}`]) {
    const { data } = await admin
      .from("profiles")
      .select("id, phone, role, full_name, fpo_status, fpo_id")
      .ilike("krishilink_id", c)
      .maybeSingle();
    if (data) {
      profile = data;
      break;
    }
  }

  // Try FPO ID (KF-XXXXXX)
  if (!profile) {
    for (const c of [`KF-${digits}`, `KF${digits}`, `kf-${digits}`]) {
      const { data } = await admin
        .from("profiles")
        .select("id, phone, role, full_name, fpo_status, fpo_id")
        .ilike("fpo_id", c)
        .maybeSingle();
      if (data) {
        profile = data;
        break;
      }
    }
  }

  if (!profile) {
    return {
      ok: false,
      error: `No account found for ${digits}. Use KL-XXXXXX or KF-XXXXXX.`,
    };
  }
  if (!profile.phone) {
    return { ok: false, error: "No phone number registered on this account." };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const otpKey = `IVR-${profile.id}`;

  await admin
    .from("ivr_otps")
    .update({ verified: true })
    .eq("krishilink_id", otpKey)
    .eq("verified", false);

  const { error: insertErr } = await admin.from("ivr_otps").insert({
    krishilink_id: otpKey,
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
      userId: profile.id,
    },
    demoOtp: otp,
  };
}

export async function verifyIvrOtp(
  rawId: string,
  rawOtp: string
): Promise<IvrActionResult> {
  const digits = rawId.replace(/\D/g, "").slice(0, 6);
  const otp = rawOtp.replace(/\D/g, "").slice(0, 6);

  if (digits.length !== 6) return { ok: false, error: "Invalid ID format." };
  if (otp.length !== 6) return { ok: false, error: "OTP must be 6 digits." };

  const admin = createAdminClient();

  let profile: {
    id: string;
    role: string;
    fpo_status: string | null;
    fpo_id: string | null;
    full_name: string;
  } | null = null;

  for (const c of [`KL-${digits}`, digits, `kl-${digits}`]) {
    const { data } = await admin
      .from("profiles")
      .select("id, role, fpo_status, fpo_id, full_name")
      .ilike("krishilink_id", c)
      .maybeSingle();
    if (data) {
      profile = data;
      break;
    }
  }
  if (!profile) {
    for (const c of [`KF-${digits}`, `kf-${digits}`]) {
      const { data } = await admin
        .from("profiles")
        .select("id, role, fpo_status, fpo_id, full_name")
        .ilike("fpo_id", c)
        .maybeSingle();
      if (data) {
        profile = data;
        break;
      }
    }
  }

  if (!profile) return { ok: false, error: "Account not found." };

  const otpKey = `IVR-${profile.id}`;
  const { data: rows } = await admin
    .from("ivr_otps")
    .select("id, otp, expires_at, verified")
    .eq("krishilink_id", otpKey)
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(1);

  const record = rows?.[0];
  if (!record) return { ok: false, error: "No active OTP." };
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "OTP expired." };
  }
  if (record.otp !== otp) return { ok: false, error: "Incorrect OTP." };

  await admin.from("ivr_otps").update({ verified: true }).eq("id", record.id);

  await admin.from("ivr_sessions").insert({
    farmer_phone: "verified",
    farmer_id: profile.id,
    flow_step: "OTP_VERIFY",
    input: `KL/KF-${digits}`,
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

/* ================================================================== */
/*  FARMER ROLE ACTIONS                                               */
/* ================================================================== */

export async function farmerCreateListing(
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
    flow_step: "FARMER_LIST",
    input: JSON.stringify(draft),
    result: `listing_created:${data.id}`,
  });

  return { ok: true, data: { listingId: data.id } };
}

export async function farmerLoadOffers(
  farmerId: string
): Promise<IvrActionResult> {
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
        _source: "listing" as const,
      };
    })
    .sort((a, b) => b.netPerKg - a.netPerKg)
    .slice(0, 3);

  return { ok: true, data: { offers: enriched, count: enriched.length } };
}

export async function farmerAcceptOffer(
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

/* ================================================================== */
/*  FPO ROLE ACTIONS                                                  */
/*  These create pools, not farmer listings.                          */
/* ================================================================== */

export async function fpoCreatePool(
  fpoHeadId: string,
  draft: {
    crop?: string;
    quantityKg?: number;
    grade?: "A" | "B" | "C";
    pricePerKg?: number;
  }
): Promise<IvrActionResult> {
  if (!fpoHeadId) return { ok: false, error: "Not authenticated." };
  if (!draft.crop || !draft.quantityKg || !draft.grade || !draft.pricePerKg) {
    return { ok: false, error: "Draft incomplete." };
  }

  const admin = createAdminClient();

  // 1. Verify FPO head
  const { data: head } = await admin
    .from("profiles")
    .select(
      "id, role, fpo_status, fpo_name, district, state, pincode, full_name"
    )
    .eq("id", fpoHeadId)
    .maybeSingle();

  if (!head) return { ok: false, error: "FPO head not found." };
  if (head.fpo_status !== "approved") {
    return { ok: false, error: "Your FPO is not approved yet." };
  }

  // 2. Fetch all active members
  const { data: activeMembers } = await admin
    .from("fpo_members")
    .select("member_id")
    .eq("fpo_id", fpoHeadId)
    .eq("status", "active")
    .not("member_id", "is", null);

  // 3. Build contributor list: head + all active members
  const contributorIds: string[] = [fpoHeadId];
  (activeMembers || []).forEach((m) => {
    if (m.member_id && m.member_id !== fpoHeadId) {
      contributorIds.push(m.member_id);
    }
  });

  // 4. Split total quantity equally
  const contributorCount = contributorIds.length;
  const shareQty = Number((draft.quantityKg / contributorCount).toFixed(2));

  // 5. Create the pool
  const { data: pool, error: poolErr } = await admin
    .from("fpo_pools")
    .insert({
      fpo_id: fpoHeadId,
      crop: draft.crop,
      total_quantity_kg: draft.quantityKg,
      quality_grade: draft.grade,
      district: head.district ?? "Unknown",
      state: head.state ?? "Unknown",
      pincode: head.pincode ?? null,
      expected_price_per_kg: draft.pricePerKg,
      notes: `Listed via IVR · ${contributorCount} contributors`,
      status: "active",
    })
    .select("id")
    .single();

  if (poolErr || !pool) {
    return {
      ok: false,
      error: poolErr?.message ?? "Could not create pool.",
    };
  }

  // 6. Insert contributions for every contributor
  const contributionRows = contributorIds.map((memberId) => ({
    pool_id: pool.id,
    member_id: memberId,
    quantity_kg: shareQty,
  }));

  const { error: contribErr } = await admin
    .from("fpo_pool_contributions")
    .insert(contributionRows);

  if (contribErr) {
    await admin.from("fpo_pools").delete().eq("id", pool.id);
    return { ok: false, error: contribErr.message };
  }

  // 7. Notify members (skip head — they created it)
  const memberIds = contributorIds.filter((id) => id !== fpoHeadId);
  if (memberIds.length > 0) {
    await admin.from("notifications").insert(
      memberIds.map((mid) => ({
        user_id: mid,
        kind: "fpo_pool_created",
        title: `You're in a new ${draft.crop} pool`,
        body: `${head.fpo_name} pooled ${draft.quantityKg} kg. Your share: ${shareQty} kg.`,
        link: "/farmer/fpo",
      }))
    );
  }

  await admin.from("ivr_sessions").insert({
    farmer_phone: "verified",
    farmer_id: fpoHeadId,
    flow_step: "FPO_POOL_LIST",
    input: JSON.stringify({ ...draft, contributors: contributorCount }),
    result: `pool_created:${pool.id}`,
  });

  return {
    ok: true,
    data: {
      poolId: pool.id,
      contributorCount,
      sharePerMember: shareQty,
    },
  };
}

export async function fpoLoadOffers(
  fpoHeadId: string
): Promise<IvrActionResult> {
  if (!fpoHeadId) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();

  // FPO's pools
  const { data: pools } = await admin
    .from("fpo_pools")
    .select("id, crop, quality_grade, district, state, total_quantity_kg")
    .eq("fpo_id", fpoHeadId);

  if (!pools || pools.length === 0) {
    return { ok: true, data: { offers: [], count: 0 } };
  }

  const poolIds = pools.map((p) => p.id);
  const poolMap = new Map(pools.map((p) => [p.id, p]));

  // Offers on pools
  const { data: offers } = await admin
    .from("offers")
    .select("id, pool_id, buyer_id, price_per_kg, quantity_kg, status")
    .in("pool_id", poolIds)
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
      const p = poolMap.get(o.pool_id)!;
      const b = buyerMap.get(o.buyer_id);
      const distance = estimateDistanceFromDistricts(
        p.district,
        p.state,
        b?.district ?? null,
        b?.state ?? null
      );
      // For pool offers, use flat net (no transport for IVR simplicity)
      const netPerKg = Number(
        (Number(o.price_per_kg) - TRANSACTION_COST_PER_KG).toFixed(2)
      );
      return {
        id: o.id,
        crop: p.crop,
        buyerName: b?.full_name ?? "Buyer",
        pricePerKg: Number(o.price_per_kg),
        quantityKg: Number(o.quantity_kg),
        netPerKg,
        _source: "pool" as const,
      };
    })
    .sort((a, b) => b.netPerKg - a.netPerKg)
    .slice(0, 3);

  return { ok: true, data: { offers: enriched, count: enriched.length } };
}

export async function fpoAcceptPoolOffer(
  fpoHeadId: string,
  offerId: string
): Promise<IvrActionResult> {
  if (!fpoHeadId) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: offer } = await admin
    .from("offers")
    .select(
      "id, pool_id, buyer_id, price_per_kg, quantity_kg, status, pool:fpo_pools(id, fpo_id, crop, status, district, state)"
    )
    .eq("id", offerId)
    .maybeSingle();

  if (!offer || !offer.pool_id) {
    return { ok: false, error: "Pool offer not found." };
  }

  const pool = Array.isArray(offer.pool) ? offer.pool[0] : offer.pool;
  if (!pool || pool.fpo_id !== fpoHeadId) {
    return { ok: false, error: "You don't own this pool." };
  }
  if (pool.status !== "active") {
    return { ok: false, error: "This pool is no longer active." };
  }
  if (offer.status !== "pending") {
    return { ok: false, error: "Offer already processed." };
  }

  const { data: contribs } = await admin
    .from("fpo_pool_contributions")
    .select("member_id, quantity_kg")
    .eq("pool_id", pool.id);

  if (!contribs || contribs.length === 0) {
    return { ok: false, error: "No member contributions found." };
  }

  const totalContrib = contribs.reduce(
    (s, c) => s + Number(c.quantity_kg),
    0
  );
  if (totalContrib <= 0) {
    return { ok: false, error: "Total contribution is zero." };
  }

  await admin.from("offers").update({ status: "accepted" }).eq("id", offerId);
  await admin
    .from("offers")
    .update({ status: "rejected" })
    .eq("pool_id", pool.id)
    .eq("status", "pending")
    .neq("id", offerId);
  await admin.from("fpo_pools").update({ status: "sold" }).eq("id", pool.id);

  const gross = Number(offer.price_per_kg) * Number(offer.quantity_kg);
  const txnCost = TRANSACTION_COST_PER_KG * Number(offer.quantity_kg);
  const netPool = gross - txnCost;

  const { data: txn, error: txnErr } = await admin
    .from("transactions")
    .insert({
      listing_id: null,
      offer_id: offerId,
      pool_id: pool.id,
      farmer_id: fpoHeadId,
      buyer_id: offer.buyer_id,
      final_price_per_kg: offer.price_per_kg,
      quantity_kg: offer.quantity_kg,
      logistics_cost_per_kg: 0,
      transaction_cost_per_kg: TRANSACTION_COST_PER_KG,
      net_realization_per_kg: Number(
        (netPool / Number(offer.quantity_kg)).toFixed(2)
      ),
      gross_amount: Number(gross.toFixed(2)),
      net_amount: Number(netPool.toFixed(2)),
      distance_km: 0,
      transport_mode: "krishilink",
      status: "escrow_pending",
    })
    .select("id")
    .single();

  if (txnErr || !txn) {
    return {
      ok: false,
      error: txnErr?.message ?? "Could not create transaction.",
    };
  }

  const payoutRows = contribs.map((c) => {
    const sharePct = (Number(c.quantity_kg) / totalContrib) * 100;
    const memberGross = (sharePct / 100) * gross;
    const memberTxn = (sharePct / 100) * txnCost;
    const memberNet = memberGross - memberTxn;
    return {
      pool_id: pool.id,
      transaction_id: txn.id,
      member_id: c.member_id,
      quantity_kg: Number(c.quantity_kg),
      share_pct: Number(sharePct.toFixed(2)),
      gross_amount: Number(memberGross.toFixed(2)),
      logistics_share: 0,
      txn_share: Number(memberTxn.toFixed(2)),
      net_payout: Number(memberNet.toFixed(2)),
      status: "pending" as const,
    };
  });

  const { error: payoutErr } = await admin
    .from("fpo_pool_payouts")
    .insert(payoutRows);

  if (payoutErr) return { ok: false, error: payoutErr.message };

  const memberIds = contribs.map((c) => c.member_id);
  await admin.from("notifications").insert(
    memberIds.map((mid) => ({
      user_id: mid,
      kind: "pool_sold",
      title: `Your ${pool.crop} pool sold via IVR`,
      body: "Your share will be released after buyer confirms delivery.",
      link: "/farmer/fpo",
    }))
  );

  await admin.from("notifications").insert({
    user_id: offer.buyer_id,
    kind: "offer_accepted",
    title: `Pool offer accepted: ${pool.crop}`,
    body: `FPO head accepted your ₹${offer.price_per_kg}/kg offer.`,
    link: "/buyer/orders",
  });

  return { ok: true, data: { accepted: true } };
}

/* ================================================================== */
/*  PRICES                                                            */
/* ================================================================== */

export async function loadIvrPrices(): Promise<IvrActionResult> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("mandi_prices")
    .select("crop, modal_price, market")
    .order("recorded_date", { ascending: false })
    .limit(5);
  return { ok: true, data: { prices: data || [] } };
}

/* ================================================================== */
/*  UTILITY                                                           */
/* ================================================================== */

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "XXXXXX";
  return "XXXXXX" + digits.slice(-4);
}

/* ================================================================== */
/*  FPO MEMBERS LOADER                                                */
/* ================================================================== */

export async function fpoLoadMembers(
  fpoHeadId: string
): Promise<IvrActionResult> {
  if (!fpoHeadId) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();

  // Verify FPO head is approved
  const { data: head } = await admin
    .from("profiles")
    .select("id, fpo_status, full_name")
    .eq("id", fpoHeadId)
    .maybeSingle();

  if (!head) return { ok: false, error: "FPO head not found." };
  if (head.fpo_status !== "approved") {
    return { ok: false, error: "Your FPO is not approved yet." };
  }

  // Load active members
  const { data: members } = await admin
    .from("fpo_members")
    .select("member_id, member_name, member_krishilink_id, status")
    .eq("fpo_id", fpoHeadId)
    .eq("status", "active");

  const list = (members || [])
    .filter((m) => m.member_id)
    .map((m) => ({
      id: m.member_id as string,
      name: m.member_name ?? "Member",
      krishilink_id: m.member_krishilink_id ?? "",
    }));

  return { ok: true, data: { members: list } };
}

/* ================================================================== */
/*  FPO CREATE POOL — with full contributions                         */
/* ================================================================== */

export async function fpoCreatePoolWithContributions(
  fpoHeadId: string,
  draft: {
    crop?: string;
    quantityKg?: number;
    grade?: "A" | "B" | "C";
    pricePerKg?: number;
    contributions: { memberId: string; memberName: string; quantityKg: number }[];
  }
): Promise<IvrActionResult> {
  if (!fpoHeadId) return { ok: false, error: "Not authenticated." };
  if (!draft.crop || !draft.quantityKg || !draft.grade || !draft.pricePerKg) {
    return { ok: false, error: "Draft incomplete." };
  }
  if (!draft.contributions || draft.contributions.length === 0) {
    return { ok: false, error: "No contributions recorded." };
  }

  const totalContrib = draft.contributions.reduce(
    (s, c) => s + c.quantityKg,
    0
  );
  if (Math.abs(totalContrib - draft.quantityKg) > 0.01) {
    return {
      ok: false,
      error: `Contributions (${totalContrib} kg) must equal pool total (${draft.quantityKg} kg).`,
    };
  }

  const admin = createAdminClient();

  // Verify FPO head
  const { data: head } = await admin
    .from("profiles")
    .select("id, fpo_status, fpo_name, district, state, pincode")
    .eq("id", fpoHeadId)
    .maybeSingle();

  if (!head) return { ok: false, error: "FPO head not found." };
  if (head.fpo_status !== "approved") {
    return { ok: false, error: "Your FPO is not approved yet." };
  }

  // Create pool
  const { data: pool, error: poolErr } = await admin
    .from("fpo_pools")
    .insert({
      fpo_id: fpoHeadId,
      crop: draft.crop,
      total_quantity_kg: draft.quantityKg,
      quality_grade: draft.grade,
      district: head.district ?? "Unknown",
      state: head.state ?? "Unknown",
      pincode: head.pincode ?? null,
      expected_price_per_kg: draft.pricePerKg,
      notes: "Listed via IVR by FPO head",
      status: "active",
    })
    .select("id")
    .single();

  if (poolErr || !pool) {
    return { ok: false, error: poolErr?.message ?? "Could not create pool." };
  }

  // Insert contributions
  const rows = draft.contributions
    .filter((c) => c.quantityKg > 0)
    .map((c) => ({
      pool_id: pool.id,
      member_id: c.memberId,
      quantity_kg: c.quantityKg,
    }));

  const { error: contribErr } = await admin
    .from("fpo_pool_contributions")
    .insert(rows);

  if (contribErr) {
    await admin.from("fpo_pools").delete().eq("id", pool.id);
    return { ok: false, error: contribErr.message };
  }

  // Log IVR session
  await admin.from("ivr_sessions").insert({
    farmer_phone: "verified",
    farmer_id: fpoHeadId,
    flow_step: "FPO_POOL_CREATE",
    input: JSON.stringify(draft),
    result: `pool_created:${pool.id}`,
  });

  // Notify contributing members (excluding the head)
  const memberIds = draft.contributions
    .map((c) => c.memberId)
    .filter((id) => id !== fpoHeadId);

  if (memberIds.length > 0) {
    await admin.from("notifications").insert(
      memberIds.map((mid) => ({
        user_id: mid,
        kind: "fpo_pool_created",
        title: `Added to ${draft.crop} pool`,
        body: `${head.fpo_name} pooled ${draft.crop} for collective sale. Your share will be calculated after the sale.`,
        link: "/farmer/fpo",
      }))
    );
  }

  return { ok: true, data: { poolId: pool.id } };
}

/* ================================================================== */
/*  BUYER IVR ACTIONS                                                 */
/* ================================================================== */

export async function buyerLoadListingsByCrop(
  crop: string
): Promise<IvrActionResult> {
  const admin = createAdminClient();

  const { data: listings } = await admin
    .from("listings")
    .select(
      "id, crop, quality_grade, quantity_kg, expected_price_per_kg, district, state, farmer_id"
    )
    .eq("status", "active")
    .ilike("crop", crop)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!listings || listings.length === 0) {
    return { ok: true, data: { listings: [], count: 0 } };
  }

  // Get farmer names for display
  const farmerIds = Array.from(new Set(listings.map((l) => l.farmer_id)));
  const { data: farmers } = await admin
    .from("profiles")
    .select("id, full_name, district, state")
    .in("id", farmerIds);
  const farmerMap = new Map((farmers || []).map((f) => [f.id, f]));

  // Take top 3
  const top = listings.slice(0, 3).map((l) => {
    const f = farmerMap.get(l.farmer_id);
    return {
      id: l.id,
      crop: l.crop,
      grade: l.quality_grade ?? "A",
      price: Number(l.expected_price_per_kg),
      quantity: Number(l.quantity_kg),
      district: l.district ?? f?.district ?? "—",
      farmerName: f?.full_name ?? "Farmer",
    };
  });

  return { ok: true, data: { listings: top, count: top.length } };
}

export async function buyerPlaceOffer(
  buyerId: string,
  listingId: string,
  pricePerKg: number,
  quantityKg: number
): Promise<IvrActionResult> {
  if (!buyerId) return { ok: false, error: "Not authenticated." };
  if (!listingId) return { ok: false, error: "No listing selected." };
  if (!pricePerKg || pricePerKg <= 0) {
    return { ok: false, error: "Invalid price." };
  }
  if (!quantityKg || quantityKg <= 0) {
    return { ok: false, error: "Invalid quantity." };
  }

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("id, crop, quantity_kg, status, farmer_id")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.status !== "active") {
    return { ok: false, error: "This listing is no longer active." };
  }
  if (quantityKg > Number(listing.quantity_kg)) {
    return {
      ok: false,
      error: `Only ${listing.quantity_kg} kg available.`,
    };
  }

  const { error: insertErr } = await admin.from("offers").insert({
    listing_id: listingId,
    pool_id: null,
    buyer_id: buyerId,
    price_per_kg: pricePerKg,
    quantity_kg: quantityKg,
    pickup_mode: "pickup",
    message: "Placed via IVR",
    status: "pending",
  });

  if (insertErr) {
    return { ok: false, error: insertErr.message };
  }

  await admin.from("notifications").insert({
    user_id: listing.farmer_id,
    kind: "new_offer",
    title: `New IVR offer on your ${listing.crop}`,
    body: `A buyer offered ₹${pricePerKg}/kg for ${quantityKg} kg via phone.`,
    link: "/farmer/offers",
  });

  await admin.from("ivr_sessions").insert({
    farmer_phone: "verified",
    farmer_id: buyerId,
    flow_step: "BUYER_PLACE_OFFER",
    input: JSON.stringify({ listingId, pricePerKg, quantityKg }),
    result: "offer_placed",
  });

  return { ok: true, data: { placed: true } };
}

export async function buyerLoadBids(
  buyerId: string
): Promise<IvrActionResult> {
  if (!buyerId) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: offers } = await admin
    .from("offers")
    .select(
      "id, price_per_kg, quantity_kg, status, created_at, listing:listings(crop)"
    )
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!offers || offers.length === 0) {
    return { ok: true, data: { bids: [], count: 0 } };
  }

  const bids = offers.map((o) => {
    const listing = Array.isArray(o.listing) ? o.listing[0] : o.listing;
    return {
      id: o.id,
      crop: listing?.crop ?? "—",
      price: Number(o.price_per_kg),
      quantity: Number(o.quantity_kg),
      status: o.status,
    };
  });

  return { ok: true, data: { bids, count: bids.length } };
}

export async function buyerLoadOrders(
  buyerId: string
): Promise<IvrActionResult> {
  if (!buyerId) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("transactions")
    .select(
      "id, gross_amount, status, created_at, listing:listings(crop), pool:fpo_pools(crop)"
    )
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!orders || orders.length === 0) {
    return { ok: true, data: { orders: [], count: 0 } };
  }

  const list = orders.map((o) => {
    const listing = Array.isArray(o.listing) ? o.listing[0] : o.listing;
    const pool = Array.isArray(o.pool) ? o.pool[0] : o.pool;
    const crop = listing?.crop ?? pool?.crop ?? "Order";
    return {
      id: o.id,
      crop,
      total: Number(o.gross_amount),
      status: o.status,
    };
  });

  return { ok: true, data: { orders: list, count: list.length } };
}