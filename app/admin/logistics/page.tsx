import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { getCurrentProfile } from "@/lib/auth";
import { loadOrdersForRouting } from "./actions";
import RouteAiFrame from "@/components/logistics/RouteAiFrame";

export const dynamic = "force-dynamic";

export default async function AdminLogisticsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login/admin");
  if (profile.role !== "admin") redirect("/");

  const data = await loadOrdersForRouting();
  const drops = data?.drops ?? [];
  const pickups = data?.pickups ?? [];
  const geoapifyKey = process.env.GEOAPIFY_KEY ?? "";

  return (
    <DashboardShell
      profile={profile}
      title="Route AI"
      subtitle="National-scale multi-truck route optimization — OSRM + Clarke-Wright + 2-opt"
    >
      {!geoapifyKey && (
        <div className="mb-4 rounded-xl border border-[#FFE0B2] bg-[#FFF8E1] p-3 text-sm text-[#B26A00]">
          Missing <code className="font-mono">GEOAPIFY_KEY</code> in{" "}
          <code className="font-mono">.env.local</code> — the map tiles won't
          load. Add it and restart the dev server.
        </div>
      )}

      {drops.length === 0 || pickups.length === 0 ? (
        <div className="rounded-xl border border-[#E4EBE6] bg-white p-6 text-sm text-[#6B7A74]">
          <p className="mb-2 font-medium text-[#0F1F1A]">
            No routable orders right now.
          </p>
          <p>
            Orders in <code>escrow_paid</code>, <code>in_transit</code>, or{" "}
            <code>delivered</code> status will appear here automatically.
          </p>
        </div>
      ) : (
        <RouteAiFrame
          geoapifyKey={geoapifyKey}
          drops={drops}
          pickups={pickups}
        />
      )}
    </DashboardShell>
  );
}