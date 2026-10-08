"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { loadFeeConfig } from "@/lib/nre/fetch-config";
import {
  calculateNetRealization,
  type QualityGrade,
} from "@/lib/netRealization";
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

async function getAdvanceWalletState(
  admin: SupabaseClient,
  orderId: string,
  accountId: string,
  isFpo: boolean
): Promise<{
  hasAvailableAdvance: boolean;
  lockedAdvance: number;
  error?: string;
}> {
  let query = admin
    .from("wallet_transactions")
    .select("kind, amount")
    .eq("reference_id", orderId)
    .in("kind", ["advance_received", "pool_advance_received", "escrow_locked"]);

  query = isFpo
    ? query.eq("fpo_id", accountId).eq("wallet_type", "fpo")
    : query.eq("user_id", accountId);

  const { data, error } = await query;
  if (error) {
    return {
      hasAvailableAdvance: false,
      lockedAdvance: 0,
      error: `Could not check prior advance payments: ${error.message}`,
    };
  }

  const hasAvailableAdvance = (data ?? []).some((entry) =>
    ["advance_received", "pool_advance_received"].includes(entry.kind)
  );
  const lockedAdvance = (data ?? [])
    .filter((entry) => entry.kind === "escrow_locked")
    .reduce((total, entry) => total + Number(entry.amount), 0);

  if (!Number.isFinite(lockedAdvance) || lockedAdvance < 0) {
    return {
      hasAvailableAdvance,
      lockedAdvance: 0,
      error: "Could not read the order's previous wallet advance.",
    };
  }
  return { hasAvailableAdvance, lockedAdvance };
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
  platformFeeTotal: number;
  transporterFee: number;
  transporterPayout: number;
  grade: QualityGrade;
};

