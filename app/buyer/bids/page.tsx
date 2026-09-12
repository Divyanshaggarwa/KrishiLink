import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";

export default async function Page() {
  const profile = await requireRole(["farmer"]);
  return (
    <DashboardShell profile={profile} title="List produce" subtitle="Coming in the next session — will write to the real database.">
      <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-8 text-[#6B7A74]">
        🚧 This page will be built next: a full listing form with photo upload and AI price suggestion.
      </div>
    </DashboardShell>
  );
}