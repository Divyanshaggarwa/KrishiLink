import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

type SearchParams = Promise<{
  crop?: string;
  district?: string;
  grade?: string;
}>;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole(["buyer"]);
  const params = await searchParams;

  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(
      "id, crop, variety, quantity_kg, quality_grade, expected_price_per_kg, fair_price_low, fair_price_high, district, state, photo_url, harvest_date, created_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  if (params.crop) query = query.ilike("crop", `%${params.crop}%`);
  if (params.district) query = query.ilike("district", `%${params.district}%`);
  if (params.grade) query = query.eq("quality_grade", params.grade);

  const { data: listings } = await query;

  return (
    <DashboardShell
      profile={profile}
      title="Browse produce"
      subtitle="Live listings from verified farmers. Place offers directly."
    >
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
          name="district"
          defaultValue={params.district || ""}
          placeholder="District"
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
            href="/buyer/browse"
            className="rounded-full border border-[#E4EBE6] px-5 py-2.5 text-sm font-medium text-[#6B7A74]"
          >
            Reset
          </Link>
        </div>
      </form>

      {!listings || listings.length === 0 ? (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center text-[#6B7A74]">
          No active listings match your filters.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={`/buyer/browse/${l.id}`}
              className="group overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.3)]"
            >
              <div className="relative h-40 w-full overflow-hidden bg-[#EAF5EE]">
                {l.photo_url ? (
                  <Image
                    src={l.photo_url}
                    alt={l.crop}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    🌾
                  </div>
                )}
                <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#1B4D3E]">
                  Grade {l.quality_grade ?? "—"}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-bold">{l.crop}</h3>
                {l.variety && (
                  <p className="text-xs text-[#6B7A74]">{l.variety}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#6B7A74]">Available</p>
                    <p className="font-semibold">{l.quantity_kg} kg</p>
                  </div>
                  <div>
                    <p className="text-[#6B7A74]">Asking</p>
                    <p className="font-semibold">
                      ₹{l.expected_price_per_kg}/kg
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[#6B7A74]">Location</p>
                    <p className="font-semibold">
                      {l.district}, {l.state}
                    </p>
                  </div>
                </div>
                {l.fair_price_low && l.fair_price_high && (
                  <p className="mt-3 rounded-full bg-[#EAF5EE] px-3 py-1 text-[11px] font-medium text-[#2E7D32]">
                    Fair band: ₹{l.fair_price_low}–₹{l.fair_price_high}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}