export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import Timeline from "@/components/orders/Timeline";
import { PayEscrowButton, ConfirmDeliveryButton } from "./OrderButtons";
import { loadFeeConfig } from "@/lib/nre/fetch-config";

export default async function BuyerOrdersPage() {
  const profile = await requireRole(["buyer"]);
  const supabase = await createClient();

  // 1. Buyer wallet balance (for button gating)
  const { data: walletData } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", profile.id)
    .maybeSingle();

  const buyerBalance = Number(walletData?.balance ?? 0);

  // 2. All buyer transactions (listing-based OR pool-based)
  const { data: orders } = await supabase
    .from("transactions")
    .select(
      "id, listing_id, pool_id, offer_id, farmer_id, final_price_per_kg, quantity_kg, gross_amount, buyer_total_payable, escrow_amount_paid, logistics_cost_per_kg, distance_km, vehicle_type, status, created_at"
    )
    .eq("buyer_id", profile.id)
    .order("created_at", { ascending: false });

  const safeOrders = orders || [];
  const fees = await loadFeeConfig();

  // 3. Listings lookup
  const listingIds = Array.from(
    new Set(safeOrders.map((o) => o.listing_id).filter(Boolean))
  ) as string[];

  const { data: listings } =
    listingIds.length > 0
      ? await supabase
          .from("listings")
          .select("id, crop, quality_grade")
          .in("id", listingIds)
      : { data: [] as never[] };

  const listingMap = new Map((listings || []).map((l) => [l.id, l]));

  // 4. Pools lookup
  const poolIds = Array.from(
    new Set(safeOrders.map((o) => o.pool_id).filter(Boolean))
  ) as string[];

  const { data: pools } =
    poolIds.length > 0
      ? await supabase
          .from("fpo_pools")
          .select("id, crop, quality_grade, fpo_id")
          .in("id", poolIds)
      : { data: [] as never[] };

  const poolMap = new Map((pools || []).map((p) => [p.id, p]));

  // 5. Sellers (farmers + FPO heads)
  const sellerIds = Array.from(
    new Set([
      ...safeOrders.map((o) => o.farmer_id),
      ...((pools || []).map((p) => p.fpo_id).filter(Boolean) as string[]),
    ])
  );

  const { data: sellers } =
    sellerIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, district, state, trust_score, business_name")
          .in("id", sellerIds)
      : { data: [] as never[] };

  const sellerMap = new Map((sellers || []).map((s) => [s.id, s]));

  // 6. Summary stats
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
      subtitle="Track every purchase — individual listings and FPO pools."
    >
      {/* Wallet strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#C8E6C9] bg-[#EAF5EE] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
            Wallet balance
          </p>
          <p className="font-display mt-1 text-2xl font-extrabold text-[#1B4D3E]">
            ₹{buyerBalance.toLocaleString("en-IN")}
          </p>
        </div>
        <Link
          href="/wallet"
          className="rounded-full bg-[#1B4D3E] px-5 py-2.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03]"
        >
          Top up wallet →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-5 md:grid-cols-3">
        <Stat label="Total orders" value={safeOrders.length} />
        <Stat label="In progress" value={inProgress} accent="amber" />
        <Stat
          label="Total spent"
          value={`₹${totalSpend.toLocaleString("en-IN")}`}
        />
      </div>

      {/* Orders list */}
      <div className="mt-10 space-y-6">
        {safeOrders.length === 0 ? (
          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              No orders yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A74]">
              Once a seller accepts your offer, the order appears here with
              real-time status.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link
                href="/buyer/browse"
                className="rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-medium text-white"
              >
                Browse produce
              </Link>
              <Link
                href="/buyer/pools"
                className="rounded-full border border-[#1B4D3E] px-6 py-3 text-sm font-medium text-[#1B4D3E]"
              >
                Browse FPO pools
              </Link>
            </div>
          </div>
        ) : (
          safeOrders.map((o) => {
            const isPool = !!o.pool_id;
            const listing = o.listing_id
              ? listingMap.get(o.listing_id)
              : undefined;
            const pool = o.pool_id ? poolMap.get(o.pool_id) : undefined;
            const seller = isPool
              ? pool?.fpo_id
                ? sellerMap.get(pool.fpo_id)
                : undefined
              : sellerMap.get(o.farmer_id);

            const crop = isPool ? pool?.crop : listing?.crop;
            const grade = isPool ? pool?.quality_grade : listing?.quality_grade;

            return (
              <div
                key={o.id}
                className="rounded-[24px] border border-[#E4EBE6] bg-white p-6"
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold">
                        {crop ?? "Order"}
                      </h3>
                      {grade && (
                        <span className="rounded-full bg-[#EAF5EE] px-2 py-0.5 text-[10px] font-medium text-[#2E7D32]">
                          Grade {grade}
                        </span>
                      )}
                      {isPool && (
                        <span className="rounded-full bg-[#1B4D3E] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                          FPO pool
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#6B7A74]">
                      {isPool ? "FPO head" : "Farmer"}:{" "}
                      <strong>
                        {seller?.business_name || seller?.full_name || "—"}
                      </strong>
                      {seller?.district && ` · ${seller.district}`}
                      {o.distance_km ? ` · ${o.distance_km} km` : ""}
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

                {/* Details */}
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <Field
                    label="Deal price"
                    value={`₹${Number(o.final_price_per_kg).toFixed(2)}/kg`}
                  />
                  <Field label="Quantity" value={`${o.quantity_kg} kg`} />
                  <Field
                    label="Crop value"
                    value={`₹${Number(o.gross_amount).toLocaleString("en-IN")}`}
                  />
                  <Field
                    label="Total incl. fees/delivery"
                    value={`₹${getBuyerTotalPayable(o, fees).toLocaleString(
                      "en-IN"
                    )}`}
                    accent
                  />
                </div>

                {/* Timeline */}
                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/orders/${o.id}`}
                    className="rounded-full border border-[#1B4D3E] bg-white px-4 py-2 text-xs font-semibold text-[#1B4D3E] transition-colors hover:bg-[#EAF5EE]"
                  >
                    View delivery route →
                  </Link>
                </div>

                {/* Pool note */}
                {isPool && (
                  <p className="mt-4 rounded-xl bg-[#EAF5EE] p-3 text-[11px] text-[#1B4D3E]/85">
                    💡 Payment from this order is split among{" "}
                    <strong>all contributing FPO members</strong> by their
                    share.
                  </p>
                )}

                {/* Escrow payment button */}
                {o.status === "escrow_pending" && (
                  <div className="mt-5 flex justify-end border-t border-[#E4EBE6] pt-5">
                    <PayEscrowButton
                      orderId={o.id}
                      amount={Number((Number(o.gross_amount) * 0.3).toFixed(2))}
                      buyerBalance={buyerBalance}
                    />
                  </div>
                )}

                {/* Confirm delivery button */}
                {o.status === "delivered" && (
                  <div className="mt-5 flex justify-end border-t border-[#E4EBE6] pt-5">
                    <ConfirmDeliveryButton
                      orderId={o.id}
                      finalAmount={getFinalPaymentDue(o, fees)}
                      buyerBalance={buyerBalance}
                    />
                  </div>
                )}

                {/* Completed state */}
                {o.status === "completed" && (
                  <div className="mt-5 rounded-xl bg-[#EAF5EE] p-3 text-xs font-medium text-[#2E7D32]">
                    ✓ Order completed — payment released to seller
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

/* ------------------------------------------------------------------ */

function getFinalPaymentDue(
  order: {
    gross_amount: number;
    quantity_kg: number;
    logistics_cost_per_kg: number | null;
    escrow_amount_paid: number | null;
    buyer_total_payable?: number | null;
  },
  fees: Awaited<ReturnType<typeof loadFeeConfig>>
): number {
  const gross = Number(order.gross_amount);
  const buyerTotal = getBuyerTotalPayable(order, fees);
  const escrowPaid = Number(order.escrow_amount_paid ?? gross * 0.3);
  return Number(Math.max(0, buyerTotal - escrowPaid).toFixed(2));
}

function getBuyerTotalPayable(
  order: {
    gross_amount: number;
    quantity_kg: number;
    logistics_cost_per_kg: number | null;
    buyer_total_payable?: number | null;
  },
  fees: Awaited<ReturnType<typeof loadFeeConfig>>
): number {
  const gross = Number(order.gross_amount);
  const transportCost =
    Number(order.logistics_cost_per_kg ?? 0) * Number(order.quantity_kg);
  return (
    Number(order.buyer_total_payable) ||
    gross * (1 + (fees.buyer_fee_pct + fees.gateway_pct) / 100) +
      transportCost
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