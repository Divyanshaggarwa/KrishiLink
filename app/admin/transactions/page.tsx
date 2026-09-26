export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function AdminTransactionsPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: txns } = await supabase
    .from("transactions")
    .select(
      "id, listing_id, pool_id, farmer_id, buyer_id, final_price_per_kg, quantity_kg, gross_amount, net_amount, logistics_cost_per_kg, status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const safeTxns = txns || [];

  // Fetch listings + pools + users
  const listingIds = Array.from(
    new Set(safeTxns.map((t) => t.listing_id).filter(Boolean))
  ) as string[];
  const poolIds = Array.from(
    new Set(safeTxns.map((t) => t.pool_id).filter(Boolean))
  ) as string[];
  const userIds = Array.from(
    new Set([
      ...safeTxns.map((t) => t.farmer_id),
      ...safeTxns.map((t) => t.buyer_id),
    ])
  );

  const [listingsRes, poolsRes, usersRes] = await Promise.all([
    listingIds.length > 0
      ? supabase.from("listings").select("id, crop").in("id", listingIds)
      : Promise.resolve({ data: [] as never[] }),
    poolIds.length > 0
      ? supabase.from("fpo_pools").select("id, crop").in("id", poolIds)
      : Promise.resolve({ data: [] as never[] }),
    userIds.length > 0
      ? supabase
          .from("public_profiles")
          .select("id, full_name, business_name")
          .in("id", userIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const listingMap = new Map((listingsRes.data || []).map((l) => [l.id, l]));
  const poolMap = new Map((poolsRes.data || []).map((p) => [p.id, p]));
  const userMap = new Map((usersRes.data || []).map((u) => [u.id, u]));

  const totalGMV = safeTxns
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + Number(t.gross_amount || 0), 0);

  const inProgress = safeTxns.filter(
    (t) => !["completed", "cancelled"].includes(t.status)
  ).length;

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="All transactions"
      subtitle="Every deal across the platform — listings and pools."
    >
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]">
          ← Back to overview
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="Total transactions" value={safeTxns.length} />
        <Stat label="In progress" value={inProgress} accent="amber" />
        <Stat
          label="Total GMV"
          value={`₹${totalGMV.toLocaleString("en-IN")}`}
          accent="green"
        />
      </div>

      {safeTxns.length === 0 ? (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center text-sm text-[#6B7A74]">
          No transactions yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                <tr>
                  <th className="px-6 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Farmer / FPO</th>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-6 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {safeTxns.map((t) => {
                  const isPool = !!t.pool_id;
                  const listing = t.listing_id
                    ? listingMap.get(t.listing_id)
                    : undefined;
                  const pool = t.pool_id ? poolMap.get(t.pool_id) : undefined;
                  const seller = userMap.get(t.farmer_id);
                  const buyer = userMap.get(t.buyer_id);
                  const crop = isPool ? pool?.crop : listing?.crop;

                  return (
                    <tr key={t.id} className="border-t border-[#E4EBE6] hover:bg-[#FAFCFA]">
                      <td className="px-6 py-3 font-medium">{crop ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            isPool
                              ? "bg-[#1B4D3E] text-white"
                              : "bg-[#EAF5EE] text-[#2E7D32]"
                          }`}
                        >
                          {isPool ? "Pool" : "Listing"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6B7A74]">
                        {seller?.business_name || seller?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#6B7A74]">
                        {buyer?.business_name || buyer?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        ₹{Number(t.final_price_per_kg).toFixed(2)}/kg
                      </td>
                      <td className="px-4 py-3">{t.quantity_kg} kg</td>
                      <td className="px-4 py-3 font-semibold text-[#1B4D3E]">
                        ₹{Number(t.gross_amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <StatusPill status={t.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
  value: number | string;
  accent?: "green" | "amber";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "amber"
        ? "text-[#B26A00]"
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

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    escrow_pending: "bg-[#FFF8E1] text-[#B26A00]",
    escrow_paid: "bg-[#FFF8E1] text-[#B26A00]",
    in_transit: "bg-[#E3F2FD] text-[#1565C0]",
    delivered: "bg-[#E3F2FD] text-[#1565C0]",
    completed: "bg-[#EAF5EE] text-[#2E7D32]",
    cancelled: "bg-[#F5F5F5] text-[#6B7A74]",
    disputed: "bg-[#FFF5F5] text-[#C62828]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        styles[status] ?? styles.cancelled
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}