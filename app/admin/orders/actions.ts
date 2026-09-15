"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type AdminOrderState = { error?: string; ok?: boolean } | null;

export async function adminMarkShippedAction(
  _prev: AdminOrderState,
  formData: FormData
): Promise<AdminOrderState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { error: "Admin only." };
  }

  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return { error: "Missing order ID." };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("transactions")
    .select("id, buyer_id, farmer_id, status")
    .eq("id", orderId)
    .single();

  if (!order) return { error: "Order not found." };
  if (order.status !== "escrow_paid") {
    return { error: "Buyer must pay the 30% advance first." };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ status: "in_transit", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { error: error.message };

  await Promise.all([
    supabase.from("notifications").insert({
      user_id: order.buyer_id,
      kind: "in_transit",
      title: "Order shipped",
      body: "KrishiLink logistics has picked up the shipment.",
      link: "/buyer/orders",
    }),
    supabase.from("notifications").insert({
      user_id: order.farmer_id,
      kind: "in_transit",
      title: "Your shipment is on the way",
      body: "Logistics has picked up your produce.",
      link: "/farmer/orders",
    }),
  ]);

  revalidatePath("/admin/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/buyer/orders");
  return { ok: true };
}

export async function adminMarkDeliveredAction(
  _prev: AdminOrderState,
  formData: FormData
): Promise<AdminOrderState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { error: "Admin only." };
  }

  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return { error: "Missing order ID." };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("transactions")
    .select("id, buyer_id, farmer_id, status")
    .eq("id", orderId)
    .single();

  if (!order) return { error: "Order not found." };
  if (order.status !== "in_transit") {
    return { error: "Order isn't in transit yet." };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ status: "delivered", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { error: error.message };

  await supabase.from("notifications").insert({
    user_id: order.buyer_id,
    kind: "delivered",
    title: "Order delivered — please confirm",
    body: "Confirm receipt to release the final 70% to the farmer.",
    link: "/buyer/orders",
  });

  revalidatePath("/admin/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/buyer/orders");
  return { ok: true };
}