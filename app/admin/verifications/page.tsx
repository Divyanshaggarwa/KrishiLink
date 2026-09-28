export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import VerificationList from "./VerificationList";

export default async function AdminVerificationsPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  // Pending verifications (exclude admins)
  const { data: pending } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, phone, krishilink_id, district, state, business_name, pds_center_id, gst_number, verification_submitted_at"
    )
    .eq("verification_status", "pending")
    .neq("role", "admin")
    .order("verification_submitted_at", { ascending: true })
    .limit(200);

  // Counts
  const { count: verifiedCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("verification_status", "verified")
    .neq("role", "admin");

  const { count: rejectedCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("verification_status", "rejected")
    .neq("role", "admin");

  const pendingUsers = pending || [];

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Account verifications"
      subtitle="Review and approve new accounts joining the KrishiLink ecosystem."
    >
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to overview
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Stat
          label="Pending"
          value={pendingUsers.length}
          accent={pendingUsers.length > 0 ? "amber" : "gray"}
        />
        <Stat label="Verified" value={verifiedCount ?? 0} accent="green" />
        <Stat label="Rejected" value={rejectedCount ?? 0} accent="red" />
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-lg font-bold text-[#0F1F1A]">
            Pending review
          </h2>
          {pendingUsers.length > 0 && (
            <span className="rounded-full bg-[#FFF8E1] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#B26A00]">
              {pendingUsers.length} waiting
            </span>
          )}
        </div>
        <VerificationList users={pendingUsers} />
      </section>
    </DashboardShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber" | "green" | "red" | "gray";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "amber"
        ? "text-[#B26A00]"
        : accent === "red"
          ? "text-[#C62828]"
          : accent === "gray"
            ? "text-[#6B7A74]"
            : "text-[#1B4D3E]";
  return (
    <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p className={`font-display mt-2 text-3xl font-extrabold ${color}`}>
        {value}
      </p>
    </div>
  );
}