"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export type PoolOfferState = { error?: string; ok?: boolean } | null;

export async function placePoolOfferAction(
  poolId: string,
  _prev: PoolOfferState,
  formData: FormData
): Promise<PoolOfferState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") {
    return { error: "Only buyers can place offers." };
  }

  const pricePerKg = Number(formData.get("price_per_kg"));
  const quantityKg = Number(formData.get("quantity_kg"));
  const pickupMode = String(formData.get("pickup_mode") || "pickup");
  const message = String(formData.get("message") || "").trim();

  if (!pricePerKg || pricePerKg <= 0) {
    return { error: "Please enter a valid price per kg." };
  }
  if (!quantityKg || quantityKg <= 0) {
    return { error: "Please enter a valid quantity." };
  }

  const supabase = await createClient();

  const { data: pool } = await supabase
    .from("fpo_pools")
    .select("id, total_quantity_kg, status, fpo_id, crop")
    .eq("id", poolId)
    .single();

  if (!pool) return { error: "Pool not found." };
  if (pool.status !== "active") {
    return { error: "This pool is no longer active." };
  }
  if (quantityKg > pool.total_quantity_kg) {
    return {
      error: `Only ${pool.total_quantity_kg} kg available in this pool.`,
    };
  }

  const { error: insertErr } = await supabase.from("offers").insert({
    listing_id: null,
    pool_id: poolId,
    buyer_id: profile.id,
    price_per_kg: pricePerKg,
    quantity_kg: quantityKg,
    pickup_mode: pickupMode,
    message: message || null,
    status: "pending",
  });

  if (insertErr) {
    return { error: `Could not save offer: ${insertErr.message}` };
  }

  // Notify FPO head
  await supabase.from("notifications").insert({
    user_id: pool.fpo_id,
    kind: "pool_offer",
    title: `New offer on your ${pool.crop} pool`,
    body: `${profile.full_name} offered ₹${pricePerKg}/kg for ${quantityKg} kg.`,
    link: "/farmer/fpo/dashboard",
  });

  redirect("/buyer/bids");
}