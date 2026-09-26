export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function FpoMembersPage() {
  const profile = await requireRole(["farmer"]);
  if (profile.fpo_status !== "approved") redirect("/farmer/fpo");

  const supabase = await createClient();

  const { data: members } = await supabase
    .from("fpo_members")
    .select(
      "id, member_id, member_name, member_krishilink_id, status, joined_at"
    )
    .eq("fpo_id", profile.id)
    .order("joined_at", { ascending: false });

  const safeMembers = members || [];
  const active = safeMembers.filter((m) => m.status === "active");
  const pending = safeMembers.filter((m) => m.status === "pending");

  // Contribution totals
  const memberIds = safeMembers
    .map((m) => m.member_id)
    .filter((id): id is string => !!id);

  const { data: contributions } =
    memberIds.length > 0
      ? await supabase
          .from("fpo_pool_contributions")
          .select("member_id, quantity_kg")
          .in("member_id", memberIds)
      : { data: [] as never[] };

  const contribMap = new Map<string, number>();
  (contributions || []).forEach((c) => {
    contribMap.set(
      c.member_id,
      (contribMap.get(c.member_id) ?? 0) + Number(c.quantity_kg)
    );
  });

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="FPO members"
      subtitle="Every farmer in your collective and their contribution."
    >
      <div className="mb-6">
        <Link
          href="/farmer/fpo/dashboard"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to overview
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Stat label="Total members" value={safeMembers.length} />
        <Stat label="Active" value={active.length} accent="green" />
        <Stat
          label="Pending"
          value={pending.length}
          accent={pending.length > 0 ? "amber" : "gray"}
        />
      </div>

      {safeMembers.length === 0 ? (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
          <p className="text-sm text-[#6B7A74]">No members yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                <tr>
                  <th className="px-6 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">KrishiLink ID</th>
                  <th className="px-4 py-3 font-medium">Contributed</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-6 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {safeMembers.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-[#E4EBE6] hover:bg-[#FAFCFA]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF5EE] text-xs font-semibold text-[#1B4D3E]">
                          {(m.member_name ?? "M").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">
                          {m.member_name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-[#1B4D3E]">
                      {m.member_krishilink_id ?? "—"}
                    </td>
                    <td className="px-4 py-4">
                      {m.member_id
                        ? `${contribMap.get(m.member_id) ?? 0} kg`
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-[#6B7A74]">
                      {new Date(m.joined_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <StatusPill status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
  accent?: "green" | "amber" | "gray";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "amber"
        ? "text-[#B26A00]"
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

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-[#EAF5EE] text-[#2E7D32]",
    pending: "bg-[#FFF8E1] text-[#B26A00]",
    removed: "bg-[#F5F5F5] text-[#6B7A74]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        styles[status] ?? styles.removed
      }`}
    >
      {status}
    </span>
  );
}