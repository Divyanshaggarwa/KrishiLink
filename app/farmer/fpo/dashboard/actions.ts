"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { loadFeeConfig } from "@/lib/nre/fetch-config";
import {
  calculateNetRealization,
  type QualityGrade,
} from "@/lib/netRealization";

export type PoolActionResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
};

/* ------------------------------------------------------------------ */
/*  Create pool                                                       */
/* ------------------------------------------------------------------ */
export async function createPoolAction(input: {
  crop: string;
  totalQuantityKg: number;
  qualityGrade: "A" | "B" | "C";
  expectedPricePerKg: number;
  notes: string;
  contributions: { memberId: string; quantityKg: number }[];
}): Promise<PoolActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "farmer") {
    return { ok: false, error: "Only farmers can create FPO pools." };
  }
  if (profile.fpo_status !== "approved" || !profile.fpo_id) {
    return { ok: false, error: "You must be an approved FPO head." };
  }

  const crop = input.crop.trim();
  if (!crop) return { ok: false, error: "Crop name is required." };
  if (!input.totalQuantityKg || input.totalQuantityKg <= 0) {
    return { ok: false, error: "Total quantity must be greater than 0." };
  }
  if (!input.expectedPricePerKg || input.expectedPricePerKg <= 0) {
    return { ok: false, error: "Expected price must be greater than 0." };
  }

  const totalContrib = input.contributions.reduce(
    (s, c) => s + c.quantityKg,
    0
  );
  if (Math.abs(totalContrib - input.totalQuantityKg) > 0.01) {
    return {
      ok: false,
      error: `Sum of member contributions (${totalContrib} kg) must equal the pool total (${input.totalQuantityKg} kg).`,
    };
  }

  const supabase = await createClient();

  const { data: pool, error: poolErr } = await supabase
    .from("fpo_pools")
    .insert({
      fpo_id: profile.id,
      crop,
      total_quantity_kg: input.totalQuantityKg,
      quality_grade: input.qualityGrade,
      district: profile.district ?? "—",
      state: profile.state ?? "—",
      pincode: profile.pincode,
      expected_price_per_kg: input.expectedPricePerKg,
      notes: input.notes || null,
      status: "active",
    })
    .select("id")
    .single();

  if (poolErr || !pool) {
    return { ok: false, error: poolErr?.message ?? "Could not create pool." };
  }

  const rows = input.contributions
    .filter((c) => c.quantityKg > 0)
    .map((c) => ({
      pool_id: pool.id,
      member_id: c.memberId,
      quantity_kg: c.quantityKg,
    }));

  const { error: contribErr } = await supabase
    .from("fpo_pool_contributions")
    .insert(rows);

  if (contribErr) {
    return { ok: false, error: contribErr.message };
  }

  const memberIds = input.contributions.map((c) => c.memberId);
  if (memberIds.length > 0) {
    await supabase.from("notifications").insert(
      memberIds.map((mid) => ({
        user_id: mid,
        kind: "fpo_pool_created",
        title: `Added to ${crop} pool`,
        body: `${profile.fpo_name} pooled ${crop} for collective sale.`,
        link: "/farmer/fpo",
      }))
    );
  }

  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/farmer/fpo");
  return { ok: true, data: { poolId: pool.id } };
}

