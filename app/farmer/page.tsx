import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function FarmerDashboard() {
  const profile = await requireRole(["farmer"]);
  const supabase = await createClient();

  const [listingsRes, activeRes, offersRes, acceptedRes] = await Promise.all([
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
      .from("offers")
      .select("id, listings!inner(farmer_id)", { count: "exact", head: true })
      .eq("listings.farmer_id", profile.id)
      .eq("status", "accepted"),
  ]);

  return (
    <DashboardShell
      profile={profile}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle="Your farm's marketplace dashboard."
    >
      <div className="grid gap-5 md:grid-cols-4">
        <Stat label="Total listings" value={listingsRes.count ?? 0} />
        <Stat label="Active listings" value={activeRes.count ?? 0} />
        <Stat label="Pending offers" value={offersRes.count ?? 0} />
        <Stat label="Trust score" value={profile.trust_score ?? 50} />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          href="/farmer/list"
          tag="Create"
          title="List produce"
          desc="Post your harvest. AI grades quality from a photo and publishes to verified buyers."
        />
        <ActionCard
          href="/farmer/listings"
          tag="Manage"
          title="My listings"
          desc="View every crop you've published, track status, and edit quantities."
        />
        <ActionCard
          href="/farmer/offers"
          tag="Decide"
          title="Offers received"
          desc="Compare every buyer offer ranked by NET REALIZATION — the real money in your hand."
          highlight
        />
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
      <p className="text-xs uppercase tracking-wide text-[#6B7A74]">{label}</p>
      <p className="font-display mt-2 text-3xl font-extrabold text-[#1B4D3E]">
        {value}
      </p>
    </div>
  );
}

function ActionCard({
  href,
  tag,
  title,
  desc,
  highlight,
}: {
  href: string;
  tag: string;
  title: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-[24px] border p-6 transition-all duration-300 hover:-translate-y-1 ${
        highlight
          ? "border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#123528] text-white hover:shadow-[0_25px_50px_-20px_rgba(27,77,62,0.5)]"
          : "border-[#E4EBE6] bg-white hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.3)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
            highlight
              ? "bg-white/10 text-[#A5D6A7]"
              : "bg-[#EAF5EE] text-[#2E7D32]"
          }`}
        >
          {tag}
        </span>
        <span
          className={`transition-transform group-hover:translate-x-1 ${
            highlight ? "text-[#A5D6A7]" : "text-[#2E7D32]"
          }`}
        >
          →
        </span>
      </div>
      <h3
        className={`font-display mt-5 text-xl font-bold ${
          highlight ? "text-white" : "text-[#1B4D3E]"
        }`}
      >
        {title}
      </h3>
      <p
        className={`mt-2 text-sm leading-relaxed ${
          highlight ? "text-white/80" : "text-[#6B7A74]"
        }`}
      >
        {desc}
      </p>
    </Link>
  );
}