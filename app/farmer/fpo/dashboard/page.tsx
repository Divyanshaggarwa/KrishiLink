export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import CreatePoolForm from "./CreatePoolForm";

export default async function FpoDashboardPage() {
  const profile = await requireRole(["farmer"]);

  if (profile.fpo_status !== "approved") {
    redirect("/farmer/fpo");
  }

  const supabase = await createClient();

  // 1. Members
  const { data: membersData } = await supabase
    .from("fpo_members")
    .select("id, member_id, member_name, member_krishilink_id, status")
    .eq("fpo_id", profile.id)
    .eq("status", "active");

  const members = (membersData || []).filter((m) => m.member_id);

  // 2. My pools
  const { data: poolsData } = await supabase
    .from("fpo_pools")
    .select(
      "id, crop, total_quantity_kg, quality_grade, expected_price_per_kg, status, created_at"
    )
    .eq("fpo_id", profile.id)
    .order("created_at", { ascending: false });

  const pools = poolsData || [];
  const poolIds = pools.map((p) => p.id);

  // 3. Pending offer count
  let pendingOffers = 0;
  if (poolIds.length > 0) {
    const { count } = await supabase
      .from("offers")
      .select("*", { count: "exact", head: true })
      .in("pool_id", poolIds)
      .eq("status", "pending");
    pendingOffers = count ?? 0;
  }

  // 4. Total payouts received
  let totalPayouts = 0;
  if (poolIds.length > 0) {
    const { data: payoutsData } = await supabase
      .from("fpo_pool_payouts")
      .select("net_payout, status")
      .in("pool_id", poolIds);
    totalPayouts = (payoutsData || [])
      .filter((p) => p.status === "released" || p.status === "pending")
      .reduce((s, p) => s + Number(p.net_payout || 0), 0);
  }

  const activePools = pools.filter((p) => p.status === "active");

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title={profile.fpo_name || "FPO Dashboard"}
      subtitle={`${profile.fpo_region} · ${members.length} active member${
        members.length === 1 ? "" : "s"
      }`}
    >
      <div className="mb-6">
        <Link
          href="/farmer"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to farm dashboard
        </Link>
      </div>

      {/* FPO ID HERO */}
      <div className="overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] p-6 text-white md:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
              FPO Collective
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold md:text-3xl">
              {profile.fpo_name}
            </h2>
            <p className="mt-2 text-sm text-white/75">
              {profile.fpo_region} · Since{" "}
              {profile.fpo_approved_at
                ? new Date(profile.fpo_approved_at).toLocaleDateString(
                    "en-IN",
                    { month: "short", year: "numeric" }
                  )
                : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-widest text-[#A5D6A7]">
              FPO ID
            </p>
            <p className="font-display mt-2 select-all text-3xl font-extrabold tracking-wide">
              {profile.fpo_id}
            </p>
            <p className="mt-2 text-[11px] text-white/60">
              Share with bulk buyers and members.
            </p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="Active members" value={members.length} accent="green" />
        <Stat label="Total pools" value={pools.length} />
        <Stat
          label="Pending offers"
          value={pendingOffers}
          accent={pendingOffers > 0 ? "amber" : "gray"}
        />
        <Stat
          label="Total payouts"
          value={`₹${totalPayouts.toLocaleString("en-IN")}`}
        />
      </div>

      {/* QUICK ACTIONS */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <QuickAction
          href="/farmer/fpo/dashboard/offers"
          label="View pending offers"
          desc={
            pendingOffers > 0
              ? `${pendingOffers} offer${pendingOffers === 1 ? "" : "s"} waiting`
              : "No pending offers"
          }
          highlight={pendingOffers > 0}
        />
        <QuickAction
          href="/farmer/fpo/dashboard/members"
          label="Manage members"
          desc={`${members.length} active member farmers`}
        />
        <QuickAction
          href="/farmer/fpo/dashboard/history"
          label="View history"
          desc="All completed pool sales"
        />
      </div>

      {/* ACTIVE POOLS LIST */}
      {activePools.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0F1F1A]">
                Your active pools
              </h2>
              <p className="mt-1 text-sm text-[#6B7A74]">
                Live on the marketplace — buyers can place offers
              </p>
            </div>
            <span className="rounded-full bg-[#EAF5EE] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#2E7D32]">
              {activePools.length} active
            </span>
          </div>

          <div className="space-y-3">
            {activePools.map((p) => (
              <PoolRow key={p.id} pool={p} />
            ))}
          </div>
        </section>
      )}

      {/* CREATE POOL */}
      <section className="mt-10">
        <div className="mb-4">
          <h2 className="font-display text-lg font-bold text-[#0F1F1A]">
            Create a pooled listing
          </h2>
          <p className="mt-1 text-sm text-[#6B7A74]">
            Combine crops from multiple members. When a buyer purchases,
            revenue splits by contribution.
          </p>
        </div>
               <CreatePoolForm
          members={members}
          headId={profile.id}
          headName={profile.full_name}
          headKlid={profile.krishilink_id}
        />
      </section>

      {/* ALL POOLS (past + active) */}
      {pools.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-[#0F1F1A]">
            All pools
          </h2>
          <div className="mt-4 overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Crop</th>
                    <th className="px-4 py-3 font-medium">Qty (kg)</th>
                    <th className="px-4 py-3 font-medium">Grade</th>
                    <th className="px-4 py-3 font-medium">Asking ₹/kg</th>
                    <th className="px-6 py-3 font-medium text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pools.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-[#E4EBE6] hover:bg-[#FAFCFA]"
                    >
                      <td className="px-6 py-3 font-medium">{p.crop}</td>
                      <td className="px-4 py-3">{p.total_quantity_kg}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[#EAF5EE] px-2.5 py-0.5 text-xs font-medium text-[#2E7D32]">
                          {p.quality_grade ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">₹{p.expected_price_per_kg}</td>
                      <td className="px-6 py-3 text-right">
                        <StatusPill status={p.status} />
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

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
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
      <p className={`font-display mt-2 text-2xl font-extrabold ${color}`}>
        {value}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  desc,
  highlight,
}: {
  href: string;
  label: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex items-start justify-between gap-3 rounded-[20px] border bg-white p-5 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.25)] ${
        highlight
          ? "border-[#1B4D3E]"
          : "border-[#E4EBE6] hover:border-[#2E7D32]"
      }`}
    >
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-[#1B4D3E]">
          {label}
        </p>
        <p className="mt-1 text-xs text-[#6B7A74]">{desc}</p>
      </div>
      <span
        className={`shrink-0 transition-transform group-hover:translate-x-1 ${
          highlight ? "text-[#1B4D3E]" : "text-[#2E7D32]"
        }`}
      >
        →
      </span>
    </Link>
  );
}

function PoolRow({
  pool,
}: {
  pool: {
    id: string;
    crop: string;
    total_quantity_kg: number;
    quality_grade: string | null;
    expected_price_per_kg: number;
    status: string;
    created_at: string;
  };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#E4EBE6] bg-white p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF5EE] text-lg">
          🌾
        </span>
        <div>
          <p className="font-display text-base font-bold text-[#1B4D3E]">
            {pool.crop}
            {pool.quality_grade && (
              <span className="ml-2 rounded-full bg-[#EAF5EE] px-2 py-0.5 text-[10px] font-medium text-[#2E7D32]">
                Grade {pool.quality_grade}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-[#6B7A74]">
            {pool.total_quantity_kg} kg · asking ₹{pool.expected_price_per_kg}/kg
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusPill status={pool.status} />
        <span className="text-[11px] text-[#6B7A74]">
          {new Date(pool.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-[#EAF5EE] text-[#2E7D32]",
    sold: "bg-[#E3F2FD] text-[#1565C0]",
    expired: "bg-[#FFF5F5] text-[#C62828]",
    cancelled: "bg-[#F5F5F5] text-[#6B7A74]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        styles[status] ?? styles.cancelled
      }`}
    >
      {status}
    </span>
  );
}