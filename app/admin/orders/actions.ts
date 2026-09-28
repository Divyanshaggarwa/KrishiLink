"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type AdminOrderState = {
  ok: boolean;
  error?: string;
};

export async function adminMarkShippedAction(
  _prev: AdminOrderState,
  formData: FormData
): Promise<AdminOrderState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return { ok: false, error: "Missing order ID." };

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("transactions")
    .select("id, buyer_id, farmer_id, status, pool_id")
    .eq("id", orderId)
    .single();

  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "escrow_paid") {
    return { ok: false, error: "Buyer must pay the 30% advance first." };
  }

  const { data: updated, error } = await supabase
    .from("transactions")
    .update({ status: "in_transit", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id, status")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Update failed." };
  }

  await supabase.from("notifications").insert([
    {
      user_id: order.buyer_id,
      kind: "in_transit",
      title: "Order shipped",
      body: "KrishiLink logistics has picked up the shipment.",
      link: "/buyer/orders",
    },
    {
      user_id: order.farmer_id,
      kind: "in_transit",
      title: "Your shipment is on the way",
      body: "Logistics has picked up your produce.",
      link: order.pool_id ? "/farmer/fpo/dashboard/offers" : "/farmer/orders",
    },
  ]);

  revalidatePath("/admin/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/buyer/orders");

  return { ok: true };
}

export async function adminMarkDeliveredAction(
  _prev: AdminOrderState,
  formData: FormData
): Promise<AdminOrderState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }

  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return { ok: false, error: "Missing order ID." };

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("transactions")
    .select("id, buyer_id, farmer_id, status")
    .eq("id", orderId)
    .single();

  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "in_transit") {
    return { ok: false, error: "Order isn't in transit yet." };
  }

  const { data: updated, error } = await supabase
    .from("transactions")
    .update({ status: "delivered", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id, status")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Update failed." };
  }

  await supabase.from("notifications").insert({
    user_id: order.buyer_id,
    kind: "delivered",
    title: "Order delivered — please confirm",
    body: "Confirm receipt to release the final 70% to the farmer.",
    link: "/buyer/orders",
  });

  revalidatePath("/admin/orders");
  revalidatePath("/farmer/orders");
  revalidatePath("/farmer/fpo/dashboard");
  revalidatePath("/buyer/orders");

  return { ok: true };
}