async function computeOrderBreakdown(
  order: {
    gross_amount: number | string;
    quantity_kg: number | string;
    logistics_cost_per_kg: number | string | null;
    transport_cost_total?: number | string | null;
    transport_mode?: string | null;
    buyer_total_payable?: number | string | null;
    farmer_fee_total?: number | string | null;
    buyer_fee_total?: number | string | null;
    gateway_fee_total?: number | string | null;
    handling_total?: number | string | null;
    quality_deduction_total?: number | string | null;
    platform_fee_total?: number | string | null;
    transporter_fee_total?: number | string | null;
    transporter_payout_total?: number | string | null;
    listing?: unknown;
    pool?: unknown;
  }
): Promise<OrderBreakdown> {
  const fees = await loadFeeConfig();

  const gross = Number(order.gross_amount);
  const quantity = Number(order.quantity_kg);
  const transportCost = Number(
    order.transport_cost_total ??
      Number(order.logistics_cost_per_kg || 0) * quantity
  );

  const listing = Array.isArray(order.listing)
    ? order.listing[0]
    : order.listing;
  const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;

  const rawGrade =
    (listing as { quality_grade?: string } | undefined)?.quality_grade ??
    (pool as { quality_grade?: string } | undefined)?.quality_grade ??
    "A";

  const grade: QualityGrade =
    rawGrade === "A" || rawGrade === "B" || rawGrade === "C"
      ? rawGrade
      : "A";

  const farmerBreakdown = calculateNetRealization(
    {
      pricePerKg: quantity > 0 ? gross / quantity : 0,
      quantityKg: quantity,
    },
    grade,
    fees
  );
  const farmerFee = r2(
    order.farmer_fee_total == null
      ? (gross * fees.farmer_fee_pct) / 100
      : Number(order.farmer_fee_total)
  );
  const gatewayFeeTotal = r2(
    order.gateway_fee_total == null
      ? (gross * fees.gateway_pct * 2) / 100
      : Number(order.gateway_fee_total)
  );
  const gatewayFeeFarmer = r2(gatewayFeeTotal / 2);
  const gatewayFeeBuyer = r2(gatewayFeeTotal - gatewayFeeFarmer);
  const handling = r2(
    order.handling_total == null
      ? fees.handling_per_kg * quantity
      : Number(order.handling_total)
  );
  const qualityDeduction = r2(
    order.quality_deduction_total == null
      ? farmerBreakdown.qualityDeduction * quantity
      : Number(order.quality_deduction_total)
  );
  const farmerNet = r2(
    gross - farmerFee - gatewayFeeFarmer - handling - qualityDeduction
  );

  const buyerFee = r2(
    order.buyer_fee_total == null
      ? (gross * fees.buyer_fee_pct) / 100
      : Number(order.buyer_fee_total)
  );
  const buyerTotal = r2(
    order.buyer_total_payable == null
      ? gross + buyerFee + gatewayFeeBuyer + transportCost
      : Number(order.buyer_total_payable)
  );

  const transporterFee = r2(
    order.transporter_fee_total == null
      ? order.transport_mode === "krishilink"
        ? (transportCost * fees.transporter_fee_pct) / 100
        : 0
      : Number(order.transporter_fee_total)
  );
  const transporterPayout = r2(
    order.transporter_payout_total == null
      ? transportCost - transporterFee
      : Number(order.transporter_payout_total)
  );
  const platformFeeTotal = r2(
    order.platform_fee_total == null
      ? farmerFee +
          gatewayFeeTotal +
          handling +
          qualityDeduction +
          buyerFee +
          transporterFee
      : Number(order.platform_fee_total)
  );

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
    platformFeeTotal,
    transporterFee,
    transporterPayout,
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
/*  PAY 30% ADVANCE — buyer pays 30% of crop value;                     */
/*  30% of farmer net is immediately available to the farmer.           */
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
      "id, buyer_id, farmer_id, pool_id, gross_amount, escrow_amount_paid, status, quantity_kg, logistics_cost_per_kg, transport_cost_total, transport_mode, transporter_id, listing:listings(crop, quality_grade), pool:fpo_pools(crop, quality_grade, fpo_id)"
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
  let transporterId = order.transporter_id;
  if (order.transport_mode === "krishilink" && !transporterId) {
    transporterId = await getPlatformAdminId(admin);
    if (!transporterId) {
      return {
        ok: false,
        error: "KrishiLink's transport payout account is not configured.",
      };
    }
  } else if (order.transport_mode === "self" && b.transportCost > 0) {
    transporterId = order.farmer_id;
  }

  const listing = Array.isArray(order.listing)
    ? order.listing[0]
    : order.listing;
  const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;
  const crop =
    (listing as { crop?: string } | undefined)?.crop ??
    (pool as { crop?: string } | undefined)?.crop ??
    "Order";

  // The buyer's 30% advance is paid out immediately; final fees settle on completion.
  const buyerDebit30 = r2(b.gross * 0.3);
  const farmerCredit30 = r2(b.farmerNet * 0.3);

  /* -------- 1. Debit buyer 30% -------- */
  const { error: debitErr } = await admin.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: buyerDebit30,
    p_kind: "escrow_paid",
    p_reference_id: order.id,
    p_description: `30% order advance · ${crop} · #${order.id.slice(0, 8)}`,
  });
  if (debitErr) {
    if (!debitErr.message.includes("duplicate key")) {
      return { ok: false, error: debitErr.message };
    }
  }

  /* -------- 2. Credit farmer (or FPO) 30% as available -------- */
  if (order.pool_id && pool && (pool as { fpo_id?: string }).fpo_id) {
    const fpoId = (pool as { fpo_id: string }).fpo_id;

    const { error: creditError } = await admin.rpc("fpo_wallet_credit", {
      p_fpo_id: fpoId,
      p_amount: farmerCredit30,
      p_kind: "pool_advance_received",
      p_reference_id: order.id,
      p_description: `30% advance · ${crop} pool`,
    });
    if (creditError && !creditError.message.includes("duplicate key")) {
      return { ok: false, error: creditError.message };
    }

    await admin.from("notifications").insert({
      user_id: fpoId,
      kind: "escrow_paid",
      title: "30% order advance received",
      body: `₹${farmerCredit30.toLocaleString("en-IN")} is available in the FPO wallet.`,
      link: "/farmer/fpo/dashboard/wallet",
    });
  } else {
    const { error: creditError } = await admin.rpc("wallet_credit", {
      p_user_id: order.farmer_id,
      p_amount: farmerCredit30,
      p_kind: "advance_received",
      p_reference_id: order.id,
      p_description: `30% order advance · ${crop}`,
    });
    if (creditError && !creditError.message.includes("duplicate key")) {
      return { ok: false, error: creditError.message };
    }

    await admin.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "escrow_paid",
      title: "30% order advance received",
      body: `₹${farmerCredit30.toLocaleString("en-IN")} is available in your wallet for ${crop}.`,
      link: "/wallet",
    });
  }

  /* -------- 3. Update transaction with new breakdown + status -------- */
  const { error: updateError } = await admin
    .from("transactions")
    .update({
      escrow_amount_paid: buyerDebit30,
      escrow_paid_at: new Date().toISOString(),
      status: "escrow_paid",
      transporter_id: transporterId,
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
  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/farmer/fpo/dashboard/wallet");
  revalidatePath("/admin");
  return { ok: true };
}

/* ==================================================================== */
/*  CONFIRM DELIVERY (70%) — buyer pays remaining balance;             */
/*  farmer receives the remaining 70% as available;                    */
/*  legacy locked advances are unlocked for orders created pre-change. */
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
      "id, buyer_id, farmer_id, pool_id, gross_amount, escrow_amount_paid, final_amount_paid, status, quantity_kg, logistics_cost_per_kg, transport_cost_total, transport_mode, transporter_id, listing:listings(crop, quality_grade), pool:fpo_pools(crop, quality_grade, fpo_id)"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }

  // Idempotency
  if (order.status === "completed") return { ok: true };
  if (order.status !== "delivered") {
    return { ok: false, error: "Admin hasn't marked this order as delivered yet." };
  }

  const b = await computeOrderBreakdown(order);
  const adminId = await getPlatformAdminId(admin);
  let transporterId = order.transporter_id;
  if (b.transportCost > 0 && order.transport_mode === "krishilink") {
    transporterId = transporterId ?? adminId;
    if (!transporterId) {
      return {
        ok: false,
        error: "KrishiLink's transport payout account is not configured.",
      };
    }
  } else if (b.transportCost > 0 && order.transport_mode === "self") {
    transporterId = transporterId ?? order.farmer_id;
  }
  if (
    b.platformFeeTotal > 0 &&
    !adminId
  ) {
    return { ok: false, error: "Platform fee wallet is not configured." };
  }
  if (b.transportCost > 0 && !transporterId) {
    return { ok: false, error: "Transport payout account is not configured." };
  }

  const listing = Array.isArray(order.listing)
    ? order.listing[0]
    : order.listing;
  const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;
  const crop =
    (listing as { crop?: string } | undefined)?.crop ??
    (pool as { crop?: string } | undefined)?.crop ??
    "Order";

  const buyerDebit70 = r2(
    Math.max(0, b.buyerTotal - Number(order.escrow_amount_paid || 0))
  );
  const isFpoOrder = Boolean(
    order.pool_id && pool && (pool as { fpo_id?: string }).fpo_id
  );
  const sellerWalletId = isFpoOrder
    ? (pool as { fpo_id: string }).fpo_id
    : order.farmer_id;
  const advanceState = await getAdvanceWalletState(
    admin,
    order.id,
    sellerWalletId,
    isFpoOrder
  );
  if (advanceState.error) return { ok: false, error: advanceState.error };
  const farmerFinalShare =
    advanceState.hasAvailableAdvance || advanceState.lockedAdvance > 0
      ? 0.7
      : 1;
  const farmerCreditFinal = r2(b.farmerNet * farmerFinalShare);

  /* -------- 1. Debit buyer 70% -------- */
  const { error: debitErr } = await admin.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: buyerDebit70,
    p_kind: "final_paid",
    p_reference_id: order.id,
    p_description: `Final 70% · ${crop} · #${order.id.slice(0, 8)}`,
  });
  if (debitErr) {
    if (!debitErr.message.includes("duplicate key")) {
      return { ok: false, error: debitErr.message };
    }
  }

  /* -------- 2. Credit seller; unlock only advances from the old flow -------- */
  if (order.pool_id && pool && (pool as { fpo_id?: string }).fpo_id) {
    const fpoId = (pool as { fpo_id: string }).fpo_id;

    if (advanceState.lockedAdvance > 0) {
      const { error: unlockError } = await admin.rpc("fpo_wallet_unlock", {
        p_fpo_id: fpoId,
        p_amount: advanceState.lockedAdvance,
        p_kind: "escrow_unlocked",
        p_reference_id: order.id,
        p_description: `Legacy advance unlocked · ${crop} pool`,
      });
      if (unlockError && !unlockError.message.includes("duplicate key")) {
        return { ok: false, error: unlockError.message };
      }
    }

    // Credit the remaining farmer share (or the full share for unreconciled legacy orders).
    const { error: creditError } = await admin.rpc("fpo_wallet_credit", {
      p_fpo_id: fpoId,
      p_amount: farmerCreditFinal,
      p_kind: "pool_received",
      p_reference_id: order.id,
      p_description: `${Math.round(farmerFinalShare * 100)}% final · ${crop} pool`,
    });
    if (creditError && !creditError.message.includes("duplicate key")) {
      return { ok: false, error: creditError.message };
    }

    // Now FPO wallet holds 100% of farmerNet — distribute to members
    const { data: payouts } = await admin
      .from("fpo_pool_payouts")
      .select("id, member_id, net_payout, quantity_kg, share_pct")
      .eq("transaction_id", order.id)
      .eq("status", "pending");

    if (payouts && payouts.length > 0) {
      for (const p of payouts) {
        const { error: debitError } = await admin.rpc("fpo_wallet_debit", {
          p_fpo_id: fpoId,
          p_amount: Number(p.net_payout),
          p_kind: "member_distribution",
          p_reference_id: order.id,
          p_description: `Share → member (${p.quantity_kg} kg · ${Number(p.share_pct).toFixed(1)}%)`,
        });
        if (debitError && !debitError.message.includes("duplicate key")) {
          return { ok: false, error: debitError.message };
        }

        const { error: memberCreditError } = await admin.rpc("wallet_credit", {
          p_user_id: p.member_id,
          p_amount: Number(p.net_payout),
          p_kind: "pool_share",
          p_reference_id: order.id,
          p_description: `Pool share · ${crop}`,
        });
        if (
          memberCreditError &&
          !memberCreditError.message.includes("duplicate key")
        ) {
          return { ok: false, error: memberCreditError.message };
        }

        const { error: payoutUpdateError } = await admin
          .from("fpo_pool_payouts")
          .update({ status: "released" })
          .eq("id", p.id);
        if (payoutUpdateError) {
          return { ok: false, error: payoutUpdateError.message };
        }

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
    if (advanceState.lockedAdvance > 0) {
      const { error: unlockError } = await admin.rpc("wallet_unlock", {
        p_user_id: order.farmer_id,
        p_amount: advanceState.lockedAdvance,
        p_kind: "escrow_unlocked",
        p_reference_id: order.id,
        p_description: `Legacy advance unlocked · ${crop} order`,
      });
      if (unlockError && !unlockError.message.includes("duplicate key")) {
        return { ok: false, error: unlockError.message };
      }
    }

    // Credit the remaining farmer share (or the full share for unreconciled legacy orders).
    const { error: creditError } = await admin.rpc("wallet_credit", {
      p_user_id: order.farmer_id,
      p_amount: farmerCreditFinal,
      p_kind: "payout_received",
      p_reference_id: order.id,
      p_description: `${Math.round(farmerFinalShare * 100)}% final · ${crop} order`,
    });
    if (creditError && !creditError.message.includes("duplicate key")) {
      return { ok: false, error: creditError.message };
    }

    await admin.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "payout_released",
      title: "Final payment released",
      body: `₹${r2(farmerCreditFinal + advanceState.lockedAdvance).toLocaleString("en-IN")} credited or unlocked in your wallet.`,
      link: "/wallet",
    });
  }

  /* -------- 3. Settle platform and transport charges at completion -------- */
  const platformFeeExcludingTransporterFee = r2(
    b.platformFeeTotal - b.transporterFee
  );
  if (platformFeeExcludingTransporterFee > 0 && adminId) {
    const { error } = await admin.rpc("wallet_credit", {
      p_user_id: adminId,
      p_amount: platformFeeExcludingTransporterFee,
      p_kind: "platform_fee_buyer",
      p_reference_id: order.id,
      p_description: `Completed-order platform fees · #${order.id.slice(0, 8)} (${crop})`,
    });
    if (error && !error.message.includes("duplicate key")) {
      return { ok: false, error: error.message };
    }
  }

  if (b.transportCost > 0 && transporterId) {
    const transportCredit =
      order.transport_mode === "krishilink"
        ? b.transporterPayout
        : b.transportCost;
    if (transportCredit > 0) {
      const { error } = await admin.rpc("wallet_credit", {
        p_user_id: transporterId,
        p_amount: transportCredit,
        p_kind:
          order.transport_mode === "krishilink"
            ? "transport_payout"
            : "transport_reimbursement",
        p_reference_id: order.id,
        p_description: `Completed-order transport payment · #${order.id.slice(0, 8)} (${crop})`,
      });
      if (error && !error.message.includes("duplicate key")) {
        return { ok: false, error: error.message };
      }
    }
    if (order.transport_mode === "krishilink" && b.transporterFee > 0 && adminId) {
      const { error } = await admin.rpc("wallet_credit", {
        p_user_id: adminId,
        p_amount: b.transporterFee,
        p_kind: "transporter_fee",
        p_reference_id: order.id,
        p_description: `KrishiLink transport fee · #${order.id.slice(0, 8)} (${crop})`,
      });
      if (error && !error.message.includes("duplicate key")) {
        return { ok: false, error: error.message };
      }
    }
  }

  /* -------- 4. Mark complete -------- */
  const { error: completionError } = await admin
    .from("transactions")
    .update({
      final_amount_paid: buyerDebit70,
      final_paid_at: new Date().toISOString(),
      transporter_id: transporterId,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (completionError) {
    return { ok: false, error: completionError.message };
  }

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