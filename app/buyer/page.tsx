import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function BuyerDashboard() {
  const profile = await requireRole(["buyer"]);
  const supabase = await createClient();

  const [
    availableRes,
    myBidsRes,
    acceptedRes,
    recentListingsRes,
    recentOffersRes,
  ] = await Promise.all([
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("offers")
      .select("*", { count: "exact", head: true })
      .eq("buyer_id", profile.id),
    supabase
      .from("offers")
      .select("*", { count: "exact", head: true })
      .eq("buyer_id", profile.id)
      .eq("status", "accepted"),
    supabase
      .from("listings")
      .select(
        "id, crop, quality_grade, quantity_kg, expected_price_per_kg, district, state, photo_url, created_at"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("offers")
      .select(
        "id, price_per_kg, quantity_kg, status, created_at, listing:listings!inner(id, crop, photo_url)"
      )
      .eq("buyer_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const available = availableRes.count ?? 0;
  const myBids = myBidsRes.count ?? 0;
  const accepted = acceptedRes.count ?? 0;
  const recentListings = recentListingsRes.data || [];
  const recentOffers = recentOffersRes.data || [];

  return (
        <DashboardShell
      profile={profile}
      showBack={false}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle="Procurement dashboard — source verified produce directly from farmers."
    >
      {/* Stats row */}
      <div className="grid gap-5 md:grid-cols-4">
        <StatCard
          label="Available listings"
          value={available}
          hint="Fresh produce live right now"
          icon={<TrayIcon />}
        />
        <StatCard
          label="My bids"
          value={myBids}
          hint="Offers placed total"
          icon={<TagIcon />}
        />
        <StatCard
          label="Accepted deals"
          value={accepted}
          hint="Ready for delivery"
          icon={<CheckIcon />}
          accent={accepted > 0 ? "green" : undefined}
        />
        <StatCard
          label="Trust score"
          value={profile.trust_score ?? 50}
          hint="Builds after each trade"
          icon={<ShieldIcon />}
        />
      </div>

      {/* Action grid */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <FeatureCard
          href="/buyer/browse"
          tag="Source"
          title="Browse verified produce"
          desc="Filter by crop, grade, district, quantity. Place competitive offers with transparent net realization math."
          dark
        />
        <FeatureCard
          href="/buyer/bids"
          tag="Track"
          title="My bids"
          desc="See every offer you've placed — pending, accepted, and rejected — with full status and deal value."
        />
      </div>

      {/* Recent listings preview */}
      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Fresh on the marketplace</h2>
            <p className="mt-1 text-sm text-[#6B7A74]">
              Latest verified listings from farmers
            </p>
          </div>
          <Link
            href="/buyer/browse"
            className="text-sm font-medium text-[#2E7D32] hover:underline"
          >
            View all →
          </Link>
        </div>

        {recentListings.length === 0 ? (
          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-10 text-center text-sm text-[#6B7A74]">
            No active listings yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {recentListings.map((l) => (
              <Link
                key={l.id}
                href={`/buyer/browse/${l.id}`}
                className="group overflow-hidden rounded-[20px] border border-[#E4EBE6] bg-white transition-all hover:-translate-y-1 hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.3)]"
              >
                <div className="relative h-32 w-full overflow-hidden bg-[#EAF5EE]">
                  {l.photo_url ? (
                    <Image
                      src={l.photo_url}
                      alt={l.crop}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl">
                      🌾
                    </div>
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1B4D3E]">
                    Grade {l.quality_grade ?? "—"}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-display text-sm font-bold">{l.crop}</p>
                  <p className="mt-0.5 text-[11px] text-[#6B7A74]">
                    {l.quantity_kg} kg · {l.district}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#1B4D3E]">
                    ₹{l.expected_price_per_kg}/kg
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent offers */}
      {recentOffers.length > 0 && (
        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Your recent bids</h2>
              <p className="mt-1 text-sm text-[#6B7A74]">
                Latest offers you&apos;ve placed
              </p>
            </div>
            <Link
              href="/buyer/bids"
              className="text-sm font-medium text-[#2E7D32] hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                <tr>
                  <th className="px-6 py-3 font-medium">Crop</th>
                  <th className="px-4 py-3 font-medium">Bid</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-6 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOffers.map((o) => {
                  const l = Array.isArray(o.listing) ? o.listing[0] : o.listing;
                  return (
                    <tr key={o.id} className="border-t border-[#E4EBE6]">
                      <td className="px-6 py-3 font-medium">{l?.crop}</td>
                      <td className="px-4 py-3">
                        ₹{Number(o.price_per_kg).toFixed(2)}/kg
                      </td>
                      <td className="px-4 py-3">{o.quantity_kg} kg</td>
                      <td className="px-6 py-3 text-right">
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </DashboardShell>
  );
}

/* ---------- Helpers ---------- */

function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
  accent?: "green";
}) {
  const valueColor = accent === "green" ? "text-[#2E7D32]" : "text-[#1B4D3E]";
  return (
    <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-[#6B7A74]">
          {label}
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5EE] text-[#1B4D3E]">
          {icon}
        </span>
      </div>
      <p className={`font-display mt-3 text-3xl font-extrabold ${valueColor}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-[#6B7A74]">{hint}</p>}
    </div>
  );
}

function FeatureCard({
  href,
  tag,
  title,
  desc,
  dark,
}: {
  href: string;
  tag: string;
  title: string;
  desc: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-[24px] border p-7 transition-all duration-300 hover:-translate-y-1 ${
        dark
          ? "border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#123528] text-white hover:shadow-[0_25px_50px_-20px_rgba(27,77,62,0.5)]"
          : "border-[#E4EBE6] bg-white hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.3)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
            dark ? "bg-white/10 text-[#A5D6A7]" : "bg-[#EAF5EE] text-[#2E7D32]"
          }`}
        >
          {tag}
        </span>
        <span
          className={`transition-transform group-hover:translate-x-1 ${
            dark ? "text-[#A5D6A7]" : "text-[#2E7D32]"
          }`}
        >
          →
        </span>
      </div>
      <h3
        className={`font-display mt-5 text-xl font-bold ${
          dark ? "text-white" : "text-[#1B4D3E]"
        }`}
      >
        {title}
      </h3>
      <p
        className={`mt-2 text-sm leading-relaxed ${
          dark ? "text-white/80" : "text-[#6B7A74]"
        }`}
      >
        {desc}
      </p>
    </Link>
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

/* ---------- Icons ---------- */

function TrayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 8l2-4h14l2 4" />
      <path d="M9 12h6" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}