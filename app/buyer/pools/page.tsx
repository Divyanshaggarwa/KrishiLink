export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import PoolCard from "./PoolCard";

type SearchParams = Promise<{
  crop?: string;
  region?: string;
  grade?: string;
}>;

export default async function BuyerPoolsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole(["buyer"]);
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("fpo_pools")
    .select(
      "id, fpo_id, crop, total_quantity_kg, quality_grade, district, state, expected_price_per_kg, photo_url, notes, status, created_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  if (params.crop) query = query.ilike("crop", `%${params.crop}%`);
  if (params.region) query = query.ilike("district", `%${params.region}%`);
  if (params.grade) query = query.eq("quality_grade", params.grade);

  const { data: pools } = await query;
  const safePools = pools || [];

  // Fetch FPO heads for display
  const fpoIds = Array.from(new Set(safePools.map((p) => p.fpo_id)));
  const { data: heads } =
    fpoIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, business_name, district, state")
          .in("id", fpoIds)
      : { data: [] };
  const headMap = new Map((heads || []).map((h) => [h.id, h]));

  // Member counts
  const { data: memberCounts } =
    fpoIds.length > 0
      ? await supabase
          .from("fpo_members")
          .select("fpo_id")
          .in("fpo_id", fpoIds)
          .eq("status", "active")
      : { data: [] };
  const countMap = new Map<string, number>();
  (memberCounts || []).forEach((m) => {
    countMap.set(m.fpo_id, (countMap.get(m.fpo_id) ?? 0) + 1);
  });

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="FPO collective pools"
      subtitle="Bulk quantities pooled from farmer groups. One deal, many farmers paid fairly."
    >
      <div className="mb-6 rounded-[24px] border border-[#C8E6C9] bg-[#EAF5EE] p-5">
        <p className="text-sm font-semibold text-[#1B4D3E]">
          💡 What&apos;s an FPO pool?
        </p>
        <p className="mt-1 text-xs text-[#1B4D3E]/85">
          Farmer Producer Organisations aggregate crops from multiple small
          farmers into one bulk listing. When you buy a pool, revenue is
          automatically split among members by their contribution.
        </p>
      </div>

      {/* Filters */}
      <form
        method="get"
        className="mb-6 grid gap-3 rounded-[24px] border border-[#E4EBE6] bg-white p-5 md:grid-cols-[1fr_1fr_auto_auto]"
      >
        <input
          name="crop"
          defaultValue={params.crop || ""}
          placeholder="Crop (e.g. Tomato)"
          className="rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
        />
        <input
          name="region"
          defaultValue={params.region || ""}
          placeholder="Region / district"
          className="rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
        />
        <select
          name="grade"
          defaultValue={params.grade || ""}
          className="rounded-xl border border-[#E4EBE6] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
        >
          <option value="">Any grade</option>
          <option value="A">Grade A</option>
          <option value="B">Grade B</option>
          <option value="C">Grade C</option>
        </select>
        <div className="flex gap-2">
          <button className="rounded-full bg-[#1B4D3E] px-5 py-2.5 text-sm font-medium text-white">
            Filter
          </button>
          <Link
            href="/buyer/pools"
            className="rounded-full border border-[#E4EBE6] px-5 py-2.5 text-sm font-medium text-[#6B7A74]"
          >
            Reset
          </Link>
        </div>
      </form>

      {safePools.length === 0 ? (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
          <p className="font-display text-lg font-bold text-[#1B4D3E]">
            No active pools yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A74]">
            When an FPO aggregates crops from its members, the pool will appear
            here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {safePools.map((p) => (
            <PoolCard
              key={p.id}
              pool={{
                id: p.id,
                crop: p.crop,
                totalQuantityKg: Number(p.total_quantity_kg),
                qualityGrade: p.quality_grade,
                district: p.district,
                state: p.state,
                expectedPricePerKg: Number(p.expected_price_per_kg),
                notes: p.notes,
                createdAt: p.created_at,
              }}
              fpoName={headMap.get(p.fpo_id)?.full_name ?? "FPO"}
              fpoBusinessName={headMap.get(p.fpo_id)?.business_name ?? null}
              memberCount={countMap.get(p.fpo_id) ?? 0}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}