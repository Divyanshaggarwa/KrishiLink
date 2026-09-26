export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import PoolOfferCard from "../PoolOfferCard";

export default async function FpoOffersPage() {
  const profile = await requireRole(["farmer"]);
  if (profile.fpo_status !== "approved") redirect("/farmer/fpo");

  const supabase = await createClient();

  // My pools
  const { data: myPools } = await supabase
    .from("fpo_pools")
    .select("id, crop, status")
    .eq("fpo_id", profile.id);

  const poolIds = (myPools || []).map((p) => p.id);
  const poolMap = new Map((myPools || []).map((p) => [p.id, p]));

  // All offers on my pools
  const { data: offers } =
    poolIds.length > 0
      ? await supabase
          .from("offers")
          .select(
            "id, pool_id, buyer_id, price_per_kg, quantity_kg, pickup_mode, message, status, created_at"
          )
          .in("pool_id", poolIds)
          .order("created_at", { ascending: false })
      : { data: [] as never[] };

  const safeOffers = offers || [];

  // Buyer names
  const buyerIds = Array.from(new Set(safeOffers.map((o) => o.buyer_id)));
  const { data: buyers } =
    buyerIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, business_name, district, state")
          .in("id", buyerIds)
      : { data: [] as never[] };
  const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

  const pending = safeOffers.filter((o) => o.status === "pending");
  const accepted = safeOffers.filter((o) => o.status === "accepted");
  const rejected = safeOffers.filter((o) => o.status === "rejected");

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Pool offers"
      subtitle="Every buyer offer on your collective pools."
    >
      <div className="mb-6">
        <Link
          href="/farmer/fpo/dashboard"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to overview
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Stat
          label="Pending"
          value={pending.length}
          accent={pending.length > 0 ? "amber" : "gray"}
        />
        <Stat label="Accepted" value={accepted.length} accent="green" />
        <Stat label="Rejected" value={rejected.length} />
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-[#0F1F1A]">
            Pending decisions
          </h2>
          <div className="space-y-4">
            {pending.map((o) => {
              const b = buyerMap.get(o.buyer_id);
              const pool = poolMap.get(o.pool_id);
              const total = Number(o.price_per_kg) * Number(o.quantity_kg);
              return (
                <PoolOfferCard
                  key={o.id}
                  offerId={o.id}
                  poolCrop={pool?.crop ?? "—"}
                  buyerName={b?.business_name || b?.full_name || "Buyer"}
                  buyerRegion={`${b?.district ?? "—"}, ${b?.state ?? "—"}`}
                  pricePerKg={Number(o.price_per_kg)}
                  quantityKg={Number(o.quantity_kg)}
                  total={total}
                  message={o.message}
                  pickupMode={o.pickup_mode}
                />
              );
            })}
          </div>
        </section>
      )}

      {accepted.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-lg font-bold text-[#0F1F1A]">
            Accepted
          </h2>
          <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Pool</th>
                    <th className="px-4 py-3 font-medium">Buyer</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-6 py-3 font-medium text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accepted.map((o) => {
                    const b = buyerMap.get(o.buyer_id);
                    const pool = poolMap.get(o.pool_id);
                    return (
                      <tr key={o.id} className="border-t border-[#E4EBE6]">
                        <td className="px-6 py-3 font-medium">
                          {pool?.crop ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {b?.business_name || b?.full_name || "Buyer"}
                        </td>
                        <td className="px-4 py-3">
                          ₹{Number(o.price_per_kg).toFixed(2)}/kg
                        </td>
                        <td className="px-4 py-3">{o.quantity_kg} kg</td>
                        <td className="px-6 py-3 text-right">
                          <span className="rounded-full bg-[#E3F2FD] px-2.5 py-1 text-[10px] font-semibold uppercase text-[#1565C0]">
                            Accepted
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {safeOffers.length === 0 && (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
          <p className="font-display text-lg font-bold text-[#1B4D3E]">
            No offers yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A74]">
            Once you create a pool and buyers place offers, they appear here.
          </p>
          <Link
            href="/farmer/fpo/dashboard"
            className="mt-6 inline-block rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-medium text-white"
          >
            Create a pool
          </Link>
        </div>
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
  value: number;
  accent?: "green" | "amber" | "gray";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "amber"
        ? "text-[#B26A00]"
        : accent === "gray"
          ? "text-[#6B7A74]"
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