"use client";

import { useActionState, useEffect, useState } from "react";
import { placeOfferAction, type OfferState } from "./actions";
import { evaluateFairness, type FairnessResult } from "@/lib/ai";
import ButtonSpinner from "@/components/ButtonSpinner";
type Listing = {
  id: string;
  crop: string;
  quality_grade: "A" | "B" | "C" | null;
  quantity_kg: number;
  expected_price_per_kg: number;
  district: string;
  month: number;
};

export default function OfferForm({ listing }: { listing: Listing }) {
  const bound = placeOfferAction.bind(null, listing.id);
  const [state, formAction, isPending] = useActionState<OfferState, FormData>(
    bound,
    null
  );

  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [pickupMode, setPickupMode] = useState<"pickup" | "delivery">("pickup");
  const [message, setMessage] = useState("");

  const [fairness, setFairness] = useState<FairnessResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Run Fairness AI whenever price + qty are valid
  useEffect(() => {
    const p = Number(price);
    const q = Number(qty);
    if (!p || p <= 0 || !q || q <= 0 || !listing.quality_grade) {
      setFairness(null);
      return;
    }

    let cancelled = false;
    setAnalyzing(true);

    (async () => {
      const result = await evaluateFairness({
        crop: listing.crop,
        quality: listing.quality_grade as "A" | "B" | "C",
        quantityKg: q,
        district: listing.district,
        month: listing.month,
        farmerExpectedPrice: listing.expected_price_per_kg,
        buyerBid: p,
      });
      if (cancelled) return;
      setFairness(result);
      setAnalyzing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [price, qty, listing]);

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
            required
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 24"
            className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#EAF5EE]"
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
            placeholder={`Max ${listing.quantity_kg}`}
            className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#EAF5EE]"
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
          Message to farmer (optional)
        </label>
        <textarea
          name="message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Need regular supply monthly"
          className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#EAF5EE]"
        />
      </div>

      {/* FAIR PRICE AI PANEL — only appears once bid values are entered */}
      {(analyzing || fairness) && (
        <div className="rounded-2xl border border-[#C8E6C9] bg-[#EAF5EE] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
              Fair Price AI
            </p>
            {fairness?.source === "mock" && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#C62828]">
                Indicative
              </span>
            )}
          </div>

          {analyzing && !fairness ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-[#6B7A74]">
              <ButtonSpinner size={14} />
              Evaluating market parameters…
            </div>
          ) : fairness ? (
            <>
              <p className="font-display mt-3 text-2xl font-extrabold text-[#1B4D3E]">
                ₹{fairness.fairLow.toFixed(2)} – ₹
                {fairness.fairHigh.toFixed(2)}
                <span className="ml-1 text-sm font-medium text-[#6B7A74]">
                  /kg
                </span>
              </p>
              <p className="mt-1 text-xs text-[#6B7A74]">
                Fair range for {listing.crop} · Grade {listing.quality_grade} ·{" "}
                {listing.district}
              </p>

              {/* Two-column verdict */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <VerdictBox
                  label="Farmer asking"
                  value={`₹${listing.expected_price_per_kg.toFixed(2)}`}
                  verdict={fairness.farmerVerdict}
                />
                <VerdictBox
                  label="Your offer"
                  value={`₹${Number(price).toFixed(2)}`}
                  verdict={fairness.buyerVerdict}
                />
              </div>

              {fairness.suggestions.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-xs text-[#1B4D3E]/85">
                  {fairness.suggestions.map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              )}

              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] text-[#6B7A74] hover:text-[#1B4D3E]">
                  Why this range?
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-[#6B7A74]">
                  {fairness.factors.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              </details>
            </>
          ) : null}
        </div>
      )}

      {state?.error && (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          {state.error}
        </div>
      )}

            <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1B4D3E] px-6 py-3.5 text-sm font-medium text-white transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? (
          <>
            <ButtonSpinner />
            Placing your offer…
          </>
        ) : (
          "Place offer"
        )}
      </button>
    </form>
  );
}

function VerdictBox({
  label,
  value,
  verdict,
}: {
  label: string;
  value: string;
  verdict: "fair" | "above_fair" | "below_fair";
}) {
  const styles = {
    fair: {
      bg: "bg-white",
      border: "border-[#A5D6A7]",
      text: "text-[#2E7D32]",
      badge: "Fair",
    },
    above_fair: {
      bg: "bg-[#FFF5F5]",
      border: "border-[#FFCDD2]",
      text: "text-[#C62828]",
      badge: "Above fair",
    },
    below_fair: {
      bg: "bg-[#FFF8E1]",
      border: "border-[#FFE082]",
      text: "text-[#B26A00]",
      badge: "Below fair",
    },
  }[verdict];

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-3`}>
      <p className="text-[10px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p className={`font-display mt-1 text-lg font-bold ${styles.text}`}>
        {value}
      </p>
      <p className={`mt-0.5 text-[10px] font-medium ${styles.text}`}>
        {styles.badge}
      </p>
    </div>
  );
}