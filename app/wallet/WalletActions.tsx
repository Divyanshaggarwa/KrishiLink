"use client";

import { useActionState, useState } from "react";
import {
  topUpWallet,
  withdrawFromWallet,
  type WalletActionResult,
} from "@/lib/wallet/actions";
import ButtonSpinner from "@/components/ButtonSpinner";

const INITIAL: WalletActionResult = { ok: false };
const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

export default function WalletActions({ balance }: { balance: number }) {
  const [mode, setMode] = useState<"topup" | "withdraw">("topup");

  const [topupState, topupAction, topupPending] = useActionState<
    WalletActionResult,
    FormData
  >(topUpWallet, INITIAL);

  const [withdrawState, withdrawAction, withdrawPending] = useActionState<
    WalletActionResult,
    FormData
  >(withdrawFromWallet, INITIAL);

  const [topupAmount, setTopupAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  return (
    <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
      <div className="flex rounded-full bg-[#F8F9FA] p-1">
        <button
          onClick={() => setMode("topup")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            mode === "topup"
              ? "bg-white text-[#1B4D3E] shadow-sm"
              : "text-[#6B7A74]"
          }`}
        >
          Top up
        </button>
        <button
          onClick={() => setMode("withdraw")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            mode === "withdraw"
              ? "bg-white text-[#1B4D3E] shadow-sm"
              : "text-[#6B7A74]"
          }`}
        >
          Withdraw
        </button>
      </div>

      {mode === "topup" && (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
          <h3 className="font-display text-base font-bold text-[#1B4D3E]">
            Add money
          </h3>
          <p className="mt-1 text-xs text-[#6B7A74]">
            Simulated UPI / card payment. Razorpay in production.
          </p>

          <form action={topupAction} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-[#0F1F1A]">
                Amount (₹)
              </label>
              <input
                name="amount"
                type="number"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                min="1"
                max="500000"
                placeholder="Enter amount"
                required
                className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTopupAmount(String(amt))}
                  className="rounded-xl border border-[#E4EBE6] px-3 py-2 text-xs font-medium text-[#6B7A74] transition-colors hover:border-[#2E7D32] hover:text-[#2E7D32]"
                >
                  ₹{amt.toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            {topupState.error && (
              <p className="text-xs text-[#C62828]">{topupState.error}</p>
            )}
            {topupState.ok && (
              <p className="rounded-lg bg-[#EAF5EE] p-2 text-xs text-[#2E7D32]">
                ✓ Top-up successful
              </p>
            )}

            <button
              type="submit"
              disabled={topupPending || !topupAmount}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {topupPending ? (
                <>
                  <ButtonSpinner size={14} /> Processing…
                </>
              ) : (
                "Add to wallet"
              )}
            </button>
          </form>
        </div>
      )}

      {mode === "withdraw" && (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
          <h3 className="font-display text-base font-bold text-[#1B4D3E]">
            Withdraw to bank
          </h3>
          <p className="mt-1 text-xs text-[#6B7A74]">
            Simulated bank transfer. Razorpay payouts in production.
          </p>

          <form action={withdrawAction} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-[#0F1F1A]">
                Amount (₹)
              </label>
              <input
                name="amount"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="100"
                max={balance}
                placeholder="Enter amount"
                required
                className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
              />
              <p className="mt-1 text-[11px] text-[#6B7A74]">
                Available: ₹{balance.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setWithdrawAmount(String(Math.floor(balance / 2)))
                }
                className="rounded-xl border border-[#E4EBE6] px-3 py-2 text-xs font-medium text-[#6B7A74] hover:border-[#2E7D32]"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => setWithdrawAmount(String(Math.floor(balance)))}
                className="rounded-xl border border-[#E4EBE6] px-3 py-2 text-xs font-medium text-[#6B7A74] hover:border-[#2E7D32]"
              >
                Full balance
              </button>
            </div>

            {withdrawState.error && (
              <p className="text-xs text-[#C62828]">{withdrawState.error}</p>
            )}
            {withdrawState.ok && (
              <p className="rounded-lg bg-[#EAF5EE] p-2 text-xs text-[#2E7D32]">
                ✓ Transfer initiated
              </p>
            )}

            <button
              type="submit"
              disabled={withdrawPending || !withdrawAmount || balance < 100}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {withdrawPending ? (
                <>
                  <ButtonSpinner size={14} /> Processing…
                </>
              ) : (
                "Withdraw"
              )}
            </button>
          </form>
        </div>
      )}

      <div className="rounded-[24px] border border-[#C8E6C9] bg-[#EAF5EE] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
          How it works
        </p>
        <ul className="mt-3 space-y-2 text-xs text-[#1B4D3E]/85">
          <li>• Buyers pay 30% escrow from wallet on order acceptance</li>
          <li>• Remaining 70% is released on delivery confirmation</li>
          <li>• Sellers receive net amount after logistics + platform fees</li>
          <li>• FPO pool payments auto-split to members by contribution</li>
        </ul>
      </div>
    </div>
  );
}