"use client";

import { useActionState } from "react";
import { updateFeeConfigAction, type FeeState } from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

type FeeRow = { key: string; value: number; unit: string; description: string | null };
type TransportRow = {
  vehicle: string;
  rate_per_km: number;
  min_weight_kg: number;
  max_weight_kg: number;
};

export default function FeeForm({
  fees,
  transports,
}: {
  fees: FeeRow[];
  transports: TransportRow[];
}) {
  const [state, formAction, pending] = useActionState<FeeState, FormData>(
    updateFeeConfigAction,
    null
  );

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
        <h2 className="font-display text-lg font-bold text-[#1B4D3E]">
          Platform fees
        </h2>
        <p className="mt-1 text-xs text-[#6B7A74]">
          These values apply instantly to every new Net Realization quote.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {fees.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-[#0F1F1A]">
                {f.key}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  name={f.key}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={f.value}
                  className="w-full rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
                />
                <span className="shrink-0 text-xs text-[#6B7A74]">
                  {f.unit}
                </span>
              </div>
              {f.description && (
                <p className="mt-1 text-[11px] text-[#6B7A74]">
                  {f.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
        <h2 className="font-display text-lg font-bold text-[#1B4D3E]">
          Transport rates
        </h2>
        <p className="mt-1 text-xs text-[#6B7A74]">
          Per-km rate by vehicle type. Used in every Net Realization quote.
        </p>

        <div className="mt-5 space-y-3">
          {transports.map((t) => (
            <div
              key={t.vehicle}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E4EBE6] p-3"
            >
              <input type="hidden" name="transport_vehicle" value={t.vehicle} />
              <span className="min-w-[120px] text-sm font-medium">
                {t.vehicle}
              </span>
              <span className="text-[11px] text-[#6B7A74]">
                {t.min_weight_kg}–{t.max_weight_kg} kg
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-[#6B7A74]">₹</span>
                <input
                  name="transport_rate"
                  type="number"
                  step="0.5"
                  min="0"
                  defaultValue={t.rate_per_km}
                  className="w-24 rounded-xl border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
                />
                <span className="text-xs text-[#6B7A74]">/km</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {state?.error && (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-xl border border-[#A5D6A7] bg-[#EAF5EE] p-3 text-sm text-[#2E7D32]">
          ✓ Fees updated. All new quotes will use the new values.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-8 py-3.5 text-sm font-medium text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {pending ? (
            <>
              <ButtonSpinner size={14} /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </form>
  );
}