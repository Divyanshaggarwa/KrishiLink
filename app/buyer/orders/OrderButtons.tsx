"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  payEscrowFromWallet,
  confirmDeliveryFromWallet,
  type WalletActionResult,
} from "@/lib/wallet/actions";
import ButtonSpinner from "@/components/ButtonSpinner";

const INITIAL: WalletActionResult = { ok: false };

export function PayEscrowButton({
  orderId,
  amount,
  buyerBalance,
}: {
  orderId: string;
  amount: number;
  buyerBalance: number;
}) {
  const [state, formAction, pending] = useActionState<
    WalletActionResult,
    FormData
  >(payEscrowFromWallet, INITIAL);

  const insufficient = buyerBalance < amount;

  if (insufficient) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] px-4 py-3 text-right">
          <p className="text-xs font-semibold text-[#C62828]">
            Insufficient wallet balance
          </p>
          <p className="mt-1 text-[11px] text-[#C62828]/80">
            Need ₹{amount.toLocaleString("en-IN")} · Available ₹
            {buyerBalance.toLocaleString("en-IN")}
          </p>
        </div>
        <Link
          href="/wallet"
          className="rounded-full bg-[#1B4D3E] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
        >
          Top up wallet →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
      >
        {pending ? (
          <>
            <ButtonSpinner size={14} /> Processing…
          </>
        ) : (
          `Pay 30% from wallet — ₹${amount.toLocaleString("en-IN")}`
        )}
      </button>
      <p className="text-[10px] text-[#6B7A74]">
        Wallet balance: ₹{buyerBalance.toLocaleString("en-IN")}
      </p>
      {state.error && (
        <p className="text-[10px] text-[#C62828]">{state.error}</p>
      )}
    </form>
  );
}

export function ConfirmDeliveryButton({
  orderId,
  finalAmount,
  buyerBalance,
}: {
  orderId: string;
  finalAmount: number;
  buyerBalance: number;
}) {
  const [state, formAction, pending] = useActionState<
    WalletActionResult,
    FormData
  >(confirmDeliveryFromWallet, INITIAL);

  const insufficient = buyerBalance < finalAmount;

  if (insufficient) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] px-4 py-3 text-right">
          <p className="text-xs font-semibold text-[#C62828]">
            Insufficient balance for final payment
          </p>
          <p className="mt-1 text-[11px] text-[#C62828]/80">
            Need ₹{finalAmount.toLocaleString("en-IN")} · Available ₹
            {buyerBalance.toLocaleString("en-IN")}
          </p>
        </div>
        <Link
          href="/wallet"
          className="rounded-full bg-[#1B4D3E] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
        >
          Top up wallet →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-full bg-[#2E7D32] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
      >
        {pending ? (
          <>
            <ButtonSpinner size={14} /> Releasing…
          </>
        ) : (
          `Confirm & release ₹${finalAmount.toLocaleString("en-IN")}`
        )}
      </button>
      <p className="text-[10px] text-[#6B7A74]">
        Wallet balance: ₹{buyerBalance.toLocaleString("en-IN")}
      </p>
      {state.error && (
        <p className="text-[10px] text-[#C62828]">{state.error}</p>
      )}
    </form>
  );
}