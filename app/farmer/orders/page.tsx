import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import Timeline from "@/components/orders/Timeline";

export default async function FarmerOrdersPage() {
  const profile = await requireRole(["farmer"]);
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("transactions")
    .select(
      "id, final_price_per_kg, quantity_kg, net_realization_per_kg, net_amount, gross_amount, logistics_cost_per_kg, transaction_cost_per_kg, distance_km, vehicle_type, status, created_at, buyer_id, listing:listings!inner(crop, quality_grade)"
    )
    .eq("farmer_id", profile.id)
    .order("created_at", { ascending: false });

  const safeOrders = orders || [];

  const buyerIds = Array.from(new Set(safeOrders.map((o) => o.buyer_id)));
  const { data: buyers } = await supabase
    .from("public_profiles")
    .select("id, full_name, district, state, trust_score, business_name")
    .in("id", buyerIds);
  const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

  const totalEarnings = safeOrders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.net_amount || 0), 0);

  const inProgress = safeOrders.filter(
    (o) => !["completed", "cancelled"].includes(o.status)
  ).length;

  return (
    <DashboardShell
      profile={profile}
      title="My orders"
      subtitle="Every deal from acceptance to payout."
    >
      <div className="grid gap-5 md:grid-cols-3">
        <Stat label="Total orders" value={safeOrders.length} />
        <Stat label="In progress" value={inProgress} accent="amber" />
        <Stat
          label="Total earned"
          value={`₹${totalEarnings.toLocaleString("en-IN")}`}
          accent="green"
        />
      </div>

      <div className="mt-10 space-y-6">
        {safeOrders.length === 0 ? (
          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              No orders yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A74]">
              When you accept a buyer&apos;s offer, the order will appear here
              with its full lifecycle.
            </p>
            <Link
              href="/farmer/offers"
              className="mt-6 inline-block rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-medium text-white"
            >
              View offers received
            </Link>
          </div>
        ) : (
          safeOrders.map((o) => {
            const l = Array.isArray(o.listing) ? o.listing[0] : o.listing;
            const b = buyerMap.get(o.buyer_id);

            return (
              <div
                key={o.id}
                className="rounded-[24px] border border-[#E4EBE6] bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold">
                      {l?.crop}{" "}
                      <span className="ml-1 rounded-full bg-[#EAF5EE] px-2 py-0.5 text-[10px] font-medium text-[#2E7D32]">
                        Grade {l?.quality_grade ?? "—"}
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-[#6B7A74]">
                      Buyer:{" "}
                      <strong>{b?.business_name || b?.full_name}</strong> ·{" "}
                      {b?.district}, {b?.state} · {o.distance_km} km ·{" "}
                      {o.vehicle_type}
                    </p>
                  </div>
                  <span className="text-xs text-[#6B7A74]">
                    {new Date(o.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <Field
                    label="Deal price"
                    value={`₹${Number(o.final_price_per_kg).toFixed(2)}/kg`}
                  />
                  <Field label="Quantity" value={`${o.quantity_kg} kg`} />
                  <Field
                    label="Net per kg"
                    value={`₹${Number(o.net_realization_per_kg).toFixed(2)}`}
                    accent
                  />
                  <Field
                    label="Your take-home"
                    value={`₹${Number(o.net_amount).toLocaleString("en-IN")}`}
                    accent
                  />
                </div>

                <div className="mt-5">
                  <Timeline status={o.status} createdAt={o.created_at} />
                </div>
              </div>
            );
          })
        )}
      </div>
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
    <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
      <p className="text-xs uppercase tracking-wide text-[#6B7A74]">{label}</p>
      <p className={`font-display mt-2 text-3xl font-extrabold ${color}`}>
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold ${
          accent ? "text-[#1B4D3E]" : "text-[#0F1F1A]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}