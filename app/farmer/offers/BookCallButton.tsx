"use client";

import { useActionState, useState } from "react";
import { requestCallAction, type OfferActionResult } from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

export default function BookCallButton({
  offerId,
  listingId,
  receiverId,
  receiverName,
}: {
  offerId: string;
  listingId: string;
  receiverId: string;
  receiverName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<OfferActionResult, FormData>(
    requestCallAction,
    null
  );

  if (state?.ok) {
    return (
      <span className="whitespace-nowrap rounded-full bg-[#EAF5EE] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#2E7D32]">
        Call requested
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-full border border-[#E4EBE6] px-3 py-2 text-xs font-medium text-[#6B7A74] transition-colors hover:border-[#1B4D3E] hover:text-[#1B4D3E]"
      >
        📞 Book a call
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              Book a call with {receiverName}
            </h3>
            <p className="mt-1 text-xs text-[#6B7A74]">
              Discuss the offer and negotiate directly. We&apos;ll notify them.
            </p>

            <form action={formAction} className="mt-5 space-y-4">
              <input type="hidden" name="offerId" value={offerId} />
              <input type="hidden" name="listingId" value={listingId} />
              <input type="hidden" name="receiverId" value={receiverId} />

              <div>
                <label className="text-xs font-medium text-[#0F1F1A]">
                  Preferred time
                </label>
                <input
                  type="datetime-local"
                  name="preferred_time"
                  className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#0F1F1A]">
                  Notes (optional)
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="e.g. Can we discuss a bulk quantity?"
                  className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
                />
              </div>

              {state?.error && (
                <p className="text-xs text-[#C62828]">{state.error}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 rounded-full border border-[#E4EBE6] px-4 py-3 text-sm font-medium text-[#6B7A74] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1B4D3E] px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {pending ? (
                    <>
                      <ButtonSpinner size={14} /> Requesting…
                    </>
                  ) : (
                    "Send request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}