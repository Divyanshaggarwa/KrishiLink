"use client";

import { useEffect, useState } from "react";
import ButtonSpinner from "@/components/ButtonSpinner";

type NreQuote = {
  realization: {
    gross: number;
    commission: number;
    gatewayFee: number;
    handling: number;
    transportCost: number;
    qualityDeduction: number;
    netRealization: number;
    netPerKg: number;
    vehicle: string;
    breakdownPerKg: {
      pricePerKg: number;
      commissionPerKg: number;
      gatewayPerKg: number;
      handlingPerKg: number;
      transportPerKg: number;
      qualityPerKg: number;
      netPerKg: number;
    };
  };
  mandiBenchmark: {
    mandiNet: number;
    mandiNetPerKg: number;
  } | null;
  mandiMarket: string | null;
  mandiModalPrice: number | null;
  deltaVsMandi: number | null;
  distanceKm: number;
};

export default function RealizationCard({
  listingId,
  offerPrice,
  quantityKg,
}: {
  listingId: string;
  offerPrice: number;
  quantityKg: number;
}) {
  const [data, setData] = useState<NreQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offerPrice || offerPrice <= 0) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/nre/quote?listingId=${listingId}&offerPrice=${offerPrice}`
        );
        if (!res.ok) throw new Error("Could not compute quote");
        const json = (await res.json()) as NreQuote;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400); // debounce

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [listingId, offerPrice]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#C8E6C9] bg-[#EAF5EE] p-5">
        <div className="flex items-center gap-2 text-sm text-[#6B7A74]">
          <ButtonSpinner size={14} />
          Computing net realization…
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  const { realization: r, mandiBenchmark, deltaVsMandi } = data;
  const positiveDelta = deltaVsMandi !== null && deltaVsMandi > 0;

  return (
    <div className="rounded-2xl border border-[#C8E6C9] bg-[#EAF5EE] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
          Net Realization
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#1B4D3E]">
          {r.vehicle} · {data.distanceKm} km
        </span>
      </div>

      <p className="font-display mt-2 text-3xl font-extrabold text-[#1B4D3E]">
        ₹{r.netPerKg.toFixed(2)}
        <span className="ml-1 text-sm font-medium text-[#6B7A74]">/kg net</span>
      </p>
      <p className="mt-1 text-xs text-[#6B7A74]">
        Total take-home:{" "}
        <span className="font-semibold text-[#1B4D3E]">
          ₹{r.netRealization.toLocaleString("en-IN")}
        </span>{" "}
        of ₹{r.gross.toLocaleString("en-IN")} gross
      </p>

      {/* Breakdown */}
      <div className="mt-4 space-y-1.5 text-xs">
        <Row label="Offer price" value={`₹${r.breakdownPerKg.pricePerKg.toFixed(2)}/kg`} bold />
        <Row
          label="− Platform commission"
          value={`−₹${r.breakdownPerKg.commissionPerKg.toFixed(2)}/kg`}
          muted
        />
        <Row
          label="− Gateway fee"
          value={`−₹${r.breakdownPerKg.gatewayPerKg.toFixed(2)}/kg`}
          muted
        />
        <Row
          label="− Handling"
          value={`−₹${r.breakdownPerKg.handlingPerKg.toFixed(2)}/kg`}
          muted
        />
        <Row
          label="− Transport"
          value={`−₹${r.breakdownPerKg.transportPerKg.toFixed(2)}/kg`}
          muted
        />
        {r.breakdownPerKg.qualityPerKg > 0 && (
          <Row
            label="− Quality deduction"
            value={`−₹${r.breakdownPerKg.qualityPerKg.toFixed(2)}/kg`}
            muted
          />
        )}
      </div>

      {/* Mandi comparison */}
      {mandiBenchmark && deltaVsMandi !== null && (
        <div
          className={`mt-4 rounded-xl border p-3 ${
            positiveDelta
              ? "border-[#A5D6A7] bg-white"
              : "border-[#FFCDD2] bg-[#FFF5F5]"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-[#6B7A74]">
            vs {data.mandiMarket} mandi rate ₹{data.mandiModalPrice}/kg
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p
              className={`font-display text-xl font-bold ${
                positiveDelta ? "text-[#2E7D32]" : "text-[#C62828]"
              }`}
            >
              {positiveDelta ? "+" : ""}₹
              {Math.abs(deltaVsMandi).toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-[#6B7A74]">
              {positiveDelta
                ? "more than selling at mandi"
                : "less than selling at mandi"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        muted ? "text-[#6B7A74]" : ""
      } ${bold ? "font-semibold text-[#0F1F1A]" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}