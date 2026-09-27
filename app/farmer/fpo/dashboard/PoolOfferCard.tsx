"use client";

import { useActionState } from "react";
import { acceptPoolOfferAction, type PoolActionResult } from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

const INITIAL: PoolActionResult = { ok: false };

type Props = {
  offerId: string;
  poolCrop: string;
  buyerName: string;
  buyerRegion: string;
  pricePerKg: number;
  quantityKg: number;
  total: number;
  message: string | null;
  pickupMode: string;
};

export default function PoolOfferCard({
  offerId,
  poolCrop,
  buyerName,
  buyerRegion,
  pricePerKg,
  quantityKg,
  total,
  message,
  pickupMode,
}: Props) {
  const [state, formAction, pending] = useActionState<
    PoolActionResult,
    FormData
  >(acceptPoolOfferAction, INITIAL);

  return (
    <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-[#1B4D3E]">
            {poolCrop} pool
          </h3>
          <p className="mt-1 text-xs text-[#6B7A74]">
            {buyerName} · {buyerRegion} · {pickupMode}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-[#6B7A74]">
            Total offer
          </p>
          <p className="font-display text-xl font-extrabold text-[#1B4D3E]">
            ₹{total.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Price" value={`₹${pricePerKg.toFixed(2)}/kg`} />
        <Field label="Quantity" value={`${quantityKg} kg`} />
        <Field
          label="Net (after txn)"
          value={`₹${(total - quantityKg * 0.3).toFixed(2)}`}
          accent
        />
      </div>

      {message && (
        <p className="mt-3 rounded-xl bg-[#F8F9FA] p-3 text-xs italic text-[#6B7A74]">
          &ldquo;{message}&rdquo;
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4EBE6] pt-4">
        <p className="text-[11px] text-[#6B7A74]">
          Accepting splits payment among members by contribution
        </p>
        <form action={formAction}>
          <input type="hidden" name="offerId" value={offerId} />
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-5 py-2.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
          >
            {pending ? (
              <>
                <ButtonSpinner size={12} /> Accepting…
              </>
            ) : (
              "✓ Accept & split"
            )}
          </button>
        </form>
      </div>

      {state.error && (
        <p className="mt-2 text-[11px] text-[#C62828]">{state.error}</p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          accent ? "text-[#1B4D3E]" : "text-[#0F1F1A]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}