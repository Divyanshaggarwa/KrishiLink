export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import VerificationStatusCard from "@/components/VerificationStatusCard";

export default async function PDSDashboard() {
  const profile = await requireRole(["pds_operator"]);
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, farmer_id, status, crop, quantity_kg, created_at")
    .eq("listed_by", profile.id);

  const safeListings = listings || [];
  const uniqueFarmerIds = new Set(safeListings.map((l) => l.farmer_id));
  const activeCount = safeListings.filter((l) => l.status === "active").length;

  return (
    <DashboardShell
      profile={profile}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle={`PDS Kiosk ${profile.pds_center_id ?? ""} · ${
        profile.village || profile.district || "—"
      }`}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          label="Farmers assisted"
          value={uniqueFarmerIds.size}
          accent="green"
        />
        <Stat label="Total listings" value={safeListings.length} />
        <Stat label="Active listings" value={activeCount} accent="blue" />
        <Stat label="Trust score" value={profile.trust_score ?? 50} />
      </div>

      <VerificationStatusCard profile={profile} role="pds_operator" />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Link
          href="/pds-operator/assist"
          className="group relative overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] p-7 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_50px_-20px_rgba(27,77,62,0.5)]"
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
              Primary action
            </span>
            <span className="text-[#A5D6A7] transition-transform group-hover:translate-x-1">
              →
            </span>
          </div>
          <h3 className="font-display mt-5 text-xl font-bold">
            Assist a farmer
          </h3>
          <p className="mt-2 text-sm text-white/75">
            Look up a farmer by KrishiLink ID and create a listing on their
            behalf — perfect for farmers without smartphones.
          </p>
        </Link>

        <Link
          href="/pds-operator/farmers"
          className="group relative rounded-[24px] border border-[#E4EBE6] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.3)]"
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#EAF5EE] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
              {uniqueFarmerIds.size} farmer
              {uniqueFarmerIds.size === 1 ? "" : "s"}
            </span>
            <span className="text-[#2E7D32] transition-transform group-hover:translate-x-1">
              →
            </span>
          </div>
          <h3 className="font-display mt-5 text-xl font-bold text-[#1B4D3E]">
            Assisted farmers
          </h3>
          <p className="mt-2 text-sm text-[#6B7A74]">
            View all farmers you have assisted, their listings, and activity.
          </p>
        </Link>
      </div>

      <section className="mt-10 rounded-[24px] border border-[#E4EBE6] bg-white p-8">
        <h2 className="font-display text-xl font-bold">
          How assisted access works
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[#6B7A74]">
          Farmers without smartphones or digital literacy visit your PDS kiosk.
          You capture their produce details and publish to the marketplace — all
          under their name.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <Step n="01" title="Farmer arrives" desc="Walks in with produce and KrishiLink ID" />
          <Step n="02" title="Verify ID" desc="Enter their KL-XXXXXX to confirm" />
          <Step n="03" title="Fill details" desc="Crop, quantity, grade, expected price" />
          <Step n="04" title="Publish" desc="Verified buyers see it instantly" />
        </div>
      </section>

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
              retain full ownership — you only assist.
            </p>
          </div>
        </div>
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
  accent?: "green" | "blue";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "blue"
        ? "text-[#1565C0]"
        : "text-[#1B4D3E]";
  return (
    <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p className={`font-display mt-2 text-3xl font-extrabold ${color}`}>
        {value}
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  desc,
}: {
  n: string;
  title: string;
  desc: string;
}) {
  return (
    <div>
      <span className="font-display text-2xl font-extrabold text-[#A5D6A7]">
        {n}
      </span>
      <h3 className="font-display mt-3 text-base font-bold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#6B7A74]">{desc}</p>
    </div>
  );
}