"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { loadFeeConfig } from "@/lib/nre/fetch-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WalletActionResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
};

/* ------------------------------------------------------------------ */
/*  Platform admin lookup                                            */
/* ------------------------------------------------------------------ */
async function getPlatformAdminId(
  admin: SupabaseClient
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/* ------------------------------------------------------------------ */
/*  Compute full breakdown for an order                              */
/* ------------------------------------------------------------------ */
type OrderBreakdown = {
  gross: number;
  quantity: number;
  transportCost: number;
  farmerFee: number;
  gatewayFeeFarmer: number;
  handling: number;
  qualityDeduction: number;
  farmerNet: number;
  buyerFee: number;
  gatewayFeeBuyer: number;
  buyerTotal: number;
  platformEarnings: number;
  grade: "A" | "B" | "C";
};

async function computeOrderBreakdown(
  order: {
    gross_amount: number | string;
    quantity_kg: number | string;
    logistics_cost_per_kg: number | string | null;
    listing?: unknown;
    pool?: unknown;
  }
): Promise<OrderBreakdown> {
  const fees = await loadFeeConfig();

  const gross = Number(order.gross_amount);
  const quantity = Number(order.quantity_kg);
  const transportCost =
    Number(order.logistics_cost_per_kg || 0) * quantity;

  const listing = Array.isArray(order.listing)
    ? order.listing[0]
    : order.listing;
  const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;

  const rawGrade =
    (listing as { quality_grade?: string } | undefined)?.quality_grade ??
    (pool as { quality_grade?: string } | undefined)?.quality_grade ??
    "A";

  const grade: "A" | "B" | "C" =
    rawGrade === "A" || rawGrade === "B" || rawGrade === "C"
      ? rawGrade
      : "A";

  const gradeDeductionPerKg =
    grade === "A"
      ? fees.quality_deduction_A
      : grade === "B"
        ? fees.quality_deduction_B
        : fees.quality_deduction_C;

  const farmerFee = (gross * fees.farmer_fee_pct) / 100;
  const gatewayFeeFarmer = (gross * fees.gateway_pct) / 100;
  const handling = fees.handling_per_kg * quantity;
  const qualityDeduction = gradeDeductionPerKg * quantity;
  const farmerNet =
    gross - farmerFee - gatewayFeeFarmer - handling - qualityDeduction;

  const buyerFee = (gross * fees.buyer_fee_pct) / 100;
  const gatewayFeeBuyer = (gross * fees.gateway_pct) / 100;
  const buyerTotal = gross + buyerFee + gatewayFeeBuyer + transportCost;

  const platformEarnings = buyerTotal - farmerNet;

  return {
    gross: r2(gross),
    quantity,
    transportCost: r2(transportCost),
    farmerFee: r2(farmerFee),
    gatewayFeeFarmer: r2(gatewayFeeFarmer),
    handling: r2(handling),
    qualityDeduction: r2(qualityDeduction),
    farmerNet: r2(farmerNet),
    buyerFee: r2(buyerFee),
    gatewayFeeBuyer: r2(gatewayFeeBuyer),
    buyerTotal: r2(buyerTotal),
    platformEarnings: r2(platformEarnings),
    grade,
  };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/*  Top up                                                            */
/* ------------------------------------------------------------------ */
export async function topUpWallet(
  _prev: WalletActionResult,
  formData: FormData
): Promise<WalletActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }
  if (amount > 500000) {
    return { ok: false, error: "Max single top-up is ₹5,00,000." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("wallet_credit", {
    p_user_id: profile.id,
    p_amount: amount,
    p_kind: "topup",
    p_reference_id: null,
    p_description: `Wallet top-up of ₹${amount.toLocaleString("en-IN")}`,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/buyer");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Withdraw (respects locked balance — only available can be moved)  */
/* ------------------------------------------------------------------ */
export async function withdrawFromWallet(
  _prev: WalletActionResult,
  formData: FormData
): Promise<WalletActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }
  if (amount < 100) {
    return { ok: false, error: "Minimum withdrawal is ₹100." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: amount,
    p_kind: "withdrawal",
    p_reference_id: null,
    p_description: `Withdrawal to bank account`,
  });

  if (error) {
    if (error.message.includes("Insufficient available")) {
      return {
        ok: false,
        error:
          "Cannot withdraw locked escrow funds. Available balance only.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/wallet");
  revalidatePath("/farmer");
  return { ok: true };
}

/* ==================================================================== */
/*  PAY ESCROW (30%) — buyer debits full 30% of buyer_total;           */
/*  30% of farmer_net goes to farmer's LOCKED balance;                 */
/*  rest goes to platform admin (fees + transport)                     */
/* ==================================================================== */
export async function payEscrowFromWallet(
  _prev: WalletActionResult,
  formData: FormData
): Promise<WalletActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") {
    return { ok: false, error: "Only buyers can pay escrow." };
  }

  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return { ok: false, error: "Missing order." };

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("transactions")
    .select(
      "id, buyer_id, farmer_id, pool_id, gross_amount, escrow_amount_paid, status, quantity_kg, logistics_cost_per_kg, listing:listings(crop, quality_grade), pool:fpo_pools(crop, quality_grade, fpo_id)"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }

  // Idempotency
  if (
    order.status === "escrow_paid" ||
    order.status === "in_transit" ||
    order.status === "delivered" ||
    order.status === "completed"
  ) {
    return { ok: true };
  }
  if (order.status !== "escrow_pending") {
    return { ok: false, error: `Cannot pay escrow from status: ${order.status}` };
  }
  if (Number(order.escrow_amount_paid) > 0) return { ok: true };

  const b = await computeOrderBreakdown(order);

  const listing = Array.isArray(order.listing)
    ? order.listing[0]
    : order.listing;
  const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;
  const crop =
    (listing as { crop?: string } | undefined)?.crop ??
    (pool as { crop?: string } | undefined)?.crop ??
    "Order";

  // Splits
  const buyerDebit30 = r2(b.buyerTotal * 0.3);
  const farmerLocked30 = r2(b.farmerNet * 0.3);
  const adminCredit30 = r2(b.platformEarnings * 0.3);

  /* -------- 1. Debit buyer 30% -------- */
  const { error: debitErr } = await admin.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: buyerDebit30,
    p_kind: "escrow_paid",
    p_reference_id: order.id,
    p_description: `30% escrow · ${crop} · #${order.id.slice(0, 8)}`,
  });
  if (debitErr) {
    if (debitErr.message.includes("duplicate key")) return { ok: true };
    return { ok: false, error: debitErr.message };
  }

  /* -------- 2. Credit farmer (or FPO) 30% as LOCKED -------- */
  if (order.pool_id && pool && (pool as { fpo_id?: string }).fpo_id) {
    const fpoId = (pool as { fpo_id: string }).fpo_id;

    await admin.rpc("fpo_wallet_credit_locked", {
      p_fpo_id: fpoId,
      p_amount: farmerLocked30,
      p_kind: "escrow_locked",
      p_reference_id: order.id,
      p_description: `30% locked escrow · ${crop} pool`,
    });

    await admin.from("notifications").insert({
      user_id: fpoId,
      kind: "escrow_paid",
      title: "30% locked escrow received on FPO pool",
      body: `₹${farmerLocked30.toLocaleString("en-IN")} locked in FPO wallet until buyer confirms delivery.`,
      link: "/farmer/fpo/dashboard/wallet",
    });
  } else {
    await admin.rpc("wallet_credit_locked", {
      p_user_id: order.farmer_id,
      p_amount: farmerLocked30,
      p_kind: "escrow_locked",
      p_reference_id: order.id,
      p_description: `30% locked escrow · ${crop} order`,
    });

    await admin.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "escrow_paid",
      title: "30% locked escrow received",
      body: `₹${farmerLocked30.toLocaleString("en-IN")} locked in your wallet until buyer confirms delivery for ${crop}.`,
      link: "/wallet",
    });
  }

  /* -------- 3. Credit platform admin with the rest -------- */
  if (adminCredit30 > 0) {
    const adminId = await getPlatformAdminId(admin);
    if (adminId) {
      await admin.rpc("wallet_credit", {
        p_user_id: adminId,
        p_amount: adminCredit30,
        p_kind: "platform_fee_buyer",
        p_reference_id: order.id,
        p_description: `Platform + transport fees 30% · #${order.id.slice(0, 8)} (${crop})`,
      });
    }
  }

  /* -------- 4. Update transaction with new breakdown + status -------- */
  await admin
    .from("transactions")
    .update({
      escrow_amount_paid: buyerDebit30,
      escrow_paid_at: new Date().toISOString(),
      status: "escrow_paid",
      // Store the fee breakdown for audit
      buyer_total_payable: b.buyerTotal,
      transport_cost_total: b.transportCost,
      farmer_fee_total: b.farmerFee,
      buyer_fee_total: b.buyerFee,
      gateway_fee_total: r2(b.gatewayFeeFarmer + b.gatewayFeeBuyer),
      handling_total: b.handling,
      quality_deduction_total: b.qualityDeduction,
      net_amount: b.farmerNet,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/farmer/fpo/dashboard/wallet");
  revalidatePath("/admin");
  return { ok: true };
}

/* ==================================================================== */
/*  CONFIRM DELIVERY (70%) — buyer debits 70%; farmer's 30% unlocks;  */
/*  farmer's 70% credited as available; admin gets remaining fees     */
/* ==================================================================== */
export async function confirmDeliveryFromWallet(
  _prev: WalletActionResult,
  formData: FormData
): Promise<WalletActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") {
    return { ok: false, error: "Only buyers can confirm delivery." };
  }

  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return { ok: false, error: "Missing order." };

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("transactions")
    .select(
      "id, buyer_id, farmer_id, pool_id, gross_amount, escrow_amount_paid, final_amount_paid, status, quantity_kg, logistics_cost_per_kg, listing:listings(crop, quality_grade), pool:fpo_pools(crop, quality_grade, fpo_id)"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }

  // Idempotency
  if (order.status === "completed") return { ok: true };
  if (Number(order.final_amount_paid) > 0) {
    await admin
      .from("transactions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return { ok: true };
  }
  if (order.status !== "delivered") {
    return { ok: false, error: "Seller hasn't marked this as delivered yet." };
  }

  const b = await computeOrderBreakdown(order);

  const listing = Array.isArray(order.listing)
    ? order.listing[0]
    : order.listing;
  const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;
  const crop =
    (listing as { crop?: string } | undefined)?.crop ??
    (pool as { crop?: string } | undefined)?.crop ??
    "Order";

  const buyerDebit70 = r2(b.buyerTotal * 0.7);
  const farmerUnlock30 = r2(b.farmerNet * 0.3);
  const farmerCredit70 = r2(b.farmerNet * 0.7);
  const adminCredit70 = r2(b.platformEarnings * 0.7);

  /* -------- 1. Debit buyer 70% -------- */
  const { error: debitErr } = await admin.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: buyerDebit70,
    p_kind: "final_paid",
    p_reference_id: order.id,
    p_description: `Final 70% · ${crop} · #${order.id.slice(0, 8)}`,
  });
  if (debitErr) {
    if (debitErr.message.includes("duplicate key")) return { ok: true };
    return { ok: false, error: debitErr.message };
  }

  /* -------- 2. Unlock + credit seller -------- */
  if (order.pool_id && pool && (pool as { fpo_id?: string }).fpo_id) {
    const fpoId = (pool as { fpo_id: string }).fpo_id;

    // Unlock the 30% that was locked at escrow
    await admin.rpc("fpo_wallet_unlock", {
      p_fpo_id: fpoId,
      p_amount: farmerUnlock30,
      p_kind: "escrow_unlocked",
      p_reference_id: order.id,
      p_description: `Unlocked 30% · ${crop} pool`,
    });

    // Credit the 70%
    await admin.rpc("fpo_wallet_credit", {
      p_fpo_id: fpoId,
      p_amount: farmerCredit70,
      p_kind: "pool_received",
      p_reference_id: order.id,
      p_description: `70% final · ${crop} pool`,
    });

    // Now FPO wallet holds 100% of farmerNet — distribute to members
    const { data: payouts } = await admin
      .from("fpo_pool_payouts")
      .select("id, member_id, net_payout, quantity_kg, share_pct")
      .eq("transaction_id", order.id)
      .eq("status", "pending");

    if (payouts && payouts.length > 0) {
      for (const p of payouts) {
        await admin.rpc("fpo_wallet_debit", {
          p_fpo_id: fpoId,
          p_amount: Number(p.net_payout),
          p_kind: "member_distribution",
          p_reference_id: order.id,
          p_description: `Share → member (${p.quantity_kg} kg · ${Number(p.share_pct).toFixed(1)}%)`,
        });

        await admin.rpc("wallet_credit", {
          p_user_id: p.member_id,
          p_amount: Number(p.net_payout),
          p_kind: "pool_share",
          p_reference_id: order.id,
          p_description: `Pool share · ${crop}`,
        });

        await admin
          .from("fpo_pool_payouts")
          .update({ status: "released" })
          .eq("id", p.id);

        await admin.from("notifications").insert({
          user_id: p.member_id,
          kind: "payout_released",
          title: `${crop} pool share released`,
          body: `₹${Number(p.net_payout).toLocaleString("en-IN")} credited to your wallet.`,
          link: "/wallet",
        });
      }
    }
  } else {
    // Unlock farmer's 30%
    await admin.rpc("wallet_unlock", {
      p_user_id: order.farmer_id,
      p_amount: farmerUnlock30,
      p_kind: "escrow_unlocked",
      p_reference_id: order.id,
      p_description: `Unlocked 30% · ${crop} order`,
    });

    // Credit farmer's 70%
    await admin.rpc("wallet_credit", {
      p_user_id: order.farmer_id,
      p_amount: farmerCredit70,
      p_kind: "payout_received",
      p_reference_id: order.id,
      p_description: `70% final · ${crop} order`,
    });

    await admin.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "payout_released",
      title: "Final payment released",
      body: `₹${r2(farmerUnlock30 + farmerCredit70).toLocaleString("en-IN")} now available in your wallet.`,
      link: "/wallet",
    });
  }

  /* -------- 3. Credit admin 70% of platform fees -------- */
  if (adminCredit70 > 0) {
    const adminId = await getPlatformAdminId(admin);
    if (adminId) {
      await admin.rpc("wallet_credit", {
        p_user_id: adminId,
        p_amount: adminCredit70,
        p_kind: "platform_fee_buyer",
        p_reference_id: order.id,
        p_description: `Platform + transport fees 70% · #${order.id.slice(0, 8)} (${crop})`,
      });
    }
  }

  /* -------- 4. Mark complete -------- */
  await admin
    .from("transactions")
    .update({
      final_amount_paid: buyerDebit70,
      final_paid_at: new Date().toISOString(),
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  /* -------- 5. Trust bumps -------- */
  await admin.rpc("bump_trust", { p_user: order.farmer_id, p_delta: 2 });
  await admin.rpc("bump_trust", { p_user: order.buyer_id, p_delta: 2 });

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/admin");
  return { ok: true };
}