/* ------------------------------------------------------------------ */
/*  Accept a buyer offer on a pool + split revenue                    */
/* ------------------------------------------------------------------ */
export async function acceptPoolOfferAction(
  _prev: PoolActionResult,
  formData: FormData
): Promise<PoolActionResult> {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    profile.role !== "farmer" ||
    profile.fpo_status !== "approved"
  ) {
    return { ok: false, error: "Only approved FPO heads can accept." };
  }

  const offerId = String(formData.get("offerId") || "");
  if (!offerId) return { ok: false, error: "Missing offer ID." };

  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select(
      "id, pool_id, buyer_id, price_per_kg, quantity_kg, status, pool:fpo_pools(id, fpo_id, crop, quality_grade, status)"
    )
    .eq("id", offerId)
    .single();

  if (!offer || !offer.pool_id) {
    return { ok: false, error: "Pool offer not found." };
  }

  const pool = Array.isArray(offer.pool) ? offer.pool[0] : offer.pool;
  if (!pool || pool.fpo_id !== profile.id) {
    return { ok: false, error: "You do not own this pool." };
  }
  if (pool.status !== "active") {
    return { ok: false, error: "This pool is no longer active." };
  }
  if (offer.status !== "pending") {
    return { ok: false, error: "Offer already processed." };
  }

  const { data: contribs } = await supabase
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

  await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);
  await supabase
    .from("offers")
    .update({ status: "rejected" })
    .eq("pool_id", pool.id)
    .eq("status", "pending")
    .neq("id", offerId);
  await supabase.from("fpo_pools").update({ status: "sold" }).eq("id", pool.id);

  const fees = await loadFeeConfig();
  const gross = Number(offer.price_per_kg) * Number(offer.quantity_kg);
  const poolGrade = (pool.quality_grade ?? "A") as QualityGrade;
  const farmerBreakdown = calculateNetRealization(
    {
      pricePerKg: Number(offer.price_per_kg),
      quantityKg: Number(offer.quantity_kg),
    },
    poolGrade,
    fees
  );
  const netPool = farmerBreakdown.netAmount;
  const buyerTotalPayable = Number(
    (
      gross +
      (gross * (fees.buyer_fee_pct + fees.gateway_pct)) / 100
    ).toFixed(2)
  );
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
    (farmerBreakdown.qualityDeduction * Number(offer.quantity_kg)).toFixed(2)
  );
  const platformFeeTotal = Number(
    (
      farmerFeeTotal +
      buyerFeeTotal +
      gatewayFeeTotal +
      handlingTotal +
      qualityDeductionTotal
    ).toFixed(2)
  );

  const { data: txn, error: txnErr } = await supabase
    .from("transactions")
    .insert({
      listing_id: null,
      offer_id: offerId,
      pool_id: pool.id,
      farmer_id: profile.id,
      buyer_id: offer.buyer_id,
      final_price_per_kg: offer.price_per_kg,
      quantity_kg: offer.quantity_kg,
      logistics_cost_per_kg: 0,
      transaction_cost_per_kg: 0,
      net_realization_per_kg: Number(
        (netPool / Number(offer.quantity_kg)).toFixed(2)
      ),
      gross_amount: Number(gross.toFixed(2)),
      net_amount: Number(netPool.toFixed(2)),
      distance_km: 0,
      transport_mode: "self",
      buyer_total_payable: buyerTotalPayable,
      transport_cost_total: 0,
      farmer_fee_total: farmerFeeTotal,
      buyer_fee_total: buyerFeeTotal,
      gateway_fee_total: gatewayFeeTotal,
      handling_total: handlingTotal,
      quality_deduction_total: qualityDeductionTotal,
      platform_fee_total: platformFeeTotal,
      transporter_fee_total: 0,
      transporter_payout_total: 0,
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
    const memberNet = (sharePct / 100) * netPool;
    return {
      pool_id: pool.id,
      transaction_id: txn.id,
      member_id: c.member_id,
      quantity_kg: Number(c.quantity_kg),
      share_pct: Number(sharePct.toFixed(2)),
      gross_amount: Number(memberGross.toFixed(2)),
      logistics_share: 0,
      txn_share: Number((memberGross - memberNet).toFixed(2)),
      net_payout: Number(memberNet.toFixed(2)),
      status: "pending" as const,
    };
  });

  const { error: payoutErr } = await supabase
    .from("fpo_pool_payouts")
    .insert(payoutRows);

  if (payoutErr) return { ok: false, error: payoutErr.message };

  const memberIds = contribs.map((c) => c.member_id);
  await supabase.from("notifications").insert(
    memberIds.map((mid) => ({
      user_id: mid,
      kind: "pool_sold",
      title: `Your ${pool.crop} pool has been sold`,
      body: "Your share will be released after buyer confirms delivery.",
      link: "/farmer/fpo",
    }))
  );

  await supabase.from("notifications").insert({
    user_id: offer.buyer_id,
    kind: "offer_accepted",
    title: `Pool offer accepted: ${pool.crop}`,
    body: `${profile.full_name} accepted your ₹${offer.price_per_kg}/kg offer.`,
    link: "/buyer/orders",
  });

  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/buyer/orders");
  return { ok: true };
}