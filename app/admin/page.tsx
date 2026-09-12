import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const [farmers, buyers, pds, listings, offers, txns] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "farmer"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "buyer"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "pds_operator"),
    supabase.from("listings").select("*", { count: "exact", head: true }),
    supabase.from("offers").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("*", { count: "exact", head: true }),
  ]);

  return (
    <DashboardShell
      profile={profile}
      title="Platform overview"
      subtitle="Live analytics across the KrishiLink ecosystem."
    >
      <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Farmers" value={farmers.count ?? 0} />
        <Stat label="Buyers" value={buyers.count ?? 0} />
        <Stat label="PDS operators" value={pds.count ?? 0} />
        <Stat label="Listings" value={listings.count ?? 0} />
        <Stat label="Offers" value={offers.count ?? 0} />
        <Stat label="Transactions" value={txns.count ?? 0} />
      </div>

      <div className="mt-10 rounded-[24px] border border-[#E4EBE6] bg-white p-6">
        <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
          System status
        </h3>
        <ul className="mt-4 space-y-2 text-sm text-[#6B7A74]">
          <li>✓ Auth & RLS policies: active</li>
          <li>✓ Role-based middleware: enforcing</li>
          <li>✓ Database: connected</li>
          <li>○ AI microservice: pending teammate delivery</li>
          <li>○ Realtime updates: next session</li>
        </ul>
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-5">
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p className="font-display mt-2 text-2xl font-extrabold text-[#1B4D3E]">
        {value}
      </p>
    </div>
  );
}