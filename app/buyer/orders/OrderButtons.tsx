"use client";

import { useActionState } from "react";
import {
  payEscrowAction,
  confirmDeliveryAction,
  type OrderActionState,
} from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

export function PayEscrowButton({ orderId, amount }: { orderId: string; amount: number }) {
  const [state, formAction, pending] = useActionState<OrderActionState, FormData>(
    payEscrowAction,
    null
  );

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
          `Pay 30% advance — ₹${amount.toLocaleString("en-IN")}`
        )}
      </button>
      <p className="text-[10px] text-[#6B7A74]">
        Simulated payment · Razorpay in production
      </p>
      {state?.error && (
        <p className="text-[10px] text-[#C62828]">{state.error}</p>
      )}
    </form>
  );
}

export function ConfirmDeliveryButton({
  orderId,
  finalAmount,
}: {
  orderId: string;
  finalAmount: number;
}) {
  const [state, formAction, pending] = useActionState<OrderActionState, FormData>(
    confirmDeliveryAction,
    null
  );

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
          `Confirm delivery & release ₹${finalAmount.toLocaleString("en-IN")}`
        )}
      </button>
      <p className="text-[10px] text-[#6B7A74]">
        Releases the remaining 70% to the farmer
      </p>
      {state?.error && (
        <p className="text-[10px] text-[#C62828]">{state.error}</p>
      )}
    </form>
  );
}