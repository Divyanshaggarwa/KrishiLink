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
/*  Top up wallet                                                     */
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
/*  Withdraw to bank                                                  */
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

/* ------------------------------------------------------------------ */
/*  Pay escrow (30%) from wallet — BUYER only, with idempotency       */
/* ------------------------------------------------------------------ */
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

  // Use admin client to bypass any RLS edge cases
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("transactions")
    .select(
      "id, buyer_id, farmer_id, pool_id, gross_amount, escrow_amount_paid, status"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }

  // === Idempotency guard ===
  if (order.status !== "escrow_pending") {
    if (
      order.status === "escrow_paid" ||
      order.status === "in_transit" ||
      order.status === "delivered" ||
      order.status === "completed"
    ) {
      // Already paid — treat as success, do nothing
      return { ok: true };
    }
    return { ok: false, error: "Escrow cannot be paid in this state." };
  }
  if (Number(order.escrow_amount_paid) > 0) {
    // Already paid per field — heal the status
    await admin
      .from("transactions")
      .update({ status: "escrow_paid", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    revalidatePath("/buyer/orders");
    revalidatePath("/wallet");
    return { ok: true };
  }

  const advance = Number((Number(order.gross_amount) * 0.3).toFixed(2));

  // 1. Debit buyer wallet (RPC with SECURITY DEFINER — works fine)
  const { error: debitErr } = await admin.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: advance,
    p_kind: "escrow_paid",
    p_reference_id: order.id,
    p_description: `30% escrow on order #${order.id.slice(0, 8)}`,
  });

  if (debitErr) {
    // Unique constraint violation = already processed
    if (debitErr.message.includes("duplicate key")) {
      return { ok: true };
    }
    return { ok: false, error: debitErr.message };
  }

  // 2. Update transaction
  const { error: updErr } = await admin
    .from("transactions")
    .update({
      escrow_amount_paid: advance,
      escrow_paid_at: new Date().toISOString(),
      status: "escrow_paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updErr) return { ok: false, error: `Refund needed: ${updErr.message}` };

  // 3. Notify seller
  await admin.from("notifications").insert({
    user_id: order.farmer_id,
    kind: "escrow_paid",
    title: "30% advance received",
    body: `Buyer paid ₹${advance.toLocaleString("en-IN")} advance. Ready to ship.`,
    link: order.pool_id ? "/farmer/fpo/dashboard/offers" : "/farmer/orders",
  });

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Confirm delivery → release final 70% — with idempotency + FPO     */
/* ------------------------------------------------------------------ */
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

  // Use admin client — RLS is bypassed but we still check ownership below
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("transactions")
    .select(
      "id, buyer_id, farmer_id, pool_id, gross_amount, net_amount, escrow_amount_paid, final_amount_paid, status"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }

  // === Idempotency guard ===
  if (order.status === "completed") {
    // Already completed — nothing to do
    return { ok: true };
  }
  if (Number(order.final_amount_paid) > 0) {
    // Final already charged — heal status
    await admin
      .from("transactions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    revalidatePath("/buyer/orders");
    revalidatePath("/wallet");
    return { ok: true };
  }
  if (order.status !== "delivered") {
    return {
      ok: false,
      error: "Seller hasn't marked this as delivered yet.",
    };
  }

  const final = Number(
    (Number(order.gross_amount) - Number(order.escrow_amount_paid || 0)).toFixed(
      2
    )
  );

  // 1. Debit buyer wallet
  const { error: debitErr } = await admin.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: final,
    p_kind: "final_paid",
    p_reference_id: order.id,
    p_description: `Final 70% on order #${order.id.slice(0, 8)}`,
  });

  if (debitErr) {
    if (debitErr.message.includes("duplicate key")) {
      return { ok: true };
    }
    return { ok: false, error: debitErr.message };
  }

  /* ================================================================ */
  /*  POOL → FPO wallet → distribute to members                        */
  /* ================================================================ */
  if (order.pool_id) {
    const { data: pool } = await admin
      .from("fpo_pools")
      .select("fpo_id, crop")
      .eq("id", order.pool_id)
      .maybeSingle();

    if (!pool) {
      return {
        ok: false,
        error: "Pool not found — contact support with order ID " + order.id.slice(0, 8),
      };
    }

    // Credit FPO wallet with net pool amount
    const { error: fpoCreditErr } = await admin.rpc("fpo_wallet_credit", {
      p_fpo_id: pool.fpo_id,
      p_amount: Number(order.net_amount),
      p_kind: "pool_received",
      p_reference_id: order.id,
      p_description: `Pool sale · ${pool.crop} · #${order.id.slice(0, 8)}`,
    });

    if (fpoCreditErr) {
      return {
        ok: false,
        error: `FPO credit failed: ${fpoCreditErr.message}`,
      };
    }

    // Get payout rows and distribute to members
    const { data: payouts } = await admin
      .from("fpo_pool_payouts")
      .select("id, member_id, net_payout, quantity_kg, share_pct")
      .eq("transaction_id", order.id);

    if (payouts && payouts.length > 0) {
      for (const p of payouts) {
        // Debit from FPO wallet
        await admin.rpc("fpo_wallet_debit", {
          p_fpo_id: pool.fpo_id,
          p_amount: Number(p.net_payout),
          p_kind: "member_distribution",
          p_reference_id: order.id,
          p_description: `Share → member (${p.quantity_kg} kg · ${Number(
            p.share_pct
          ).toFixed(1)}%)`,
        });

        // Credit member's personal wallet
        await admin.rpc("wallet_credit", {
          p_user_id: p.member_id,
          p_amount: Number(p.net_payout),
          p_kind: "pool_share",
          p_reference_id: order.id,
          p_description: `Pool share · ${pool.crop}`,
        });

        await admin
          .from("fpo_pool_payouts")
          .update({ status: "released" })
          .eq("id", p.id);

        await admin.from("notifications").insert({
          user_id: p.member_id,
          kind: "payout_released",
          title: `${pool.crop} pool share released`,
          body: `₹${Number(p.net_payout).toLocaleString("en-IN")} credited.`,
          link: "/wallet",
        });
      }
    }
  } else {
    /* ============================================================== */
    /*  LISTING → farmer personal wallet                              */
    /* ============================================================== */
    await admin.rpc("wallet_credit", {
      p_user_id: order.farmer_id,
      p_amount: Number(order.net_amount),
      p_kind: "payout_received",
      p_reference_id: order.id,
      p_description: `Order payout #${order.id.slice(0, 8)}`,
    });

    await admin.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "payout_released",
      title: "Payment released",
      body: `₹${Number(order.net_amount).toLocaleString("en-IN")} credited.`,
      link: "/wallet",
    });
  }

  // 3. Mark complete
  const { error: updErr } = await admin
    .from("transactions")
    .update({
      final_amount_paid: final,
      final_paid_at: new Date().toISOString(),
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updErr) return { ok: false, error: updErr.message };

  // 4. Trust bumps
  await admin.rpc("bump_trust", { p_user: order.farmer_id, p_delta: 2 });
  await admin.rpc("bump_trust", { p_user: order.buyer_id, p_delta: 2 });

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/farmer/fpo/dashboard/wallet");
  return { ok: true };
}