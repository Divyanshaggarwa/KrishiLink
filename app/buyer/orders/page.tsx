export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import Timeline from "@/components/orders/Timeline";
import { PayEscrowButton, ConfirmDeliveryButton } from "./OrderButtons";

export default async function BuyerOrdersPage() {
  const profile = await requireRole(["buyer"]);
  const supabase = await createClient();

  // 1. Transactions
  const { data: orders } = await supabase
    .from("transactions")
    .select(
      "id, listing_id, offer_id, farmer_id, final_price_per_kg, quantity_kg, gross_amount, escrow_amount_paid, logistics_cost_per_kg, distance_km, vehicle_type, status, created_at"
    )
    .eq("buyer_id", profile.id)
    .order("created_at", { ascending: false });

  const safeOrders = orders || [];

  // 2. Listings
  const listingIds = Array.from(new Set(safeOrders.map((o) => o.listing_id)));
  const { data: listings } =
    listingIds.length > 0
      ? await supabase
          .from("listings")
          .select("id, crop, quality_grade")
          .in("id", listingIds)
      : { data: [] };
  const listingMap = new Map((listings || []).map((l) => [l.id, l]));

  // 3. Farmers via public_profiles
  const farmerIds = Array.from(new Set(safeOrders.map((o) => o.farmer_id)));
  const { data: farmers } =
    farmerIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, district, state, trust_score, business_name")
          .in("id", farmerIds)
      : { data: [] };
  const farmerMap = new Map((farmers || []).map((f) => [f.id, f]));

  const totalSpend = safeOrders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.gross_amount || 0), 0);

  const inProgress = safeOrders.filter(
    (o) => !["completed", "cancelled"].includes(o.status)
  ).length;

  return (
    <DashboardShell
      profile={profile}
      showBack={false}
      title="My orders"
      subtitle="Track every purchase from placement to delivery."
    >
      <div className="grid gap-5 md:grid-cols-3">
        <Stat label="Total orders" value={safeOrders.length} />
        <Stat label="In progress" value={inProgress} accent="amber" />
        <Stat
          label="Total spent"
          value={`₹${totalSpend.toLocaleString("en-IN")}`}
        />
      </div>

      <div className="mt-10 space-y-6">
        {safeOrders.length === 0 ? (
          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              No orders yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A74]">
              Once a farmer accepts your offer, the order appears here with
              real-time status.
            </p>
            <Link
              href="/buyer/browse"
              className="mt-6 inline-block rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-medium text-white"
            >
              Browse produce
            </Link>
          </div>
        ) : (
          safeOrders.map((o) => {
            const l = listingMap.get(o.listing_id);
            const f = farmerMap.get(o.farmer_id);

            return (
              <div
                key={o.id}
                className="rounded-[24px] border border-[#E4EBE6] bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold">
                      {l?.crop ?? "Order"}{" "}
                      {l?.quality_grade && (
                        <span className="ml-1 rounded-full bg-[#EAF5EE] px-2 py-0.5 text-[10px] font-medium text-[#2E7D32]">
                          Grade {l.quality_grade}
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-xs text-[#6B7A74]">
                      Farmer:{" "}
                      <strong>{f?.business_name || f?.full_name || "—"}</strong>
                      {f?.district && ` · ${f.district}, ${f.state}`}
                      {o.distance_km ? ` · ${o.distance_km} km` : ""}
                      {o.vehicle_type ? ` · ${o.vehicle_type}` : ""}
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

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <Field
                    label="Deal price"
                    value={`₹${Number(o.final_price_per_kg).toFixed(2)}/kg`}
                  />
                  <Field label="Quantity" value={`${o.quantity_kg} kg`} />
                  <Field
                    label="Total payable"
                    value={`₹${Number(o.gross_amount).toLocaleString("en-IN")}`}
                    accent
                  />
                </div>

                                <div className="mt-5">
                  <Timeline status={o.status} createdAt={o.created_at} />
                </div>

                {o.status === "escrow_pending" && (
                  <div className="mt-5 flex justify-end border-t border-[#E4EBE6] pt-5">
                    <PayEscrowButton
                      orderId={o.id}
                      amount={Number((Number(o.gross_amount) * 0.3).toFixed(2))}
                    />
                  </div>
                )}

                {o.status === "delivered" && (
                  <div className="mt-5 flex justify-end border-t border-[#E4EBE6] pt-5">
                    <ConfirmDeliveryButton
                      orderId={o.id}
                      finalAmount={Number(
                        (
                          Number(o.gross_amount) -
                          Number(o.gross_amount) * 0.3
                        ).toFixed(2)
                      )}
                    />
                  </div>
                )}
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
  accent?: "amber";
}) {
  const color = accent === "amber" ? "text-[#B26A00]" : "text-[#1B4D3E]";
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