export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function FpoWalletPage() {
  const profile = await requireRole(["farmer"]);
  if (profile.fpo_status !== "approved") redirect("/farmer/fpo");

  const supabase = await createClient();

  // FPO wallet balance
  const { data: wallet } = await supabase
    .from("fpo_wallets")
    .select("balance")
    .eq("fpo_id", profile.id)
    .maybeSingle();

  const balance = Number(wallet?.balance ?? 0);

  // FPO transactions
  const { data: txns } = await supabase
    .from("wallet_transactions")
    .select("id, kind, amount, balance_after, description, created_at")
    .eq("fpo_id", profile.id)
    .eq("wallet_type", "fpo")
    .order("created_at", { ascending: false })
    .limit(100);

  const safeTxns = txns || [];

  const totalIn = safeTxns
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = safeTxns
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="FPO Wallet"
      subtitle="Collective wallet — pool sales flow in, member shares flow out."
    >
      <div className="mb-6">
        <Link
          href="/farmer/fpo/dashboard"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to FPO overview
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] p-6 text-white md:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
              FPO wallet balance
            </p>
            <p className="font-display mt-3 text-4xl font-extrabold md:text-5xl">
              ₹{balance.toLocaleString("en-IN")}
            </p>
            <p className="mt-2 text-xs text-white/60">
              {profile.fpo_name} · {profile.fpo_id}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-white/50">Total received</p>
                <p className="mt-0.5 font-semibold text-[#A5D6A7]">
                  +₹{totalIn.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-white/50">Distributed to members</p>
                <p className="mt-0.5 font-semibold text-white/80">
                  −₹{totalOut.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
            <div className="flex items-center justify-between border-b border-[#E4EBE6] px-6 py-4">
              <h2 className="font-display text-base font-bold text-[#1B4D3E]">
                FPO transactions
              </h2>
              <span className="text-[11px] text-[#6B7A74]">
                {safeTxns.length} entries
              </span>
            </div>

            {safeTxns.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-[#6B7A74]">
                No FPO transactions yet. Sales from pools will appear here.
              </p>
            ) : (
              <div className="divide-y divide-[#E4EBE6]">
                {safeTxns.map((t) => {
                  const amt = Number(t.amount);
                  const isCredit = amt > 0;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-4 px-6 py-4"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                          isCredit
                            ? "bg-[#EAF5EE] text-[#2E7D32]"
                            : "bg-[#FFF5F5] text-[#C62828]"
                        }`}
                      >
                        {isCredit ? "↓" : "↑"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F1F1A]">
                          {t.description ?? t.kind}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#6B7A74]">
                          {new Date(t.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {t.kind.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-display text-base font-bold ${
                            isCredit ? "text-[#2E7D32]" : "text-[#C62828]"
                          }`}
                        >
                          {isCredit ? "+" : "−"}₹
                          {Math.abs(amt).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#6B7A74]">
                          Bal ₹
                          {Number(t.balance_after).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[24px] border border-[#C8E6C9] bg-[#EAF5EE] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
              How FPO payments work
            </p>
            <ol className="mt-3 space-y-2 text-xs text-[#1B4D3E]/85">
              <li>1. Buyer pays for a pool sale</li>
              <li>2. Amount lands in this FPO wallet</li>
              <li>3. Auto-distributed to members by contribution</li>
              <li>4. Members receive in their personal wallet</li>
            </ol>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}