export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const [farmers, buyers, pds, listings, offers, txns] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "farmer"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "buyer"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "pds_operator"),
    supabase.from("listings").select("*", { count: "exact", head: true }),
    supabase.from("offers").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("*", { count: "exact", head: true }),
  ]);

  return (
    <DashboardShell
      profile={profile}
      showBack={false}
      title="Platform overview"
      subtitle="Live analytics across the KrishiLink ecosystem."
    >
      {/* Stats row */}
      <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Farmers" value={farmers.count ?? 0} />
        <Stat label="Buyers" value={buyers.count ?? 0} />
        <Stat label="PDS operators" value={pds.count ?? 0} />
        <Stat label="Listings" value={listings.count ?? 0} />
        <Stat label="Offers" value={offers.count ?? 0} />
        <Stat label="Transactions" value={txns.count ?? 0} />
      </div>

      {/* Action cards */}
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <AdminCard
          href="/admin/fees"
          tag="Configure"
          title="Fee configuration"
          desc="Edit commission, gateway fee, handling charges, and transport rates. Changes apply instantly to every quote."
        />
        <AdminCard
          href="/admin/orders"
          tag="Control"
          title="Order logistics"
          desc="Mark shipments and deliveries for the demo. Admin-controlled logistics gate."
        />
        <AdminCard
          href="/admin/transactions"
          tag="Monitor"
          title="All transactions"
          desc="Every deal across the platform with status and full breakdown."
        />
      </div>

      {/* System status */}
      <div className="mt-10 rounded-[24px] border border-[#E4EBE6] bg-white p-6">
        <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
          System status
        </h3>
        <ul className="mt-4 space-y-2 text-sm text-[#6B7A74]">
          <li>✓ Auth &amp; RLS policies: active</li>
          <li>✓ Role-based middleware: enforcing</li>
          <li>✓ Database: connected</li>
          <li>✓ Net Realization Engine: live</li>
          <li>✓ Fee configuration: editable</li>
          <li>○ AI microservice: pending teammate delivery</li>
        </ul>
      </div>
    </DashboardShell>
  );
}

/* ---------- Small components ---------- */

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

function AdminCard({
  href,
  tag,
  title,
  desc,
}: {
  href: string;
  tag: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-[#E4EBE6] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#2E7D32]"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#EAF5EE] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
          {tag}
        </span>
        <span className="text-[#2E7D32] transition-transform group-hover:translate-x-1">
          →
        </span>
      </div>
      <h3 className="font-display mt-5 text-lg font-bold text-[#1B4D3E]">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[#6B7A74]">{desc}</p>
    </Link>
  );
}