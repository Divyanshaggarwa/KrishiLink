import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function FarmerDashboard() {
  const profile = await requireRole(["farmer"]);
  const supabase = await createClient();

  const { count: listingsCount } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("farmer_id", profile.id);

  const { count: activeCount } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("farmer_id", profile.id)
    .eq("status", "active");

  const { count: offersCount } = await supabase
    .from("offers")
    .select("*, listings!inner(farmer_id)", { count: "exact", head: true })
    .eq("listings.farmer_id", profile.id);

  return (
    <DashboardShell
      profile={profile}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle="Your farm's marketplace dashboard."
    >
      <div className="grid gap-5 md:grid-cols-4">
        <Stat label="Total listings" value={listingsCount ?? 0} />
        <Stat label="Active listings" value={activeCount ?? 0} />
        <Stat label="Offers received" value={offersCount ?? 0} />
        <Stat label="Trust score" value={profile.trust_score ?? 50} />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Link
          href="/farmer/list"
          className="group rounded-[24px] border border-[#E4EBE6] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#2E7D32]"
        >
          <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
            List produce →
          </h3>
          <p className="mt-2 text-sm text-[#6B7A74]">
            Post your harvest. AI grades quality and suggests a fair price band.
          </p>
        </Link>

        <Link
          href="/farmer/offers"
          className="group rounded-[24px] border border-[#E4EBE6] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#2E7D32]"
        >
          <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
            Compare offers →
          </h3>
          <p className="mt-2 text-sm text-[#6B7A74]">
            See every buyer offer ranked by net realization (after logistics).
          </p>
        </Link>
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