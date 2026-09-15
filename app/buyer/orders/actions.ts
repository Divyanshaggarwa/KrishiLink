"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type OrderActionState = { error?: string; ok?: boolean } | null;

/** Buyer pays 30% advance to lock the order. Simulated for SIH demo. */
export async function payEscrowAction(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") {
    return { error: "Only buyers can pay escrow." };
  }

  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return { error: "Order ID missing." };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("transactions")
    .select(
      "id, buyer_id, farmer_id, gross_amount, status, listing:listings(crop)"
    )
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { error: "Order not found." };
  }
  if (order.status !== "escrow_pending") {
    return { error: "Escrow already processed." };
  }

  const advance = Number((order.gross_amount * 0.3).toFixed(2));

  const { error } = await supabase
    .from("transactions")
    .update({
      escrow_amount_paid: advance,
      status: "escrow_paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) return { error: error.message };

  await supabase.from("notifications").insert({
    user_id: order.farmer_id,
    kind: "escrow_paid",
    title: "30% advance received",
    body: `Buyer paid ₹${advance.toLocaleString("en-IN")} advance. Ready to ship.`,
    link: "/farmer/orders",
  });

  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  return { ok: true };
}

/** Buyer confirms receipt → releases final 70% → order completed. */
export async function confirmDeliveryAction(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") {
    return { error: "Only buyers can confirm delivery." };
  }

  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return { error: "Order ID missing." };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("transactions")
    .select("id, buyer_id, farmer_id, gross_amount, escrow_amount_paid, status")
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== profile.id) {
    return { error: "Order not found." };
  }
  if (order.status !== "delivered") {
    return { error: "Farmer hasn't marked this as delivered yet." };
  }

  const final = Number(
    (Number(order.gross_amount) - Number(order.escrow_amount_paid || 0)).toFixed(2)
  );

  const { error } = await supabase
    .from("transactions")
    .update({
      final_amount_paid: final,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) return { error: error.message };

  // Bump trust scores (+2 for both sides on completed deal)
  await supabase.rpc("bump_trust", { p_user: order.farmer_id, p_delta: 2 });
  await supabase.rpc("bump_trust", { p_user: order.buyer_id, p_delta: 2 });

  await supabase.from("notifications").insert({
    user_id: order.farmer_id,
    kind: "completed",
    title: "Order completed — final 70% released",
    body: `₹${final.toLocaleString("en-IN")} has been released to you. Trust score +2.`,
    link: "/farmer/orders",
  });

  revalidatePath("/buyer/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/buyer");
  revalidatePath("/farmer");
  return { ok: true };
}