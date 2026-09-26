export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

type SearchParams = Promise<{ role?: string; q?: string }>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireRole(["admin"]);
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, role, phone, krishilink_id, district, state, trust_score, is_verified, business_name, fpo_name, fpo_id, fpo_status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.role) query = query.eq("role", params.role);
  if (params.q) query = query.ilike("full_name", `%${params.q}%`);

  const { data: users } = await query;
  const safeUsers = users || [];

  const counts = {
    farmer: safeUsers.filter((u) => u.role === "farmer").length,
    buyer: safeUsers.filter((u) => u.role === "buyer").length,
    pds: safeUsers.filter((u) => u.role === "pds_operator").length,
    admin: safeUsers.filter((u) => u.role === "admin").length,
  };

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Users"
      subtitle="All registered accounts across the platform."
    >
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]">
          ← Back to overview
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Stat label="Farmers" value={counts.farmer} accent="green" />
        <Stat label="Buyers" value={counts.buyer} accent="blue" />
        <Stat label="PDS operators" value={counts.pds} />
        <Stat label="Admins" value={counts.admin} />
      </div>

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-[24px] border border-[#E4EBE6] bg-white p-5 md:grid-cols-[1fr_auto_auto]"
      >
        <input
          name="q"
          defaultValue={params.q || ""}
          placeholder="Search by name…"
          className="rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
        />
        <select
          name="role"
          defaultValue={params.role || ""}
          className="rounded-xl border border-[#E4EBE6] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
        >
          <option value="">All roles</option>
          <option value="farmer">Farmer</option>
          <option value="buyer">Buyer</option>
          <option value="pds_operator">PDS Operator</option>
          <option value="admin">Admin</option>
        </select>
        <div className="flex gap-2">
          <button className="rounded-full bg-[#1B4D3E] px-5 py-2.5 text-sm font-medium text-white">
            Filter
          </button>
          <Link
            href="/admin/users"
            className="rounded-full border border-[#E4EBE6] px-5 py-2.5 text-sm font-medium text-[#6B7A74]"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">KrishiLink ID</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Trust</th>
                <th className="px-6 py-3 font-medium text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {safeUsers.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-[#E4EBE6] hover:bg-[#FAFCFA]"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF5EE] text-xs font-semibold text-[#1B4D3E]">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-[11px] text-[#6B7A74]">
                          {u.phone ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <RolePill role={u.role} />
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-[#1B4D3E]">
                    {u.krishilink_id ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-[#6B7A74]">
                    {u.district ? `${u.district}, ${u.state ?? ""}` : "—"}
                  </td>
                  <td className="px-4 py-4 font-medium">
                    {u.trust_score ?? 50}
                  </td>
                  <td className="px-6 py-4 text-right text-[#6B7A74]">
                    {new Date(u.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {safeUsers.length === 0 && (
        <div className="mt-6 rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center text-sm text-[#6B7A74]">
          No users match your filters.
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
  accent?: "green" | "blue";
}) {
  const color =
    accent === "green"
      ? "text-[#2E7D32]"
      : accent === "blue"
        ? "text-[#1565C0]"
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

function RolePill({ role }: { role: string }) {
  const styles: Record<string, string> = {
    farmer: "bg-[#EAF5EE] text-[#2E7D32]",
    buyer: "bg-[#E3F2FD] text-[#1565C0]",
    pds_operator: "bg-[#FFF8E1] text-[#B26A00]",
    admin: "bg-[#F3E5F5] text-[#6A1B9A]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        styles[role] ?? "bg-[#F5F5F5] text-[#6B7A74]"
      }`}
    >
      {role.replace("_", " ")}
    </span>
  );
}