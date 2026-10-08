export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import OrderMapView from "@/components/logistics/OrderMapView";

export default async function OrderMapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole([
    "farmer",
    "buyer",
    "admin",
    "pds_operator",
  ]);
  const { id } = await params;

  const perspective: "farmer" | "buyer" | "admin" =
    profile.role === "admin"
      ? "admin"
      : profile.role === "buyer"
        ? "buyer"
        : "farmer";

  const backHref =
    profile.role === "admin"
      ? "/admin/orders"
      : profile.role === "buyer"
        ? "/buyer/orders"
        : "/farmer/orders";

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Order route"
      subtitle="Per-order road route, net realization, buyer transport costs, and status updates. Vehicle GPS tracking is not enabled."
    >
      <div className="mb-6">
        <Link
          href={backHref}
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to orders
        </Link>
      </div>

      <OrderMapView orderId={id} perspective={perspective} />
    </DashboardShell>
  );
}