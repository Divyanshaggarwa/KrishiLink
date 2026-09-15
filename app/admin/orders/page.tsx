export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import Timeline from "@/components/orders/Timeline";
import { AdminShipButton, AdminDeliverButton } from "./AdminOrderButtons";

export default async function AdminOrdersPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("transactions")
    .select(
      "id, listing_id, farmer_id, buyer_id, final_price_per_kg, quantity_kg, gross_amount, escrow_amount_paid, distance_km, vehicle_type, transport_mode, status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const safeOrders = orders || [];

  const listingIds = Array.from(new Set(safeOrders.map((o) => o.listing_id)));
  const { data: listings } =
    listingIds.length > 0
      ? await supabase.from("listings").select("id, crop").in("id", listingIds)
      : { data: [] };
  const listingMap = new Map((listings || []).map((l) => [l.id, l]));

  const userIds = Array.from(
    new Set([...safeOrders.map((o) => o.farmer_id), ...safeOrders.map((o) => o.buyer_id)])
  );
  const { data: users } =
    userIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, business_name")
          .in("id", userIds)
      : { data: [] };
  const userMap = new Map((users || []).map((u) => [u.id, u]));

  return (
    <DashboardShell
      profile={profile}
      title="All orders"
      subtitle="Admin control centre — mark shipments and deliveries for the demo."
    >
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]">
          ← Back to overview
        </Link>
      </div>

      <div className="space-y-6">
        {safeOrders.length === 0 ? (
          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center text-sm text-[#6B7A74]">
            No orders on the platform yet.
          </div>
        ) : (
          safeOrders.map((o) => {
            const l = listingMap.get(o.listing_id);
            const farmer = userMap.get(o.farmer_id);
            const buyer = userMap.get(o.buyer_id);

            return (
              <div
                key={o.id}
                className="rounded-[24px] border border-[#E4EBE6] bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold">
                      {l?.crop ?? "Order"}{" "}
                      <span className="ml-1 rounded-full bg-[#F8F9FA] px-2 py-0.5 text-[10px] font-medium text-[#6B7A74]">
                        #{o.id.slice(0, 8)}
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-[#6B7A74]">
                      Farmer: <strong>{farmer?.full_name}</strong> · Buyer:{" "}
                      <strong>{buyer?.business_name || buyer?.full_name}</strong>{" "}
                      · {o.distance_km} km ·{" "}
                      {o.transport_mode === "self"
                        ? "Farmer's own transport"
                        : "KrishiLink transport"}
                    </p>
                  </div>
                  <span className="text-xs text-[#6B7A74]">
                    {new Date(o.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <Field
                    label="Deal price"
                    value={`₹${Number(o.final_price_per_kg).toFixed(2)}/kg`}
                  />
                  <Field label="Quantity" value={`${o.quantity_kg} kg`} />
                  <Field
                    label="Total"
                    value={`₹${Number(o.gross_amount).toLocaleString("en-IN")}`}
                  />
                  <Field
                    label="Advance paid"
                    value={`₹${Number(o.escrow_amount_paid || 0).toLocaleString("en-IN")}`}
                  />
                </div>

                <div className="mt-5">
                  <Timeline status={o.status} createdAt={o.created_at} />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#E4EBE6] pt-5">
                  {o.status === "escrow_paid" && (
                    <AdminShipButton orderId={o.id} />
                  )}
                  {o.status === "in_transit" && (
                    <AdminDeliverButton orderId={o.id} />
                  )}
                  {o.status === "delivered" && (
                    <p className="text-xs text-[#6B7A74]">
                      Awaiting buyer confirmation to release final payment.
                    </p>
                  )}
                  {o.status === "completed" && (
                    <p className="text-xs font-semibold text-[#2E7D32]">
                      ✓ Order completed
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}