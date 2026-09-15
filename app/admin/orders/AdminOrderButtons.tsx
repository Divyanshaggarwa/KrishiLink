"use client";

import { useActionState } from "react";
import {
  adminMarkShippedAction,
  adminMarkDeliveredAction,
  type AdminOrderState,
} from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

export function AdminShipButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<
    AdminOrderState,
    FormData
  >(adminMarkShippedAction, null);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-4 py-2 text-xs font-semibold text-white hover:scale-[1.03] transition-transform disabled:opacity-60"
      >
        {pending ? <ButtonSpinner size={12} /> : null}
        Mark shipped
      </button>
      {state?.error && <p className="text-[10px] text-[#C62828]">{state.error}</p>}
    </form>
  );
}

export function AdminDeliverButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<
    AdminOrderState,
    FormData
  >(adminMarkDeliveredAction, null);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-full bg-[#2E7D32] px-4 py-2 text-xs font-semibold text-white hover:scale-[1.03] transition-transform disabled:opacity-60"
      >
        {pending ? <ButtonSpinner size={12} /> : null}
        Mark delivered
      </button>
      {state?.error && <p className="text-[10px] text-[#C62828]">{state.error}</p>}
    </form>
  );
}