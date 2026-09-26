"use client";

import { useActionState, useState } from "react";
import { placePoolOfferAction, type PoolOfferState } from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

export default function PoolOfferForm({
  poolId,
  totalQuantityKg,
  askingPrice,
}: {
  poolId: string;
  totalQuantityKg: number;
  askingPrice: number;
}) {
  const bound = placePoolOfferAction.bind(null, poolId);
  const [state, formAction, pending] = useActionState<PoolOfferState, FormData>(
    bound,
    null
  );

  const [price, setPrice] = useState(askingPrice.toString());
  const [qty, setQty] = useState("");
  const [pickupMode, setPickupMode] = useState<"pickup" | "delivery">(
    "pickup"
  );
  const [message, setMessage] = useState("");

  const total =
    (Number(price) || 0) * (Number(qty) || 0);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-[#0F1F1A]">
            Your offer (₹/kg) <span className="text-[#C62828]">*</span>
          </label>
          <input
            name="price_per_kg"
            type="number"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#0F1F1A]">
            Quantity (kg) <span className="text-[#C62828]">*</span>
          </label>
          <input
            name="quantity_kg"
            type="number"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={`Max ${totalQuantityKg}`}
            className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#0F1F1A]">Pickup mode</label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["pickup", "delivery"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPickupMode(m)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-colors ${
                pickupMode === m
                  ? "border-[#1B4D3E] bg-[#1B4D3E] text-white"
                  : "border-[#E4EBE6] bg-white text-[#6B7A74] hover:border-[#2E7D32]"
              }`}
            >
              {m === "pickup" ? "I will pick up" : "Deliver to me"}
            </button>
          ))}
        </div>
        <input type="hidden" name="pickup_mode" value={pickupMode} />
      </div>

      <div>
        <label className="text-xs font-medium text-[#0F1F1A]">
          Message to FPO (optional)
        </label>
        <textarea
          name="message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Need recurring monthly supply"
          className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
        />
      </div>

      {total > 0 && (
        <div className="rounded-2xl border border-[#C8E6C9] bg-[#EAF5EE] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
            Your total offer
          </p>
          <p className="font-display mt-1 text-2xl font-extrabold text-[#1B4D3E]">
            ₹{total.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-[#6B7A74]">
            Amount will be distributed among {totalQuantityKg > 0 ? "all" : ""}{" "}
            pooling members by their contribution.
          </p>
        </div>
      )}

      {state?.error && (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1B4D3E] px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {pending ? (
          <>
            <ButtonSpinner size={14} /> Placing offer…
          </>
        ) : (
          "Place offer on pool"
        )}
      </button>
    </form>
  );
}