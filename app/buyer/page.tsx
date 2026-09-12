import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function BuyerDashboard() {
  const profile = await requireRole(["buyer"]);
  const supabase = await createClient();

  const { count: available } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const { count: myBids } = await supabase
    .from("offers")
    .select("*", { count: "exact", head: true })
    .eq("buyer_id", profile.id);

  const { count: accepted } = await supabase
    .from("offers")
    .select("*", { count: "exact", head: true })
    .eq("buyer_id", profile.id)
    .eq("status", "accepted");

  return (
    <DashboardShell
      profile={profile}
      title={`Welcome, ${profile.full_name.split(" ")[0]}`}
      subtitle="Browse verified produce and manage your bids."
    >
      <div className="grid gap-5 md:grid-cols-3">
        <Stat label="Available listings" value={available ?? 0} />
        <Stat label="My bids" value={myBids ?? 0} />
        <Stat label="Accepted bids" value={accepted ?? 0} />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Link
          href="/buyer/browse"
          className="rounded-[24px] border border-[#E4EBE6] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#2E7D32]"
        >
          <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
            Browse produce →
          </h3>
          <p className="mt-2 text-sm text-[#6B7A74]">
            Filter by crop, district, quality grade, and quantity.
          </p>
        </Link>

        <Link
          href="/buyer/bids"
          className="rounded-[24px] border border-[#E4EBE6] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#2E7D32]"
        >
          <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
            My bids →
          </h3>
          <p className="mt-2 text-sm text-[#6B7A74]">
            Track offers you've placed and accepted deals.
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