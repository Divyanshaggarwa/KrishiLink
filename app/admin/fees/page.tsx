export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import FeeForm from "./FeeForm";

export default async function AdminFeesPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const [{ data: fees }, { data: transports }] = await Promise.all([
    supabase.from("fee_config").select("key, value, unit, description").order("key"),
    supabase
      .from("transport_rates")
      .select("vehicle, rate_per_km, min_weight_kg, max_weight_kg")
      .order("rate_per_km"),
  ]);

  return (
    <DashboardShell
      profile={profile}
      showBack={false}
      title="Fee configuration"
      subtitle="Single source of truth for all platform charges and transport rates."
    >
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to overview
        </Link>
      </div>

      <FeeForm
        fees={(fees || []).map((f) => ({
          key: f.key,
          value: Number(f.value),
          unit: f.unit,
          description: f.description,
        }))}
        transports={(transports || []).map((t) => ({
          vehicle: t.vehicle,
          rate_per_km: Number(t.rate_per_km),
          min_weight_kg: Number(t.min_weight_kg),
          max_weight_kg: Number(t.max_weight_kg),
        }))}
      />

      <div className="mt-8 rounded-[24px] border border-[#C8E6C9] bg-[#EAF5EE] p-6">
        <p className="font-display text-sm font-bold text-[#1B4D3E]">
          Every change is audited
        </p>
        <p className="mt-1 text-xs text-[#1B4D3E]/80">
          Your admin ID and timestamp are recorded on every update. The Net
          Realization Engine reads these values live — no code changes needed.
        </p>
      </div>
    </DashboardShell>
  );
}