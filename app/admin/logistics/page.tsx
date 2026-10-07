export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import RouteOptimizer from "@/components/logistics/RouteOptimizer";

export default async function AdminLogisticsPage() {
  const profile = await requireRole(["admin"]);

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Route Optimization"
      subtitle="Plan truck pickups from farms to drop points. Fewer trucks, shorter routes, safer roads."
    >
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to overview
        </Link>
      </div>

      <RouteOptimizer />
    </DashboardShell>
  );
}