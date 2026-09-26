export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import FpoApprovalList from "./FpoApprovalList";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type MemberRow = {
  id: string;
  fpo_id: string;
  member_name: string | null;
  member_krishilink_id: string | null;
  status: string;
};

type HeadRow = {
  id: string;
  full_name: string;
  phone: string | null;
  krishilink_id: string | null;
  fpo_name: string | null;
  fpo_region: string | null;
  fpo_member_count: number | null;
  fpo_applied_at: string | null;
  fpo_status: string | null;
};

type ApprovedRow = {
  id: string;
  fpo_name: string | null;
  fpo_region: string | null;
  fpo_id: string | null;
  fpo_member_count: number | null;
};

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function AdminFpoPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  // 1. Pending FPO heads
  const { data: headsData } = await supabase
    .from("profiles")
    .select(
      "id, full_name, phone, krishilink_id, fpo_name, fpo_region, fpo_member_count, fpo_applied_at, fpo_status"
    )
    .eq("fpo_status", "pending")
    .order("fpo_applied_at", { ascending: false });

  const heads: HeadRow[] = (headsData || []) as HeadRow[];
  const headIds = heads.map((h) => h.id);

  // 2. Members of those FPO heads
  let memberRows: MemberRow[] = [];
  if (headIds.length > 0) {
    const { data } = await supabase
      .from("fpo_members")
      .select("id, fpo_id, member_name, member_krishilink_id, status")
      .in("fpo_id", headIds);
    memberRows = (data || []) as MemberRow[];
  }

  // 3. Group members by FPO head
  const membersByFpo = new Map<string, MemberRow[]>();
  for (const m of memberRows) {
    const list = membersByFpo.get(m.fpo_id) ?? [];
    list.push(m);
    membersByFpo.set(m.fpo_id, list);
  }

  // 4. Build application objects
  const applications = heads.map((h) => ({
    head_id: h.id,
    head_name: h.full_name,
    head_krishilink_id: h.krishilink_id,
    head_phone: h.phone,
    fpo_name: h.fpo_name,
    fpo_region: h.fpo_region,
    fpo_member_count: h.fpo_member_count,
    fpo_applied_at: h.fpo_applied_at,
    members: membersByFpo.get(h.id) ?? [],
  }));

  // 5. Approved FPOs
  const { data: approvedData } = await supabase
    .from("profiles")
    .select("id, fpo_name, fpo_region, fpo_id, fpo_member_count")
    .eq("fpo_status", "approved")
    .order("fpo_approved_at", { ascending: false });

  const approved: ApprovedRow[] = (approvedData || []) as ApprovedRow[];

  const totalMembersPooled = approved.reduce(
    (sum, a) => sum + (a.fpo_member_count ?? 0),
    0
  );

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="FPO applications"
      subtitle="Review, verify member KrishiLink IDs, and approve Farmer Producer Organisations."
    >
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to overview
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Stat
          label="Pending applications"
          value={applications.length}
          accent="amber"
        />
        <Stat
          label="Approved FPOs"
          value={approved.length}
          accent="green"
        />
        <Stat label="Total members pooled" value={totalMembersPooled} />
      </div>

      {/* Pending list */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-lg font-bold text-[#0F1F1A]">
            Pending review
          </h2>
          <span className="rounded-full bg-[#FFF8E1] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#B26A00]">
            {applications.length} pending
          </span>
        </div>
        <FpoApprovalList applications={applications} />
      </section>

      {/* Approved summary */}
      {approved.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-[#0F1F1A]">
            Approved FPOs
          </h2>
          <div className="mt-4 overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                  <tr>
                    <th className="px-6 py-3 font-medium">FPO name</th>
                    <th className="px-4 py-3 font-medium">FPO ID</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-6 py-3 font-medium text-right">
                      Members
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {approved.map((a) => (
                    <tr
                      key={a.id}
                      className="border-t border-[#E4EBE6] hover:bg-[#FAFCFA]"
                    >
                      <td className="px-6 py-3 font-medium">
                        {a.fpo_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[#1B4D3E]">
                        {a.fpo_id ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[#6B7A74]">
                        {a.fpo_region ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {a.fpo_member_count ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "green" | "amber";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "amber"
        ? "text-[#B26A00]"
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