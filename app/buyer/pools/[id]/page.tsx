export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import PoolOfferForm from "./PoolOfferForm";

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole(["buyer"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: pool } = await supabase
    .from("fpo_pools")
    .select(
      "id, fpo_id, crop, total_quantity_kg, quality_grade, district, state, expected_price_per_kg, notes, status, created_at"
    )
    .eq("id", id)
    .single();

  if (!pool || pool.status !== "active") notFound();

  // FPO head info
  const { data: head } = await supabase
    .from("public_profiles")
    .select("full_name, business_name, district, state")
    .eq("id", pool.fpo_id)
    .single();

  // Member count
  const { data: members } = await supabase
    .from("fpo_members")
    .select("id")
    .eq("fpo_id", pool.fpo_id)
    .eq("status", "active");

  const memberCount = members?.length ?? 0;

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title={pool.crop}
      subtitle={`FPO pool · ${pool.district}${pool.state ? `, ${pool.state}` : ""}`}
    >
      <div className="mb-6">
        <Link
          href="/buyer/pools"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to pools
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* LEFT: pool info */}
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] p-6 text-white">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
              FPO collective pool
            </span>
            <h2 className="font-display mt-4 text-3xl font-extrabold">
              {pool.crop}
            </h2>
            <p className="mt-2 text-sm text-white/75">
              Pooled by {memberCount} farmer{memberCount === 1 ? "" : "s"} from{" "}
              {head?.business_name || head?.full_name || "the FPO"}.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 text-xs md:grid-cols-3">
              <Stat
                label="Quantity"
                value={`${pool.total_quantity_kg} kg`}
              />
              <Stat
                label="Grade"
                value={pool.quality_grade ?? "—"}
              />
              <Stat
                label="Asking"
                value={`₹${pool.expected_price_per_kg}/kg`}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
            <h3 className="font-display text-base font-bold text-[#1B4D3E]">
              Pool details
            </h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <Info label="Crop" value={pool.crop} />
              <Info label="Quality grade" value={pool.quality_grade ?? "—"} />
              <Info label="Total quantity" value={`${pool.total_quantity_kg} kg`} />
              <Info
                label="Asking price"
                value={`₹${pool.expected_price_per_kg}/kg`}
              />
              <Info label="District" value={pool.district} />
              <Info label="State" value={pool.state ?? "—"} />
              <Info label="FPO head" value={head?.full_name ?? "—"} />
              <Info label="Members" value={`${memberCount} farmers`} />
            </dl>

            {pool.notes && (
              <div className="mt-5 rounded-xl bg-[#F8F9FA] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7A74]">
                  Notes from FPO
                </p>
                <p className="mt-1 text-sm italic text-[#0F1F1A]">
                  &ldquo;{pool.notes}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: offer form */}
        <div>
          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6 lg:sticky lg:top-24">
            <h3 className="font-display text-lg font-bold text-[#0F1F1A]">
              Place your offer
            </h3>
            <p className="mt-1 text-sm text-[#6B7A74]">
              Your payment will be split fairly among all members who
              contributed to this pool.
            </p>

            <div className="mt-6">
              <PoolOfferForm
                poolId={pool.id}
                totalQuantityKg={Number(pool.total_quantity_kg)}
                askingPrice={Number(pool.expected_price_per_kg)}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[#A5D6A7]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}