"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type WalletActionResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
};

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

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("transactions")
    .select(
      "id, buyer_id, farmer_id, pool_id, gross_amount, escrow_amount_paid, status"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }
  if (order.status !== "escrow_pending") {
    return { ok: false, error: "Escrow already paid." };
  }

  const advance = Number((Number(order.gross_amount) * 0.3).toFixed(2));

  const { error: debitErr } = await supabase.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: advance,
    p_kind: "escrow_paid",
    p_reference_id: order.id,
    p_description: `30% escrow on order #${order.id.slice(0, 8)}`,
  });

  if (debitErr) return { ok: false, error: debitErr.message };

  const { error: updErr } = await supabase
    .from("transactions")
    .update({
      escrow_amount_paid: advance,
      status: "escrow_paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updErr) return { ok: false, error: `Refund needed: ${updErr.message}` };

  await supabase.from("notifications").insert({
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

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("transactions")
    .select(
      "id, buyer_id, farmer_id, pool_id, gross_amount, net_amount, escrow_amount_paid, status"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { ok: false, error: "Order not found." };
  }
  if (order.status !== "delivered") {
    return { ok: false, error: "Seller hasn't marked it as delivered." };
  }

  const final = Number(
    (Number(order.gross_amount) - Number(order.escrow_amount_paid || 0)).toFixed(
      2
    )
  );

  const { error: debitErr } = await supabase.rpc("wallet_debit", {
    p_user_id: profile.id,
    p_amount: final,
    p_kind: "final_paid",
    p_reference_id: order.id,
    p_description: `Final 70% on order #${order.id.slice(0, 8)}`,
  });

  if (debitErr) return { ok: false, error: debitErr.message };

  if (order.pool_id) {
    const { data: payouts } = await supabase
      .from("fpo_pool_payouts")
      .select("id, member_id, net_payout")
      .eq("transaction_id", order.id);

    if (payouts && payouts.length > 0) {
      for (const p of payouts) {
        await supabase.rpc("wallet_credit", {
          p_user_id: p.member_id,
          p_amount: Number(p.net_payout),
          p_kind: "pool_share",
          p_reference_id: order.id,
          p_description: `Pool sale share`,
        });
        await supabase
          .from("fpo_pool_payouts")
          .update({ status: "released" })
          .eq("id", p.id);

        await supabase.from("notifications").insert({
          user_id: p.member_id,
          kind: "payout_released",
          title: "Pool share released",
          body: `₹${Number(p.net_payout).toLocaleString("en-IN")} credited.`,
          link: "/wallet",
        });
      }
    }
  } else {
    await supabase.rpc("wallet_credit", {
      p_user_id: order.farmer_id,
      p_amount: Number(order.net_amount),
      p_kind: "payout_received",
      p_reference_id: order.id,
      p_description: `Order payout #${order.id.slice(0, 8)}`,
    });

    await supabase.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "payout_released",
      title: "Payment released",
      body: `₹${Number(order.net_amount).toLocaleString("en-IN")} credited.`,
      link: "/wallet",
    });
  }

  const { error: updErr } = await supabase
    .from("transactions")
    .update({
      final_amount_paid: final,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updErr) return { ok: false, error: updErr.message };

  await supabase.rpc("bump_trust", { p_user: order.farmer_id, p_delta: 2 });
  await supabase.rpc("bump_trust", { p_user: order.buyer_id, p_delta: 2 });

  revalidatePath("/wallet");
  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  return { ok: true };
}