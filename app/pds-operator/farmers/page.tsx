export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function PDSFarmersPage() {
  const profile = await requireRole(["pds_operator"]);
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, farmer_id, crop, quantity_kg, status, created_at")
    .eq("listed_by", profile.id)
    .order("created_at", { ascending: false });

  const safeListings = listings || [];

  const farmerMap = new Map<
    string,
    {
      farmerId: string;
      listings: number;
      active: number;
      crops: Set<string>;
      lastActivity: string;
    }
  >();

  safeListings.forEach((l) => {
    const existing = farmerMap.get(l.farmer_id);
    if (existing) {
      existing.listings++;
      if (l.status === "active") existing.active++;
      existing.crops.add(l.crop);
      if (l.created_at > existing.lastActivity) {
        existing.lastActivity = l.created_at;
      }
    } else {
      farmerMap.set(l.farmer_id, {
        farmerId: l.farmer_id,
        listings: 1,
        active: l.status === "active" ? 1 : 0,
        crops: new Set([l.crop]),
        lastActivity: l.created_at,
      });
    }
  });

  const farmerIds = Array.from(farmerMap.keys());

  const { data: profiles } =
    farmerIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, krishilink_id, district, state, trust_score")
          .in("id", farmerIds)
      : { data: [] as never[] };

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const rows = Array.from(farmerMap.values())
    .map((f) => ({
      ...f,
      farmer: profileMap.get(f.farmerId),
    }))
    .sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1));

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Assisted farmers"
      subtitle="Farmers you've helped list crops on KrishiLink."
    >
      <div className="mb-6">
        <Link
          href="/pds-operator"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to overview
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
          <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
            No farmers assisted yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A74]">
            When you create a listing on behalf of a farmer, they will appear
            here.
          </p>
          <Link
            href="/pds-operator/assist"
            className="mt-6 inline-block rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-medium text-white"
          >
            Assist a farmer
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Stat
              label="Farmers assisted"
              value={rows.length}
              accent="green"
            />
            <Stat
              label="Total listings"
              value={rows.reduce((s, r) => s + r.listings, 0)}
            />
            <Stat
              label="Active listings"
              value={rows.reduce((s, r) => s + r.active, 0)}
              accent="blue"
            />
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Farmer</th>
                    <th className="px-4 py-3 font-medium">KrishiLink ID</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Listings</th>
                    <th className="px-4 py-3 font-medium">Crops</th>
                    <th className="px-6 py-3 font-medium text-right">
                      Last activity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.farmerId}
                      className="border-t border-[#E4EBE6] hover:bg-[#FAFCFA]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF5EE] text-xs font-semibold text-[#1B4D3E]">
                            {(r.farmer?.full_name ?? "F")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <span className="font-medium">
                            {r.farmer?.full_name ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-[#1B4D3E]">
                        {r.farmer?.krishilink_id ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-[#6B7A74]">
                        {r.farmer?.district
                          ? `${r.farmer.district}, ${r.farmer.state ?? ""}`
                          : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium">{r.active}</span>
                        <span className="text-[#6B7A74]"> / {r.listings}</span>
                      </td>
                      <td className="px-4 py-4 text-[#6B7A74]">
                        {Array.from(r.crops).slice(0, 3).join(", ")}
                        {r.crops.size > 3 ? ` +${r.crops.size - 3}` : ""}
                      </td>
                      <td className="px-6 py-4 text-right text-[#6B7A74]">
                        {new Date(r.lastActivity).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "green" | "blue";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "blue"
        ? "text-[#1565C0]"
        : "text-[#1B4D3E]";
  return (
    <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p className={`font-display mt-2 text-3xl font-extrabold ${color}`}>
        {value}
      </p>
    </div>
  );
}