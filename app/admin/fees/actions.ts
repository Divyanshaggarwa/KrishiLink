"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type FeeState = { error?: string; ok?: boolean } | null;

export async function updateFeeConfigAction(
  _prev: FeeState,
  formData: FormData
): Promise<FeeState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { error: "Only admins can edit fees." };
  }

  const supabase = await createClient();

  const updates: { key: string; value: number }[] = [];
  const keys = [
    "commission_pct",
    "handling_flat",
    "gateway_pct",
    "quality_deduction_A",
    "quality_deduction_B",
    "quality_deduction_C",
  ];

  for (const key of keys) {
    const raw = formData.get(key);
    if (raw === null) continue;
    const val = Number(raw);
    if (!Number.isFinite(val) || val < 0) {
      return { error: `Invalid value for ${key}` };
    }
    updates.push({ key, value: val });
  }

  const transportIds = formData.getAll("transport_vehicle") as string[];
  const transportRates = formData.getAll("transport_rate") as string[];

  for (const u of updates) {
    const { error } = await supabase
      .from("fee_config")
      .update({ value: u.value, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq("key", u.key);
    if (error) return { error: `Could not update ${u.key}: ${error.message}` };
  }

  for (let i = 0; i < transportIds.length; i++) {
    const val = Number(transportRates[i]);
    if (!Number.isFinite(val) || val < 0) continue;
    const { error } = await supabase
      .from("transport_rates")
      .update({ rate_per_km: val, updated_at: new Date().toISOString() })
      .eq("vehicle", transportIds[i]);
    if (error) return { error: `Could not update transport: ${error.message}` };
  }

  revalidatePath("/admin/fees");
  revalidatePath("/buyer/browse", "layout");
  revalidatePath("/farmer/offers", "layout");
  revalidatePath("/buyer/orders", "layout");
  revalidatePath("/farmer/orders", "layout");

  return { ok: true };
}