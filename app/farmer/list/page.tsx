import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import ListProduceForm from "./ListProduceForm";

export default async function ListProducePage() {
  const profile = await requireRole(["farmer"]);

  return (
    <DashboardShell
      profile={profile}
      title="List produce"
      subtitle="Photo, quantity, quality, location — KrishiLink suggests a fair price band and publishes to verified buyers."
    >
      <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-8">
        <ListProduceForm
          profile={{
            id: profile.id,
            full_name: profile.full_name,
            district: profile.district,
            state: profile.state,
            pincode: profile.pincode,
          }}
        />
      </div>
    </DashboardShell>
  );
}