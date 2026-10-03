"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type WalletActionResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
};

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
/*  Withdraw                                                          */
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

  if (error) return { ok: false, error: error.message };

  revalidatePath("/wallet");
  revalidatePath("/farmer");
  return { ok: true };
}

/* ==================================================================== */
/*  PAY ESCROW (30%) — Buyer pays, SELLER GETS 30% OF NET IMMEDIATELY   */
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
      "id, buyer_id, farmer_id, pool_id, gross_amount, net_amount, escrow_amount_paid, status, listing:listings(crop), pool:fpo_pools(crop, fpo_id)"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }

  // Idempotency: already paid
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
  if (Number(order.escrow_amount_paid) > 0) {
    return { ok: true };
  }

  const grossAmount = Number(order.gross_amount);
  const netAmount = Number(order.net_amount || order.gross_amount);
  const advance = Number((grossAmount * 0.3).toFixed(2));
  const netAdvance = Number((netAmount * 0.3).toFixed(2));

  const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing;
  const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;
  const crop = listing?.crop ?? pool?.crop ?? "Order";

  /* -------- 1. Debit buyer -------- */
  const { error: debitErr } = await admin.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: advance,
    p_kind: "escrow_paid",
    p_reference_id: order.id,
    p_description: `30% escrow on order #${order.id.slice(0, 8)} (${crop})`,
  });

  if (debitErr) {
    if (debitErr.message.includes("duplicate key")) {
      return { ok: true };
    }
    return { ok: false, error: debitErr.message };
  }

  /* -------- 2. Credit seller(s) with 30% of net -------- */

  if (order.pool_id && pool?.fpo_id) {
    // FPO pool → credit FPO wallet with 30% of net
    const { error: fpoErr } = await admin.rpc("fpo_wallet_credit", {
      p_fpo_id: pool.fpo_id,
      p_amount: netAdvance,
      p_kind: "pool_received",
      p_reference_id: order.id,
      p_description: `30% advance · ${crop} pool #${order.id.slice(0, 8)}`,
    });

    if (fpoErr) {
      return { ok: false, error: `FPO credit failed: ${fpoErr.message}` };
    }

    // Notify FPO head
    await admin.from("notifications").insert({
      user_id: pool.fpo_id,
      kind: "escrow_paid",
      title: "30% advance received on FPO pool",
      body: `₹${netAdvance.toLocaleString("en-IN")} credited to FPO wallet from ${crop} pool sale.`,
      link: "/farmer/fpo/dashboard/wallet",
    });
  } else {
    // Regular listing → credit farmer with 30% of net
    const { error: farmerErr } = await admin.rpc("wallet_credit", {
      p_user_id: order.farmer_id,
      p_amount: netAdvance,
      p_kind: "payout_received",
      p_reference_id: order.id,
      p_description: `30% advance · ${crop} order #${order.id.slice(0, 8)}`,
    });

    if (farmerErr) {
      return { ok: false, error: `Farmer credit failed: ${farmerErr.message}` };
    }

    await admin.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "escrow_paid",
      title: "30% advance received",
      body: `₹${netAdvance.toLocaleString("en-IN")} credited to your wallet for ${crop} order. Balance releases after delivery.`,
      link: "/wallet",
    });
  }

  /* -------- 3. Update transaction -------- */
  const { error: updErr } = await admin
    .from("transactions")
    .update({
      escrow_amount_paid: advance,
      escrow_paid_at: new Date().toISOString(),
      status: "escrow_paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updErr) {
    return { ok: false, error: `Update failed: ${updErr.message}` };
  }

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/farmer/fpo/dashboard/wallet");
  return { ok: true };
}

/* ==================================================================== */
/*  CONFIRM DELIVERY (70%) — Buyer pays, SELLER GETS REMAINING 70%      */
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
      "id, buyer_id, farmer_id, pool_id, gross_amount, net_amount, escrow_amount_paid, final_amount_paid, status, listing:listings(crop), pool:fpo_pools(crop, fpo_id)"
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
    revalidatePath("/buyer/orders");
    revalidatePath("/wallet");
    return { ok: true };
  }
  if (order.status !== "delivered") {
    return { ok: false, error: "Seller hasn't marked this as delivered yet." };
  }

  const grossAmount = Number(order.gross_amount);
  const netAmount = Number(order.net_amount || order.gross_amount);
  const finalGross = Number(
    (grossAmount - Number(order.escrow_amount_paid || 0)).toFixed(2)
  );
  const finalNet = Number((netAmount * 0.7).toFixed(2));

  const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing;
  const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;
  const crop = listing?.crop ?? pool?.crop ?? "Order";

  /* -------- 1. Debit buyer 70% -------- */
  const { error: debitErr } = await admin.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: finalGross,
    p_kind: "final_paid",
    p_reference_id: order.id,
    p_description: `Final 70% on order #${order.id.slice(0, 8)} (${crop})`,
  });

  if (debitErr) {
    if (debitErr.message.includes("duplicate key")) return { ok: true };
    return { ok: false, error: debitErr.message };
  }

  /* -------- 2. Credit seller(s) with remaining 70% of net -------- */

  if (order.pool_id && pool?.fpo_id) {
    // FPO pool → credit FPO wallet with 70%
    const { error: fpoErr } = await admin.rpc("fpo_wallet_credit", {
      p_fpo_id: pool.fpo_id,
      p_amount: finalNet,
      p_kind: "pool_received",
      p_reference_id: order.id,
      p_description: `70% final · ${crop} pool #${order.id.slice(0, 8)}`,
    });

    if (fpoErr) {
      return { ok: false, error: `FPO credit failed: ${fpoErr.message}` };
    }

    // Now distribute FULL payouts to members (100% of their share)
    // FPO wallet has received 30% + 70% = 100% of net now
    const { data: payouts } = await admin
      .from("fpo_pool_payouts")
      .select("id, member_id, net_payout, quantity_kg, share_pct")
      .eq("transaction_id", order.id)
      .eq("status", "pending");

    if (payouts && payouts.length > 0) {
      for (const p of payouts) {
        // Debit FPO wallet, credit member personal wallet
        await admin.rpc("fpo_wallet_debit", {
          p_fpo_id: pool.fpo_id,
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
    // Regular listing → credit farmer with 70%
    const { error: farmerErr } = await admin.rpc("wallet_credit", {
      p_user_id: order.farmer_id,
      p_amount: finalNet,
      p_kind: "payout_received",
      p_reference_id: order.id,
      p_description: `70% final · ${crop} order #${order.id.slice(0, 8)}`,
    });

    if (farmerErr) {
      return { ok: false, error: `Farmer credit failed: ${farmerErr.message}` };
    }

    await admin.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "payout_released",
      title: "Final payment released",
      body: `₹${finalNet.toLocaleString("en-IN")} credited. Order complete.`,
      link: "/wallet",
    });
  }

  /* -------- 3. Mark complete -------- */
  const { error: updErr } = await admin
    .from("transactions")
    .update({
      final_amount_paid: finalGross,
      final_paid_at: new Date().toISOString(),
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updErr) return { ok: false, error: updErr.message };

  /* -------- 4. Trust bumps -------- */
  await admin.rpc("bump_trust", { p_user: order.farmer_id, p_delta: 2 });
  await admin.rpc("bump_trust", { p_user: order.buyer_id, p_delta: 2 });

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/farmer/fpo/dashboard/wallet");
  return { ok: true };
}