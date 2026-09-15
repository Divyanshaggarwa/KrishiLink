"use client";

import { useActionState, useState } from "react";
import { acceptOfferAction, type OfferActionResult } from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

export default function AcceptModal({
  offerId,
  buyerName,
  pricePerKg,
  offerQty,
  listingTotalQty,
  netKrishilink,
  netSelf,
  pickupMode,
  distanceKm,
}: {
  offerId: string;
  buyerName: string;
  pricePerKg: number;
  offerQty: number;
  listingTotalQty: number;
  netKrishilink: number;
  netSelf: number;
  pickupMode: string;
  distanceKm: number;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"krishilink" | "self">("krishilink");
  const [relist, setRelist] = useState(true);

  const [state, formAction, pending] = useActionState<OfferActionResult, FormData>(
    acceptOfferAction,
    null
  );

  const net = mode === "krishilink" ? netKrishilink : netSelf;
  const total = Number((net * offerQty).toFixed(2));
  const remaining = listingTotalQty - offerQty;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-full bg-[#1B4D3E] px-4 py-2 text-xs font-semibold text-white transition-all hover:scale-[1.03]"
      >
        Accept deal
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              Confirm acceptance
            </h3>
            <p className="mt-1 text-xs text-[#6B7A74]">
              {buyerName} · ₹{pricePerKg.toFixed(2)}/kg · {offerQty} kg ·{" "}
              {distanceKm} km
            </p>

            {/* Transport mode */}
            {pickupMode === "delivery" ? (
              <div className="mt-5">
                <p className="text-xs font-medium text-[#0F1F1A]">
                  How will you deliver?
                </p>
                <div className="mt-2 grid gap-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      mode === "krishilink"
                        ? "border-[#1B4D3E] bg-[#EAF5EE]"
                        : "border-[#E4EBE6] hover:border-[#2E7D32]"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={mode === "krishilink"}
                      onChange={() => setMode("krishilink")}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold">KrishiLink arranges</p>
                      <p className="text-[11px] text-[#6B7A74]">
                        Transport cost ₹{(pricePerKg - netKrishilink).toFixed(2)}
                        /kg deducted
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      mode === "self"
                        ? "border-[#1B4D3E] bg-[#EAF5EE]"
                        : "border-[#E4EBE6] hover:border-[#2E7D32]"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={mode === "self"}
                      onChange={() => setMode("self")}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold">I&apos;ll deliver myself</p>
                      <p className="text-[11px] text-[#6B7A74]">
                        No transport cost deducted
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-[#F8F9FA] p-3 text-xs text-[#6B7A74]">
                Buyer chose <strong>pickup</strong>. No transport cost deducted.
              </div>
            )}

            {/* Partial quantity re-list choice */}
            {remaining > 0 && (
              <div className="mt-5 rounded-xl border border-[#FFE082] bg-[#FFF8E1] p-4">
                <p className="text-xs font-semibold text-[#B26A00]">
                  ⚠️ Partial sale · {remaining} kg will remain
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={relist}
                    onChange={(e) => setRelist(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-[#0F1F1A]">
                    <strong>Re-list the remaining {remaining} kg</strong> — the
                    listing stays active for other buyers.
                    <br />
                    <span className="text-[11px] text-[#6B7A74]">
                      Uncheck to stop accepting new bids on this crop.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {/* Net take-home */}
            <div className="mt-5 rounded-xl bg-[#1B4D3E] p-4 text-white">
              <p className="text-[10px] uppercase tracking-widest text-[#A5D6A7]">
                Your take-home
              </p>
              <p className="font-display mt-1 text-2xl font-extrabold">
                ₹{net.toFixed(2)}/kg
              </p>
              <p className="mt-1 text-xs text-[#A5D6A7]">
                Total ₹{total.toLocaleString("en-IN")}
              </p>
            </div>

            {state?.error && (
              <p className="mt-3 text-xs text-[#C62828]">{state.error}</p>
            )}

            <form action={formAction} className="mt-6 flex gap-2">
              <input type="hidden" name="offerId" value={offerId} />
              <input
                type="hidden"
                name="transport_mode"
                value={pickupMode === "delivery" ? mode : "self"}
              />
              {remaining > 0 && relist && (
                <input type="hidden" name="relist_leftover" value="on" />
              )}
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
                    <ButtonSpinner size={14} /> Confirming…
                  </>
                ) : (
                  "Confirm accept"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}