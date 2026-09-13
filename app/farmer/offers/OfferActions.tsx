"use client";

import { useActionState, useState } from "react";
import {
  acceptOfferAction,
  rejectOfferAction,
  type OfferActionResult,
} from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

export function AcceptButton({ offerId }: { offerId: string }) {
  const [state, formAction, isPending] = useActionState<
    OfferActionResult,
    FormData
  >(acceptOfferAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="offerId" value={offerId} />
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#1B4D3E] px-4 py-2 text-xs font-semibold text-white transition-all hover:scale-[1.03] disabled:opacity-60"
      >
        {isPending ? (
          <>
            <ButtonSpinner size={12} /> Accepting…
          </>
        ) : (
          "Accept deal"
        )}
      </button>
      {state?.error && (
        <p className="mt-1 max-w-[180px] text-[10px] text-[#C62828]">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function RejectButton({ offerId }: { offerId: string }) {
  const [state, formAction, isPending] = useActionState<
    OfferActionResult,
    FormData
  >(rejectOfferAction, null);

  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="rounded-full border border-[#E4EBE6] px-4 py-2 text-xs font-medium text-[#6B7A74] transition-colors hover:border-[#C62828] hover:text-[#C62828]"
      >
        Reject
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="offerId" value={offerId} />
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-full bg-[#C62828] px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
      >
        {isPending ? <ButtonSpinner size={12} /> : null}
        Confirm
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="text-xs text-[#6B7A74] hover:underline"
      >
        Cancel
      </button>
      {state?.error && (
        <span className="text-[10px] text-[#C62828]">{state.error}</span>
      )}
    </form>
  );
}