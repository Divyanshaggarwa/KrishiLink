export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import WalletActions from "./WalletActions";

export default async function WalletPage() {
  const profile = await requireRole([
    "farmer",
    "buyer",
    "pds_operator",
    "admin",
  ]);

  const supabase = await createClient();

  // Fetch wallet + transactions
  const walletRes = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", profile.id)
    .maybeSingle();

  const txnsRes = await supabase
    .from("wallet_transactions")
    .select(
      "id, kind, amount, balance_after, reference_id, description, created_at"
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const balance = Number(walletRes.data?.balance ?? 0);
  const safeTxns = txnsRes.data || [];

  const totalIn = safeTxns
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = safeTxns
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  return (
    <DashboardShell
      profile={profile}
      showBack={false}
      title="Wallet"
      subtitle="Your KrishiLink balance — top up, receive payments, withdraw anytime."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] p-6 text-white md:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
              Available balance
            </p>
            <p className="font-display mt-3 text-4xl font-extrabold md:text-5xl">
              ₹{balance.toLocaleString("en-IN")}
            </p>
            <p className="mt-2 text-xs text-white/60">
              KrishiLink Wallet · INR
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-white/50">Total received</p>
                <p className="mt-0.5 font-semibold text-[#A5D6A7]">
                  +₹{totalIn.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-white/50">Total spent</p>
                <p className="mt-0.5 font-semibold text-white/80">
                  −₹{totalOut.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
            <div className="flex items-center justify-between border-b border-[#E4EBE6] px-6 py-4">
              <h2 className="font-display text-base font-bold text-[#1B4D3E]">
                Transactions
              </h2>
              <span className="text-[11px] text-[#6B7A74]">
                {safeTxns.length} entries
              </span>
            </div>

            {safeTxns.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-[#6B7A74]">
                No transactions yet.
              </p>
            ) : (
              <div className="divide-y divide-[#E4EBE6]">
                {safeTxns.map((t) => {
                  const amt = Number(t.amount);
                  const isCredit = amt > 0;
                  return (
                    <div key={t.id} className="flex items-center gap-4 px-6 py-4">
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
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {t.kind.replace("_", " ")}
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
                          Bal ₹{Number(t.balance_after).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <WalletActions balance={balance} />
      </div>
    </DashboardShell>
  );
}