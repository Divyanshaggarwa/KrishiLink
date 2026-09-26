export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function FpoHistoryPage() {
  const profile = await requireRole(["farmer"]);
  if (profile.fpo_status !== "approved") redirect("/farmer/fpo");

  const supabase = await createClient();

  const { data: pools } = await supabase
    .from("fpo_pools")
    .select("id, crop, total_quantity_kg, status, created_at")
    .eq("fpo_id", profile.id)
    .order("created_at", { ascending: false });

  const poolIds = (pools || []).map((p) => p.id);
  const poolMap = new Map((pools || []).map((p) => [p.id, p]));

  const { data: txns } =
    poolIds.length > 0
      ? await supabase
          .from("transactions")
          .select(
            "id, pool_id, final_price_per_kg, quantity_kg, gross_amount, net_amount, status, created_at, buyer_id"
          )
          .in("pool_id", poolIds)
          .order("created_at", { ascending: false })
      : { data: [] as never[] };

  const safeTxns = txns || [];

  const buyerIds = Array.from(new Set(safeTxns.map((t) => t.buyer_id)));
  const { data: buyers } =
    buyerIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, business_name")
          .in("id", buyerIds)
      : { data: [] as never[] };
  const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

  const totalEarned = safeTxns
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + Number(t.net_amount || 0), 0);

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Pool history"
      subtitle="Every completed pool sale and its payout."
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
        <Stat label="Total pools" value={pools?.length ?? 0} />
        <Stat label="Total sales" value={safeTxns.length} />
        <Stat
          label="Total earned"
          value={`₹${totalEarned.toLocaleString("en-IN")}`}
          accent="green"
        />
      </div>

      {safeTxns.length === 0 ? (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
          <p className="text-sm text-[#6B7A74]">
            No completed pool sales yet.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                <tr>
                  <th className="px-6 py-3 font-medium">Pool</th>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Net amount</th>
                  <th className="px-6 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {safeTxns.map((t) => {
                  const pool = poolMap.get(t.pool_id ?? "");
                  const b = buyerMap.get(t.buyer_id);
                  return (
                    <tr key={t.id} className="border-t border-[#E4EBE6]">
                      <td className="px-6 py-3 font-medium">
                        {pool?.crop ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {b?.business_name || b?.full_name || "Buyer"}
                      </td>
                      <td className="px-4 py-3">
                        ₹{Number(t.final_price_per_kg).toFixed(2)}/kg
                      </td>
                      <td className="px-4 py-3">{t.quantity_kg} kg</td>
                      <td className="px-4 py-3 font-semibold text-[#1B4D3E]">
                        ₹{Number(t.net_amount).toLocaleString("en-IN")}
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
  accent?: "green";
}) {
  const color = accent === "green" ? "text-[#2E7D32]" : "text-[#1B4D3E]";
  return (
    <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p className={`font-display mt-2 text-2xl font-extrabold ${color}`}>
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