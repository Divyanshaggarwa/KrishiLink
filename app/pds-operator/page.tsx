import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function PDSDashboard() {
  const profile = await requireRole(["pds_operator"]);
  const supabase = await createClient();

  const { count: myListings } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("listed_by", profile.id);

  const { count: active } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("listed_by", profile.id)
    .eq("status", "active");

  return (
    <DashboardShell
      profile={profile}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle={`Assisted access for farmers in ${
        profile.village || profile.district || "your village"
      }.`}
    >
      <div className="grid gap-5 md:grid-cols-3">
        <Stat label="Listings created" value={myListings ?? 0} />
        <Stat label="Active listings" value={active ?? 0} />
        <Stat label="Trust score" value={profile.trust_score ?? 50} />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Link
          href="/pds-operator/assist"
          className="rounded-[24px] border border-[#E4EBE6] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#2E7D32]"
        >
          <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
            Assist a farmer →
          </h3>
          <p className="mt-2 text-sm text-[#6B7A74]">
            Start a guided listing on behalf of a farmer without a smartphone.
          </p>
        </Link>

        <Link
          href="/pds-operator/farmers"
          className="rounded-[24px] border border-[#E4EBE6] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#2E7D32]"
        >
          <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
            Village farmers →
          </h3>
          <p className="mt-2 text-sm text-[#6B7A74]">
            Manage farmers you've onboarded and their listings.
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