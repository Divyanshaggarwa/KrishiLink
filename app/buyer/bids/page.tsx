import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function MyBidsPage() {
  const profile = await requireRole(["buyer"]);
  const supabase = await createClient();

  const { data: offers } = await supabase
    .from("offers")
    .select(
      "id, price_per_kg, quantity_kg, status, created_at, pickup_mode, listing:listings!inner(id, crop, quality_grade, district, state, photo_url, status)"
    )
    .eq("buyer_id", profile.id)
    .order("created_at", { ascending: false });

  const safeOffers = offers || [];

  const counts = {
    pending: safeOffers.filter((o) => o.status === "pending").length,
    accepted: safeOffers.filter((o) => o.status === "accepted").length,
    rejected: safeOffers.filter((o) => o.status === "rejected").length,
    total: safeOffers.length,
  };

  return (
    <DashboardShell
      profile={profile}
      showBack={false}
      title="My bids"
      subtitle="Every offer you've placed — pending, accepted, and rejected."
    >
      {counts.accepted > 0 && (
        <div className="mb-6 rounded-[24px] border border-[#A5D6A7] bg-[#EAF5EE] p-5">
          <p className="text-sm font-semibold text-[#1B4D3E]">
            🎉 {counts.accepted} of your offers {counts.accepted === 1 ? "was" : "were"} accepted
          </p>
          <p className="mt-1 text-xs text-[#1B4D3E]/80">
            Head to{" "}
            <Link href="/buyer/orders" className="font-semibold underline">
              My orders
            </Link>{" "}
            to track delivery and payment.
          </p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-4">
        <Stat label="Total bids" value={counts.total} />
        <Stat label="Pending" value={counts.pending} accent="amber" />
        <Stat label="Accepted" value={counts.accepted} accent="green" />
        <Stat label="Rejected" value={counts.rejected} accent="red" />
      </div>

      <div className="mt-10">
        {safeOffers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Listing</th>
                    <th className="px-4 py-3 font-medium">Your bid</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Placed</th>
                    <th className="px-6 py-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {safeOffers.map((o) => {
                    const l = Array.isArray(o.listing)
                      ? o.listing[0]
                      : o.listing;
                    const total =
                      Number(o.price_per_kg) * Number(o.quantity_kg);

                    return (
                      <tr
                        key={o.id}
                        className="border-t border-[#E4EBE6] hover:bg-[#FAFCFA]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {l?.photo_url ? (
                              <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                                <Image
                                  src={l.photo_url}
                                  alt={l.crop}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF5EE] text-lg">
                                🌾
                              </div>
                            )}
                            <div>
                              <Link
                                href={`/buyer/browse/${l?.id}`}
                                className="font-medium hover:text-[#2E7D32]"
                              >
                                {l?.crop}
                              </Link>
                              <p className="text-[11px] text-[#6B7A74]">
                                Grade {l?.quality_grade} · {l?.district},{" "}
                                {l?.state}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold">
                          ₹{Number(o.price_per_kg).toFixed(2)}/kg
                        </td>
                        <td className="px-4 py-4">{o.quantity_kg} kg</td>
                        <td className="px-4 py-4 font-medium">
                          ₹{total.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-4 text-[#6B7A74]">
                          {new Date(o.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {o.status === "accepted" ? (
                            <div className="flex items-center justify-end gap-2">
                              <StatusBadge status={o.status} />
                              <Link
                                href="/buyer/orders"
                                className="rounded-full bg-[#1B4D3E] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white hover:scale-105 transition-transform"
                              >
                                View order →
                              </Link>
                            </div>
                          ) : (
                            <StatusBadge status={o.status} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
  value: number;
  accent?: "green" | "amber" | "red";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "amber"
      ? "text-[#B26A00]"
      : accent === "red"
      ? "text-[#C62828]"
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-[#FFF8E1] text-[#B26A00]",
    accepted: "bg-[#E3F2FD] text-[#1565C0]",
    rejected: "bg-[#FFF5F5] text-[#C62828]",
    withdrawn: "bg-[#F5F5F5] text-[#6B7A74]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        styles[status] ?? styles.withdrawn
      }`}
    >
      {status}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
      <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
        No bids yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7A74]">
        Browse verified produce and place your first offer. You&apos;ll see
        every bid here with its status.
      </p>
      <Link
        href="/buyer/browse"
        className="mt-6 inline-block rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-medium text-white"
      >
        Browse produce
      </Link>
    </div>
  );
}