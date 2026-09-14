import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FeeConfig, TransportRate } from "./compute";

export async function loadFeeConfig(): Promise<FeeConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fee_config")
    .select("key, value");

  const map = new Map((data || []).map((r) => [r.key, Number(r.value)]));

  return {
    commission_pct: map.get("commission_pct") ?? 2.0,
    handling_flat: map.get("handling_flat") ?? 150,
    gateway_pct: map.get("gateway_pct") ?? 1.8,
    quality_deduction_A: map.get("quality_deduction_A") ?? 0,
    quality_deduction_B: map.get("quality_deduction_B") ?? 0.5,
    quality_deduction_C: map.get("quality_deduction_C") ?? 1.5,
  };
}

export async function loadTransportRates(): Promise<TransportRate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transport_rates")
    .select("vehicle, rate_per_km, min_weight_kg, max_weight_kg")
    .order("rate_per_km", { ascending: true });

  return (data || []).map((r) => ({
    vehicle: r.vehicle,
    rate_per_km: Number(r.rate_per_km),
    min_weight_kg: Number(r.min_weight_kg),
    max_weight_kg: Number(r.max_weight_kg),
  }));
}

export async function loadMandiPrice(
  crop: string
): Promise<{ modal_price: number; market: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mandi_prices")
    .select("modal_price, market")
    .ilike("crop", crop)
    .order("recorded_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { modal_price: Number(data.modal_price), market: data.market };
}