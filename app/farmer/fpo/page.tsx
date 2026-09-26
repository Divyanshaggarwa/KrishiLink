export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function FarmerDashboard() {
  const profile = await requireRole(["farmer"]);
  const supabase = await createClient();

  const [listingsRes, activeRes, offersRes, ordersRes] = await Promise.all([
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("farmer_id", profile.id),
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("farmer_id", profile.id)
      .eq("status", "active"),
    supabase
      .from("offers")
      .select("id, listings!inner(farmer_id)", { count: "exact", head: true })
      .eq("listings.farmer_id", profile.id)
      .eq("status", "pending"),
    supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("farmer_id", profile.id),
  ]);

  const fpoStatus = profile.fpo_status;
  const fpoHref =
    fpoStatus === "approved" ? "/farmer/fpo/dashboard" : "/farmer/fpo";

  return (
    <DashboardShell
      profile={profile}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle="Your farm's marketplace dashboard."
    >
      {/* ============ STATS ROW ============ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat
          label="Total listings"
          value={listingsRes.count ?? 0}
          hint="All-time"
          accent="green"
        />
        <Stat
          label="Active listings"
          value={activeRes.count ?? 0}
          hint="Live now"
          accent="blue"
        />
        <Stat
          label="Pending offers"
          value={offersRes.count ?? 0}
          hint="Awaiting decision"
          accent={offersRes.count && offersRes.count > 0 ? "amber" : "gray"}
        />
        <Stat
          label="Orders"
          value={ordersRes.count ?? 0}
          hint="In pipeline"
          accent="purple"
        />
      </div>

      {/* ============ ACCOUNT DETAILS CARD ============ */}
      <div className="mt-6 overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
        <div className="flex items-center justify-between border-b border-[#E4EBE6] px-5 py-3 md:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            Account details
          </p>
          {profile.is_verified && (
            <span className="rounded-full bg-[#EAF5EE] px-2.5 py-0.5 text-[10px] font-semibold text-[#2E7D32]">
              ✓ Verified
            </span>
          )}
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Full name" value={profile.full_name} />
            <Detail
              label="KrishiLink ID"
              value={profile.krishilink_id ?? "Generating…"}
              mono
              accent
            />
            <Detail label="Mobile" value={profile.phone ?? "—"} />
            <Detail
              label="Location"
              value={
                [profile.village, profile.district, profile.state]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <Detail
              label="Preferred language"
              value={
                profile.language === "hi"
                  ? "हिन्दी"
                  : profile.language === "kn"
                  ? "ಕನ್ನಡ"
                  : "English"
              }
            />
            <Detail
              label="Trust score"
              value={`${profile.trust_score ?? 50} / 100`}
              accent
            />
            <Detail
              label="FPO status"
              value={
                fpoStatus === "approved"
                  ? `Active · ${profile.fpo_id ?? ""}`
                  : fpoStatus === "pending"
                  ? "Under review"
                  : fpoStatus === "rejected"
                  ? "Rejected"
                  : "Not registered"
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

          <div className="flex flex-col justify-center rounded-2xl border border-[#C8E6C9] bg-gradient-to-br from-[#EAF5EE] to-white p-5 md:w-64">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
              Your KrishiLink ID
            </p>
            <p className="font-display mt-2 select-all text-2xl font-extrabold tracking-wide text-[#1B4D3E]">
              {profile.krishilink_id ?? "—"}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-[#6B7A74]">
              Give this ID to anyone who helps you sell — family, PDS operator,
              or the IVR helpline.
            </p>
          </div>
        </div>
      </div>

      {/* ============ QUICK ACTIONS ============ */}
      <div className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F1F1A] md:text-xl">
              What would you like to do?
            </h2>
            <p className="mt-1 text-xs text-[#6B7A74] md:text-sm">
              Five ways to grow your farm income
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* List produce — big dark tile */}
          <Link
            href="/farmer/list"
            className="group relative overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] p-6 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_50px_-20px_rgba(27,77,62,0.55)] md:col-span-2 lg:row-span-2"
          >
            <div
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#A5D6A7]/15 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative flex h-full min-h-[180px] flex-col">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
                  Most used
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
                    <path d="M12 21v-8" />
                    <path d="M12 13c0-4 3-6 8-6 0 4-3 6-8 6z" />
                    <path d="M12 13c0-3-2.5-5-7-5 0 3.5 2.5 5 7 5z" />
                  </svg>
                </span>
                <h3 className="font-display mt-4 text-xl font-bold md:text-2xl">
                  List produce
                </h3>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-white/75 md:text-sm">
                  Post your harvest with a photo. AI grades the quality and
                  suggests a fair price. Publishes to verified buyers instantly.
                </p>
              </div>
            </div>
          </Link>

          <ActionTile
            href="/farmer/listings"
            label="My listings"
            desc="Track every crop"
            count={listingsRes.count ?? 0}
          />

          <ActionTile
            href="/farmer/offers"
            label="Offers received"
            desc="Compare by net"
            count={offersRes.count ?? 0}
            highlight={(offersRes.count ?? 0) > 0}
            accent="green"
          />

          <ActionTile
            href="/farmer/orders"
            label="Orders"
            desc="Track deliveries"
            count={ordersRes.count ?? 0}
          />

          {/* FPO tile — dynamic href based on approval */}
          <Link
            href={fpoHref}
            className="group relative overflow-hidden rounded-[24px] border border-[#C8E6C9] bg-gradient-to-br from-[#EAF5EE] to-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#2E7D32] hover:shadow-[0_25px_50px_-20px_rgba(46,125,50,0.3)] md:col-span-2"
          >
            <div className="flex items-start justify-between">
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                  fpoStatus === "approved"
                    ? "bg-[#2E7D32] text-white"
                    : fpoStatus === "pending"
                    ? "bg-[#FFF8E1] text-[#B26A00]"
                    : "bg-white text-[#2E7D32]"
                }`}
              >
                {fpoStatus === "approved"
                  ? `Active · ${profile.fpo_id ?? ""}`
                  : fpoStatus === "pending"
                  ? "Under review"
                  : "Register"}
              </span>
              <span className="text-[#2E7D32] transition-transform group-hover:translate-x-1">
                →
              </span>
            </div>

            <div className="mt-5 flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2E7D32] text-white">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M17.5 14.5c2.8.4 4.5 2.5 4.5 5.5" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-[#1B4D3E]">
                  FPO Collective
                </h3>
                <p className="mt-1 text-xs text-[#6B7A74]">
                  {fpoStatus === "approved"
                    ? `${profile.fpo_name ?? "Your FPO"} · ${
                        profile.fpo_member_count ?? 0
                      } members · Open dashboard`
                    : fpoStatus === "pending"
                    ? "Application under review"
                    : "Pool crops with nearby farmers"}
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "green" | "amber" | "blue" | "purple" | "gray";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "amber"
      ? "text-[#B26A00]"
      : accent === "blue"
      ? "text-[#1565C0]"
      : accent === "purple"
      ? "text-[#6A1B9A]"
      : "text-[#1B4D3E]";

  return (
    <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-4 md:p-5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6B7A74] md:text-[11px]">
        {label}
      </p>
      <p
        className={`font-display mt-2 text-2xl font-extrabold md:text-3xl ${color}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[10px] text-[#6B7A74] md:text-[11px]">
          {hint}
        </p>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
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
  count,
  highlight,
  accent,
}: {
  href: string;
  label: string;
  desc: string;
  count: number;
  highlight?: boolean;
  accent?: "green";
}) {
  return (
    <Link
      href={href}
      className={`group relative rounded-[24px] border bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.25)] ${
        highlight
          ? "border-[#1B4D3E]"
          : "border-[#E4EBE6] hover:border-[#2E7D32]"
      }`}
    >
      {highlight && count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#C62828] px-1.5 text-[10px] font-bold text-white shadow">
          {count > 9 ? "9+" : count}
        </span>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
          {count} total
        </span>
        <span
          className={`transition-transform group-hover:translate-x-1 ${
            accent === "green" ? "text-[#2E7D32]" : "text-[#6B7A74]"
          }`}
        >
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