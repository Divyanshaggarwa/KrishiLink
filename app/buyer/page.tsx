export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import VerificationStatusCard from "@/components/VerificationStatusCard";

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
        "id, price_per_kg, quantity_kg, status, created_at, listing:listings(id, crop, photo_url)"
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

  const location = [profile.district, profile.state]
    .filter(Boolean)
    .join(", ");

  return (
    <DashboardShell
      profile={profile}
      showBack={false}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle="Procurement dashboard — source verified produce directly from farmers."
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          label="Available listings"
          value={available}
          hint="Fresh produce live"
          icon={<TrayIcon />}
          accent="green"
        />
        <StatCard
          label="My bids"
          value={myBids}
          hint="Offers placed"
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

      <VerificationStatusCard profile={profile} role="buyer" />

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4EBE6] px-5 py-3.5 md:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF5EE] text-[#1B4D3E]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7A74]">
              Account details
            </p>
          </div>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:p-6">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Full name" value={profile.full_name} />
            <Detail label="Mobile" value={profile.phone ?? "—"} />
            <Detail
              label="Business name"
              value={profile.business_name ?? "—"}
              span={2}
            />
            <Detail label="Location" value={location || "—"} span={2} />
            <Detail
              label="GST number"
              value={profile.gst_number ?? "—"}
              mono
            />
            <Detail
              label="Trust score"
              value={`${profile.trust_score ?? 50} / 100`}
              accent
            />
            <Detail
              label="Language"
              value={
                profile.language === "hi"
                  ? "हिन्दी"
                  : profile.language === "kn"
                    ? "ಕನ್ನಡ"
                    : "English"
              }
            />
            <Detail
              label="Member since"
              value={
                profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
            />
          </div>

          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-[#C8E6C9] bg-gradient-to-br from-[#EAF5EE] to-white p-5 md:w-60">
            <div
              className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#A5D6A7] opacity-40 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32]" />
                KrishiLink ID
              </div>
              <p className="font-display mt-2 select-all text-2xl font-extrabold tracking-wider text-[#1B4D3E] md:text-3xl">
                {profile.krishilink_id ?? "—"}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[#6B7A74]">
                Your verified buyer identity on the KrishiLink marketplace.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/buyer/browse"
          className="group relative overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] p-6 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_50px_-20px_rgba(27,77,62,0.55)] md:col-span-2 lg:row-span-2"
        >
          <div
            className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#A5D6A7]/15 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex h-full min-h-[180px] flex-col">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
                Source
              </span>
              <span className="text-[#A5D6A7] transition-transform group-hover:translate-x-1">
                →
              </span>
            </div>
            <div className="mt-auto pt-14">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-[#A5D6A7]">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <path d="M3 8l2-4h14l2 4" />
                  <path d="M9 12h6" />
                </svg>
              </span>
              <h3 className="font-display mt-4 text-xl font-bold md:text-2xl">
                Browse verified produce
              </h3>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-white/75 md:text-sm">
                Filter by crop, grade, district, quantity. Place competitive
                offers with transparent net realization math.
              </p>
            </div>
          </div>
        </Link>

        <ActionTile
          href="/buyer/pools"
          label="FPO Pools"
          desc="Buy from farmer collectives"
          tag="Collective"
        />
        <ActionTile
          href="/buyer/bids"
          label="My bids"
          desc="Track every offer you placed"
          tag={myBids > 0 ? `${myBids} placed` : "None yet"}
        />
        <ActionTile
          href="/buyer/orders"
          label="Orders"
          desc="Track deliveries & payouts"
          tag={accepted > 0 ? `${accepted} accepted` : "Active"}
        />
      </div>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">
              Fresh on the marketplace
            </h2>
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

      {recentOffers.length > 0 && (
        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">
                Your recent bids
              </h2>
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
    <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-4 md:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#6B7A74] md:text-[11px]">
          {label}
        </p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF5EE] text-[#1B4D3E]">
          {icon}
        </span>
      </div>
      <p
        className={`font-display mt-2 text-2xl font-extrabold md:text-3xl ${valueColor}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[10px] text-[#6B7A74] md:text-[11px]">{hint}</p>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  accent,
  mono,
  span,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
  span?: 2;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : "min-w-0"}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-semibold ${
          accent ? "text-[#1B4D3E]" : "text-[#0F1F1A]"
        } ${mono ? "font-mono tracking-wide" : ""}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function ActionTile({
  href,
  label,
  desc,
  tag,
}: {
  href: string;
  label: string;
  desc: string;
  tag: string;
}) {
  return (
    <Link
      href={href}
      className="group relative rounded-[24px] border border-[#E4EBE6] bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.25)]"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#EAF5EE] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#2E7D32]">
          {tag}
        </span>
        <span className="text-[#6B7A74] transition-transform group-hover:translate-x-1">
          →
        </span>
      </div>
      <h3 className="font-display mt-5 text-base font-bold text-[#1B4D3E]">
        {label}
      </h3>
      <p className="mt-1 text-xs text-[#6B7A74]">{desc}</p>
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

function TrayIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 8l2-4h14l2 4" />
      <path d="M9 12h6" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}