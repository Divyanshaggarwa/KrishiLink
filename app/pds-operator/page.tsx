import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function PDSDashboard() {
  const profile = await requireRole(["pds_operator"]);
  const supabase = await createClient();

  const [myListingsRes, activeRes, offersRes] = await Promise.all([
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("listed_by", profile.id),
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("listed_by", profile.id)
      .eq("status", "active"),
    supabase
      .from("offers")
      .select("id, listings!inner(listed_by)", { count: "exact", head: true })
      .eq("listings.listed_by", profile.id),
  ]);

  const myListings = myListingsRes.count ?? 0;
  const active = activeRes.count ?? 0;
  const offers = offersRes.count ?? 0;

  return (
    <DashboardShell
      profile={profile}
      showBack={false}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle={`Assisted access hub for ${
        profile.village || profile.district || "your village"
      } — help farmers without smartphones reach the market.`}
    >
      {/* Stats row */}
      <div className="grid gap-5 md:grid-cols-4">
        <StatCard
          label="Listings created"
          value={myListings}
          hint="On behalf of farmers"
          icon={<ListIcon />}
        />
        <StatCard
          label="Active listings"
          value={active}
          hint="Currently receiving offers"
          icon={<LiveIcon />}
          accent={active > 0 ? "green" : undefined}
        />
        <StatCard
          label="Offers received"
          value={offers}
          hint="Across all your farmers"
          icon={<InboxIcon />}
        />
        <StatCard
          label="Trust score"
          value={profile.trust_score ?? 50}
          hint="Your operator reputation"
          icon={<ShieldIcon />}
        />
      </div>

      {/* Action grid */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <FeatureCard
          href="/pds-operator/assist"
          tag="Assist"
          title="List on behalf of a farmer"
          desc="Guided flow — pick the farmer, capture crop details, quality photo, and publish in one session."
          dark
        />
        <FeatureCard
          href="/pds-operator/farmers"
          tag="Manage"
          title="Village farmers"
          desc="All farmers you've onboarded, their active listings, and pending offers — one view for the whole village."
        />
      </div>

      {/* How assisted access works */}
      <section className="mt-12 rounded-[24px] border border-[#E4EBE6] bg-white p-8">
        <h2 className="font-display text-xl font-bold">
          How assisted access works
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[#6B7A74]">
          Farmers without smartphones or digital literacy visit your PDS kiosk.
          You capture their produce details, upload a photo, and publish to the
          marketplace — all under their name.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <Step
            n="01"
            title="Farmer arrives"
            desc="Walks into your kiosk with produce details"
            icon={<WalkIcon />}
          />
          <Step
            n="02"
            title="Capture details"
            desc="Crop, quantity, quality photo, location"
            icon={<CameraIcon />}
          />
          <Step
            n="03"
            title="AI grades & prices"
            desc="Photo → Grade A/B/C + fair price band"
            icon={<BrainIcon />}
          />
          <Step
            n="04"
            title="Publish to market"
            desc="Verified buyers see it instantly"
            icon={<RocketIcon />}
          />
        </div>
      </section>

      {/* Compliance note */}
      <div className="mt-8 rounded-[24px] border border-[#C8E6C9] bg-[#EAF5EE] p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E7D32] text-xs font-bold text-white">
            ✓
          </span>
          <div>
            <p className="font-display text-sm font-bold text-[#1B4D3E]">
              Every assisted listing carries an audit trail
            </p>
            <p className="mt-1 text-xs text-[#1B4D3E]/80">
              Your operator ID is attached to each listing you create. Farmers
              retain full ownership — you only assist. This protects both sides
              and builds trust in the ecosystem.
            </p>
          </div>
        </div>
      </div>
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
        <p className="text-xs uppercase tracking-wide text-[#6B7A74]">{label}</p>
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

function Step({
  n,
  title,
  desc,
  icon,
}: {
  n: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF5EE] text-[#1B4D3E]">
          {icon}
        </span>
        <span className="font-display text-2xl font-extrabold text-[#A5D6A7]">
          {n}
        </span>
      </div>
      <h3 className="font-display mt-4 text-base font-bold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#6B7A74]">{desc}</p>
    </div>
  );
}

/* ---------- Icons ---------- */

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function LiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l2-5h14l2 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 8h18M8 12h8" />
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

function WalkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2" />
      <path d="M13 8l-2 6 3 4M13 8l4 3M8 20l2-3M17 20l-1-2" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h2l1-2h8l1 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 5 2V4a3 3 0 0 0-2 0z" />
      <path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-5 2V4a3 3 0 0 1 2 0z" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.2-.1-3-.8-.8-2.1-.8-2.9 0z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-4c2.5-3 6-4 10-4a1 1 0 0 1 1 1c0 4-1 7.5-4 10a22 22 0 0 1-4 2z" />
      <path d="M9 12H4l3-3h4M12 15v5l3-3v-4" />
    </svg>
  );
}