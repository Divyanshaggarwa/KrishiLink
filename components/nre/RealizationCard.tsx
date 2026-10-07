"use client";

import { useEffect, useState } from "react";
import ButtonSpinner from "@/components/ButtonSpinner";
import { optimizeRoute, type RouteOutput } from "@/lib/ai";

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
    breakdownPerKg: {
      pricePerKg: number;
      farmerFeePerKg: number;
      gatewayPerKg: number;
      handlingPerKg: number;
      qualityPerKg: number;
      netPerKg: number;
    };
  };
  buyerLandedCost: {
    totalPayable: number;
    landedPerKg: number;
    transportCost: number;
    vehicle: string;
  };
  routeCoordinates: {
    farm: { lat: number; lng: number };
    buyer: { lat: number; lng: number };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNreQuote(value: unknown): value is NreQuote {
  if (!isRecord(value)) return false;
  const realization = value.realization;
  const buyerLandedCost = value.buyerLandedCost;
  if (!isRecord(realization) || !isRecord(buyerLandedCost)) return false;

  const breakdown = realization.breakdownPerKg;
  if (!isRecord(breakdown)) return false;

  return (
    isFiniteNumber(realization.gross) &&
    isFiniteNumber(realization.netRealization) &&
    isFiniteNumber(realization.netPerKg) &&
    isFiniteNumber(breakdown.pricePerKg) &&
    isFiniteNumber(breakdown.farmerFeePerKg) &&
    isFiniteNumber(breakdown.gatewayPerKg) &&
    isFiniteNumber(breakdown.handlingPerKg) &&
    isFiniteNumber(breakdown.qualityPerKg) &&
    isFiniteNumber(buyerLandedCost.transportCost) &&
    isFiniteNumber(buyerLandedCost.landedPerKg) &&
    isFiniteNumber(buyerLandedCost.totalPayable) &&
    typeof buyerLandedCost.vehicle === "string" &&
    isFiniteNumber(value.distanceKm)
  );
}

type DeliveryEstimate = {
  route: RouteOutput;
  transportTotal: number;
  estimatedTotal: number;
  estimatedSavings: number;
};

export default function RealizationCard({
  listingId,
  offerPrice,
  quantityKg,
  pickupMode,
}: {
  listingId: string;
  offerPrice: number;
  quantityKg: number;
  pickupMode: "pickup" | "delivery";
}) {
  const [data, setData] = useState<NreQuote | null>(null);
  const [deliveryEstimate, setDeliveryEstimate] =
    useState<DeliveryEstimate | null>(null);
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
          `/api/nre/quote?listingId=${listingId}&offerPrice=${offerPrice}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Could not compute quote");
        const json: unknown = await res.json();
        if (!isNreQuote(json)) {
          throw new Error(
            "The quote response is outdated or incomplete. Refresh the page, and restart the development server if the problem continues."
          );
        }
        if (!cancelled) setData(json);
        if (pickupMode === "delivery") {
          const route = await optimizeRoute({
            farmLat: json.routeCoordinates.farm.lat,
            farmLng: json.routeCoordinates.farm.lng,
            buyerLat: json.routeCoordinates.buyer.lat,
            buyerLng: json.routeCoordinates.buyer.lng,
            weightKg: quantityKg,
          });
          if (!cancelled) {
            const transportTotal = Number(
              (route.costPerKg * quantityKg).toFixed(2)
            );
            const buyerBase =
              json.buyerLandedCost.totalPayable -
              json.buyerLandedCost.transportCost;
            setDeliveryEstimate({
              route,
              transportTotal,
              estimatedTotal: Number((buyerBase + transportTotal).toFixed(2)),
              estimatedSavings: Number(
                (json.buyerLandedCost.transportCost - transportTotal).toFixed(2)
              ),
            });
          }
        }
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
  }, [listingId, offerPrice, pickupMode, quantityKg]);

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

  if (error) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-[#FFCDD2] bg-[#FFF5F5] p-4 text-sm text-[#C62828]"
      >
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { realization: r, mandiBenchmark, deltaVsMandi } = data;
  const positiveDelta = deltaVsMandi !== null && deltaVsMandi > 0;

  return (
    <div className="rounded-2xl border border-[#C8E6C9] bg-[#EAF5EE] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
          Net Realization
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#1B4D3E]">
          {data.distanceKm} km to buyer
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
          label="− Farmer platform fee"
          value={`−₹${r.breakdownPerKg.farmerFeePerKg.toFixed(2)}/kg`}
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
        {r.breakdownPerKg.qualityPerKg > 0 && (
          <Row
            label="− Quality deduction"
            value={`−₹${r.breakdownPerKg.qualityPerKg.toFixed(2)}/kg`}
            muted
          />
        )}
      </div>

      {pickupMode === "pickup" ? (
        <div className="mt-4 rounded-xl border border-[#C8E6C9] bg-white p-3 text-xs text-[#1B4D3E]">
          Buyer pickup selected. No delivery cost is included.
        </div>
      ) : deliveryEstimate ? (
        <div className="mt-4 rounded-xl border border-[#C8E6C9] bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7A74]">
            {deliveryEstimate.route.source === "ai" ? "Route AI" : "Mock route fallback"}
            {" · "}{deliveryEstimate.route.vehicle} ·{" "}
            {deliveryEstimate.route.distanceKm.toFixed(1)} km
          </p>
          <p className="mt-1 text-xs text-[#6B7A74]">
            Estimated buyer-paid transport: ₹
            {deliveryEstimate.transportTotal.toLocaleString("en-IN")}
            {" · "}{deliveryEstimate.route.etaMin} min
          </p>
          <p className="mt-1 text-xs font-semibold text-[#1B4D3E]">
            Total including negotiated crop price, buyer fees, and delivery: ₹
            {deliveryEstimate.estimatedTotal.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-[#6B7A74]">
            {deliveryEstimate.estimatedSavings >= 0
              ? `Estimated delivery saving: ₹${deliveryEstimate.estimatedSavings.toLocaleString("en-IN")} vs standard route`
              : `Route estimate is ₹${Math.abs(deliveryEstimate.estimatedSavings).toLocaleString("en-IN")} above standard delivery`}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#C8E6C9] bg-white p-3 text-xs text-[#6B7A74]">
          <ButtonSpinner size={14} />
          Optimizing delivery route…
        </div>
      )}

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