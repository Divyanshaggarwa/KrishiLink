export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import ApplyForm from "./ApplyForm";

export default async function FpoPage() {
  const profile = await requireRole(["farmer"]);
  const supabase = await createClient();

  const status = profile.fpo_status;

  /* ================================================================ */
  /*  CASE 1: FPO HEAD                                                */
  /* ================================================================ */
  if (status) {
    const { data: members } = await supabase
      .from("fpo_members")
      .select("id, member_name, member_krishilink_id, status")
      .eq("fpo_id", profile.id);

    return (
      <DashboardShell
        profile={profile}
        showBack={true}
        title="FPO Collective"
        subtitle="Your FPO head panel."
      >
        <div className="mb-6">
          <Link
            href="/farmer"
            className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
          >
            ← Back to dashboard
          </Link>
        </div>

        {status === "approved" && (
          <div className="rounded-[24px] border border-[#A5D6A7] bg-[#EAF5EE] p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="rounded-full bg-[#2E7D32] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                  Active FPO
                </span>
                <h3 className="font-display mt-3 text-2xl font-bold text-[#1B4D3E]">
                  {profile.fpo_name}
                </h3>
                <p className="mt-1 text-sm text-[#1B4D3E]/80">
                  {profile.fpo_region} · {members?.length ?? 0} member farmers
                </p>
              </div>
              <Link
                href="/farmer/fpo/dashboard"
                className="rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                Open FPO dashboard →
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white bg-white p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#6B7A74]">
                  FPO ID
                </p>
                <p className="font-display mt-1 select-all text-2xl font-extrabold tracking-wide text-[#1B4D3E]">
                  {profile.fpo_id ?? "—"}
                </p>
                <p className="mt-1 text-[11px] text-[#6B7A74]">
                  Share with bulk buyers and new members.
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#6B7A74]">
                  Members
                </p>
                <p className="font-display mt-1 text-2xl font-extrabold text-[#1B4D3E]">
                  {members?.length ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-[#6B7A74]">
                  Active member farmers
                </p>
              </div>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="rounded-[24px] border border-[#FFE082] bg-[#FFF8E1] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#B26A00] text-2xl text-white">
              ⏳
            </div>
            <h3 className="font-display mt-4 text-xl font-bold text-[#B26A00]">
              Application under review
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[#B26A00]/85">
              Your FPO <strong>{profile.fpo_name}</strong> in{" "}
              <strong>{profile.fpo_region}</strong> with{" "}
              {members?.length ?? 0} members is being verified by KrishiLink
              admin.
            </p>
          </div>
        )}

        {status === "rejected" && (
          <div className="rounded-[24px] border border-[#FFCDD2] bg-[#FFF5F5] p-8">
            <h3 className="font-display text-xl font-bold text-[#C62828]">
              Application rejected
            </h3>
            <p className="mt-2 text-sm text-[#C62828]/85">
              {profile.fpo_rejection_reason || "Please contact support."}
            </p>
            <p className="mt-4 text-sm text-[#6B7A74]">
              You can reapply below with corrected information.
            </p>
          </div>
        )}

        {status === "rejected" && (
          <div className="mt-8 rounded-[24px] border border-[#E4EBE6] bg-white p-8">
            <ApplyForm />
          </div>
        )}
      </DashboardShell>
    );
  }

  /* ================================================================ */
  /*  CASE 2: MEMBER OF AN FPO                                        */
  /*  Two lookup strategies:                                          */
  /*    A) profile.fpo_head_id is set (canonical)                     */
  /*    B) fall back to fpo_members row where member_id = profile.id  */
  /* ================================================================ */

  let fpoHeadId: string | null = profile.fpo_head_id ?? null;

  if (!fpoHeadId) {
    const { data: membership } = await supabase
      .from("fpo_members")
      .select("fpo_id, status")
      .eq("member_id", profile.id)
      .eq("status", "active")
      .maybeSingle();

    if (membership?.fpo_id) {
      fpoHeadId = membership.fpo_id;
    }
  }

  if (fpoHeadId) {
    // Get FPO head's public info
    const { data: fpo } = await supabase
      .from("public_profiles")
      .select("full_name, fpo_name, fpo_region, fpo_id, fpo_status")
      .eq("id", fpoHeadId)
      .maybeSingle();

    // Member's contributions
    const { data: contributions } = await supabase
      .from("fpo_pool_contributions")
      .select(
        "id, quantity_kg, pool_id, pool:fpo_pools(id, crop, status, expected_price_per_kg, created_at)"
      )
      .eq("member_id", profile.id)
      .order("created_at", { ascending: false });

    // Member's payouts
    const { data: payouts } = await supabase
      .from("fpo_pool_payouts")
      .select(
        "id, pool_id, quantity_kg, share_pct, net_payout, status, created_at, pool:fpo_pools(crop)"
      )
      .eq("member_id", profile.id)
      .order("created_at", { ascending: false });

    const safePayouts = payouts || [];
    const totalPending = safePayouts
      .filter((p) => p.status === "pending")
      .reduce((s, p) => s + Number(p.net_payout), 0);
    const totalReleased = safePayouts
      .filter((p) => p.status === "released")
      .reduce((s, p) => s + Number(p.net_payout), 0);

    return (
      <DashboardShell
        profile={profile}
        showBack={true}
        title="My FPO"
        subtitle="Track your FPO membership and pool payouts."
      >
        <div className="mb-6">
          <Link
            href="/farmer"
            className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* FPO membership hero */}
        <div className="overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] p-6 text-white md:p-8">
          <div className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <span className="rounded-full bg-[#A5D6A7]/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
                Active member
              </span>
              <h2 className="font-display mt-3 text-2xl font-bold md:text-3xl">
                {fpo?.fpo_name || "FPO"}
              </h2>
              <p className="mt-2 text-sm text-white/75">
                {fpo?.fpo_region} · Head: {fpo?.full_name ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-widest text-[#A5D6A7]">
                FPO ID
              </p>
              <p className="font-display mt-2 select-all text-2xl font-extrabold tracking-wide">
                {fpo?.fpo_id ?? "—"}
              </p>
              <p className="mt-1 text-[11px] text-white/60">
                You can sell your own crop, or contribute to FPO pools.
              </p>
            </div>
          </div>
        </div>

        {/* Payout stats */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat
            label="Pools contributed"
            value={contributions?.length ?? 0}
          />
          <Stat
            label="Payout pending"
            value={`₹${totalPending.toLocaleString("en-IN")}`}
            accent="amber"
          />
          <Stat
            label="Payout released"
            value={`₹${totalReleased.toLocaleString("en-IN")}`}
            accent="green"
          />
        </div>

        {/* Contributions */}
        {contributions && contributions.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-bold text-[#0F1F1A]">
              Your pool contributions
            </h2>
            <div className="mt-4 overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Crop</th>
                      <th className="px-4 py-3 font-medium">Your share</th>
                      <th className="px-4 py-3 font-medium">Asking ₹/kg</th>
                      <th className="px-6 py-3 font-medium text-right">
                        Pool status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributions.map((c) => {
                      const pool = Array.isArray(c.pool)
                        ? c.pool[0]
                        : c.pool;
                      return (
                        <tr key={c.id} className="border-t border-[#E4EBE6]">
                          <td className="px-6 py-3 font-medium">
                            {pool?.crop ?? "—"}
                          </td>
                          <td className="px-4 py-3">{c.quantity_kg} kg</td>
                          <td className="px-4 py-3">
                            ₹{pool?.expected_price_per_kg ?? "—"}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <StatusPill status={pool?.status ?? "—"} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Payout history */}
        {safePayouts.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-bold text-[#0F1F1A]">
              Payout history
            </h2>
            <div className="mt-4 space-y-3">
              {safePayouts.map((p) => {
                const pool = Array.isArray(p.pool) ? p.pool[0] : p.pool;
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#E4EBE6] bg-white p-5"
                  >
                    <div>
                      <p className="font-display text-base font-bold text-[#1B4D3E]">
                        {pool?.crop ?? "Pool"} sale
                      </p>
                      <p className="mt-1 text-xs text-[#6B7A74]">
                        {p.quantity_kg} kg · {Number(p.share_pct).toFixed(1)}%
                        share ·{" "}
                        {new Date(p.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-[#6B7A74]">
                          Your payout
                        </p>
                        <p className="font-display text-lg font-extrabold text-[#1B4D3E]">
                          ₹{Number(p.net_payout).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <PayoutStatusPill status={p.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {safePayouts.length === 0 && contributions?.length === 0 && (
          <div className="mt-10 rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
            <p className="text-sm text-[#6B7A74]">
              Your FPO head hasn&apos;t created any pools yet. When they do,
              your contribution will appear here.
            </p>
          </div>
        )}
      </DashboardShell>
    );
  }

  /* ================================================================ */
  /*  CASE 3: NO FPO YET — show apply form                            */
  /* ================================================================ */
  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="FPO Collective"
      subtitle="Pool crops with nearby farmers and negotiate as a group."
    >
      <div className="mb-6">
        <Link
          href="/farmer"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#2E7D32]">
            FPO registration
          </p>
          <h2 className="font-display mt-2 text-2xl font-bold text-[#1B4D3E]">
            Register your FPO
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7A74]">
            Pool crops with farmers in your area. Sell collectively to bulk
            buyers at better prices. Members keep full control — they can sell
            individually anytime.
          </p>
        </div>
        <ApplyForm />
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <InfoCard
          icon="🏛️"
          title="One FPO head"
          body="You register the FPO and become the head. KrishiLink admin verifies your member list."
        />
        <InfoCard
          icon="👥"
          title="Members stay independent"
          body="Every member farmer can still list crops on their own. FPO is an additional option, not a replacement."
        />
        <InfoCard
          icon="📈"
          title="Better prices"
          body="Bulk aggregation attracts larger buyers and better rates — one truck, one negotiation."
        />
      </div>
    </DashboardShell>
  );
}

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
      <p className={`font-display mt-2 text-2xl font-extrabold ${color}`}>
        {value}
      </p>
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

function PayoutStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-[#FFF8E1] text-[#B26A00]",
    released: "bg-[#EAF5EE] text-[#2E7D32]",
    failed: "bg-[#FFF5F5] text-[#C62828]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        styles[status] ?? styles.pending
      }`}
    >
      {status}
    </span>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
      <span className="text-2xl">{icon}</span>
      <h3 className="font-display mt-3 text-base font-bold text-[#1B4D3E]">
        {title}
      </h3>
      <p className="mt-1 text-sm text-[#6B7A74]">{body}</p>
    </div>
  );
}