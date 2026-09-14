import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import { AcceptButton, RejectButton } from "./OfferActions";
import {
  calculateNetRealization,
  estimateDistanceFromDistricts,
  type QualityGrade,
} from "@/lib/netRealization";

export default async function OffersReceivedPage() {
  const profile = await requireRole(["farmer"]);
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, crop, quantity_kg, quality_grade, district, state, expected_price_per_kg, status")
    .eq("farmer_id", profile.id);

  if (!listings || listings.length === 0) {
    return (
      <DashboardShell
        profile={profile}
        title="Offers received"
        subtitle="Every buyer offer ranked by the money you actually take home."
      >
        <EmptyState
          title="No listings yet"
          body="Publish your first crop to start receiving offers from verified buyers."
          cta={{ href: "/farmer/list", label: "List produce" }}
        />
      </DashboardShell>
    );
  }

  const listingMap = new Map(listings.map((l) => [l.id, l]));
  const listingIds = listings.map((l) => l.id);

  const { data: offers } = await supabase
    .from("offers")
    .select("id, listing_id, buyer_id, price_per_kg, quantity_kg, pickup_mode, message, status, created_at")
    .in("listing_id", listingIds)
    .order("created_at", { ascending: false });

  if (!offers || offers.length === 0) {
    return (
      <DashboardShell
        profile={profile}
        title="Offers received"
        subtitle="Every buyer offer ranked by the money you actually take home."
      >
        <EmptyState
          title="No offers yet"
          body="Once a buyer places an offer on one of your listings, it will appear here — ranked by net realization."
          cta={{ href: "/farmer/listings", label: "View my listings" }}
        />
      </DashboardShell>
    );
  }

  // Safe buyer info — no phone, no email
  const buyerIds = Array.from(new Set(offers.map((o) => o.buyer_id)));
  const { data: buyers } = await supabase
    .from("public_profiles")
    .select("id, full_name, district, state, trust_score, business_name")
    .in("id", buyerIds);

  const buyerMap = new Map((buyers || []).map((b) => [b.id, b]));

  const rows = offers.map((o) => {
    const l = listingMap.get(o.listing_id)!;
    const b = buyerMap.get(o.buyer_id);

    const distance = estimateDistanceFromDistricts(
      l.district,
      l.state,
      b?.district ?? null,
      b?.state ?? null
    );

    const grade = (l.quality_grade ?? "A") as QualityGrade;
    const breakdown = calculateNetRealization(
      {
        pricePerKg: o.price_per_kg,
        quantityKg: o.quantity_kg,
        distanceKm: distance,
      },
      grade
    );

    return {
      offerId: o.id,
      listingId: l.id,
      crop: l.crop,
      quantityKg: l.quantity_kg,
      grade,
      buyerName: b?.full_name ?? "Buyer",
      buyerBusiness: b?.business_name ?? null,
      buyerDistrict: b?.district ?? null,
      buyerState: b?.state ?? null,
      buyerTrust: Number(b?.trust_score ?? 50),
      pricePerKg: Number(o.price_per_kg),
      offerQty: Number(o.quantity_kg),
      pickupMode: o.pickup_mode,
      message: o.message,
      createdAt: o.created_at,
      status: o.status,
      distanceKm: breakdown.distanceKm,
      transportCostPerKg: breakdown.transportCostPerKg,
      transactionCostPerKg: breakdown.transactionCostPerKg,
      qualityDeduction: breakdown.qualityDeduction,
      netPerKg: breakdown.netRealizationPerKg,
      netTotal: breakdown.netAmount,
    };
  });

  const grouped = new Map<string, typeof rows>();
  rows.forEach((r) => {
    if (!grouped.has(r.listingId)) grouped.set(r.listingId, []);
    grouped.get(r.listingId)!.push(r);
  });
  grouped.forEach((arr) => arr.sort((a, b) => b.netPerKg - a.netPerKg));

  return (
    <DashboardShell
      profile={profile}
      title="Offers received"
      subtitle="Every buyer offer ranked by NET REALIZATION — what actually reaches your hand after logistics and transaction costs."
    >
      <div className="space-y-10">
        {Array.from(grouped.entries()).map(([listingId, list]) => {
          const l = listingMap.get(listingId)!;
          const best = list[0];
          const bestNet = best.netPerKg;

          return (
            <section
              key={listingId}
              className="rounded-[24px] border border-[#E4EBE6] bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4EBE6] px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold">
                    {l.crop}
                    <span className="ml-2 rounded-full bg-[#EAF5EE] px-2.5 py-0.5 text-xs font-medium text-[#2E7D32]">
                      Grade {l.quality_grade ?? "—"}
                    </span>
                    <span className="ml-2 rounded-full bg-[#F8F9FA] px-2.5 py-0.5 text-xs font-medium text-[#6B7A74]">
                      {l.quantity_kg} kg available
                    </span>
                  </h2>
                  <p className="mt-1 text-xs text-[#6B7A74]">
                    You asked ₹{l.expected_price_per_kg}/kg · {list.length}{" "}
                    offer{list.length > 1 ? "s" : ""} · {l.district}, {l.state}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    l.status === "active"
                      ? "bg-[#EAF5EE] text-[#2E7D32]"
                      : l.status === "sold"
                      ? "bg-[#E3F2FD] text-[#1565C0]"
                      : "bg-[#F5F5F5] text-[#6B7A74]"
                  }`}
                >
                  {l.status}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Buyer</th>
                      <th className="px-4 py-3 font-medium">Offer ₹/kg</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Distance</th>
                      <th className="px-4 py-3 font-medium">− Transport</th>
                      <th className="px-4 py-3 font-medium">− Txn</th>
                      <th className="px-4 py-3 font-medium">− Quality</th>
                      <th className="px-4 py-3 font-medium text-[#1B4D3E]">
                        Net ₹/kg
                      </th>
                      <th className="px-4 py-3 font-medium">Net total</th>
                      <th className="px-6 py-3 font-medium text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r, idx) => {
                      const isBest = idx === 0 && r.status === "pending";
                      const isPending = r.status === "pending";

                      return (
                        <tr
                          key={r.offerId}
                          className={`border-t border-[#E4EBE6] ${
                            isBest ? "bg-[#F4FBF5]" : ""
                          } ${!isPending ? "opacity-70" : ""}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF5EE] text-xs font-semibold text-[#1B4D3E]">
                                {r.buyerName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {r.buyerBusiness || r.buyerName}
                                </p>
                                <p className="text-[11px] text-[#6B7A74]">
                                  {r.buyerDistrict || "—"},{" "}
                                  {r.buyerState || "—"} · Trust {r.buyerTrust}
                                </p>
                              </div>
                              {isBest && (
                                <span className="ml-1 rounded-full bg-[#1B4D3E] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                  Best deal
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 font-semibold">
                            ₹{r.pricePerKg.toFixed(2)}
                          </td>
                          <td className="px-4 py-4">{r.offerQty} kg</td>
                          <td className="px-4 py-4 text-[#6B7A74]">
                            {r.distanceKm} km
                          </td>
                          <td className="px-4 py-4 text-[#C62828]">
                            −₹{r.transportCostPerKg.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-[#C62828]">
                            −₹{r.transactionCostPerKg.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-[#C62828]">
                            −₹{r.qualityDeduction.toFixed(2)}
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-display text-lg font-extrabold text-[#1B4D3E]">
                              ₹{r.netPerKg.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-4 font-semibold">
                            ₹{r.netTotal.toLocaleString("en-IN")}
                          </td>
                          <td className="px-6 py-4">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <RejectButton offerId={r.offerId} />
                                <AcceptButton offerId={r.offerId} />
                              </div>
                            ) : (
                              <span
                                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                                  r.status === "accepted"
                                    ? "bg-[#E3F2FD] text-[#1565C0]"
                                    : "bg-[#F5F5F5] text-[#6B7A74]"
                                }`}
                              >
                                {r.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {list.some((r) => r.status === "pending") && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#E4EBE6] bg-[#FAFCFA] px-6 py-3 text-xs text-[#6B7A74]">
                  <span>
                    <strong className="text-[#1B4D3E]">
                      Best net: ₹{bestNet.toFixed(2)}/kg
                    </strong>{" "}
                    from {best.buyerBusiness || best.buyerName}
                  </span>
                  <span>
                    Difference from worst: ₹
                    {(bestNet - list[list.length - 1].netPerKg).toFixed(2)}/kg
                  </span>
                  <span>
                    On your full {l.quantity_kg} kg: ₹
                    {(bestNet * l.quantity_kg).toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </DashboardShell>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
      <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A74]">{body}</p>
      <Link
        href={cta.href}
        className="mt-6 inline-block rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-medium text-white"
      >
        {cta.label}
      </Link>
    </div>
  );
}