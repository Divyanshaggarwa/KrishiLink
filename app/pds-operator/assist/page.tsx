export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import DashboardShell from "@/components/DashboardShell";
import AssistForm from "./AssistForm";

export default async function AssistPage() {
  const profile = await requireRole(["pds_operator"]);

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Assist a farmer"
      subtitle="Create a listing on behalf of a farmer — verified by their KrishiLink ID."
    >
      <div className="mb-6">
        <Link
          href="/pds-operator"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to overview
        </Link>
      </div>
      <AssistForm />
    </DashboardShell>
  );
}