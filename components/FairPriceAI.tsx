"use client";

import { useEffect, useState } from "react";
import type { FairPrice, Listing } from "@/lib/fairPrice/engine";

type FairPriceCardProps = {
  crop: string;
  grade?: string;
  askingPrice?: number;
};

export function FairPriceCard({
  crop,
  grade,
  askingPrice,
}: FairPriceCardProps) {
  const [grades, setGrades] = useState<FairPrice[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!crop.trim()) {
      setGrades(null);
      setUnavailable(false);
      return;
    }

    const controller = new AbortController();
    setGrades(null);
    setUnavailable(false);
    fetch(`/api/fair-price?crop=${encodeURIComponent(crop)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error("Fair price data could not be loaded.");
        }
        return response.json() as Promise<{ grades: FairPrice[] }>;
      })
      .then((data) => {
        if (data) setGrades(data.grades);
        else setUnavailable(true);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setUnavailable(true);
      });

    return () => controller.abort();
  }, [crop]);

  if (!crop.trim() || unavailable) return null;
  if (!grades) {
    return (
      <p className="mt-3 text-xs text-[#6B7A74]" aria-live="polite">
        Loading historical fair-price reference…
      </p>
    );
  }

  const selectedGrade = grade?.toUpperCase();
  const visibleGrades = selectedGrade
    ? grades.filter((item) => item.grade === selectedGrade)
    : grades;
  if (visibleGrades.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[#C8E6C9] bg-[#F5FAF6] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1B4D3E]">
        Fair Price AI · Historical Agra market sample
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {visibleGrades.map((item) => {
          const isSelectedGrade = item.grade === selectedGrade;
          const warning =
            isSelectedGrade && askingPrice !== undefined && Number.isFinite(askingPrice)
              ? askingPrice > item.high
                ? "Above fair range"
                : askingPrice < item.low
                  ? "Below fair range"
                  : "Within fair range"
              : null;

          return (
            <div
              key={item.grade}
              className="rounded-xl border border-[#E4EBE6] bg-white p-3"
            >
              <p className="text-xs font-semibold text-[#6B7A74]">
                Grade {item.grade}
              </p>
              <p className="mt-1 text-xl font-extrabold text-[#1B4D3E]">
                ₹{item.fairPrice.toFixed(2)}
                <span className="ml-1 text-xs font-medium text-[#6B7A74]">
                  /kg
                </span>
              </p>
              <p className="text-xs text-[#6B7A74]">
                Range ₹{item.low.toFixed(2)}–₹{item.high.toFixed(2)}/kg
              </p>
              {warning && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    warning === "Within fair range"
                      ? "text-[#2E7D32]"
                      : "text-[#C62828]"
                  }`}
                >
                  Your asking price is {warning.toLowerCase()}.
                </p>
              )}
              <p className="mt-2 text-[10px] leading-4 text-[#6B7A74]">
                {item.flags.includes("estimated_from_grade_A")
                  ? "Estimated from Grade A. "
                  : ""}
                {item.flags.includes("stale_data")
                  ? "Data is older than 7 days. "
                  : ""}
                {item.dataPoints} records · latest {item.lastDataDate} ·{" "}
                {item.confidence} confidence
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-[#6B7A74]">
        Indicative Agra sample for onion, potato and tomato; it is not a live
        market feed.
      </p>
    </div>
  );
}

type RecommendationState =
  | { status: "idle" | "loading" }
  | { status: "ready"; reason: string }
  | { status: "error" };

export function BestBuyBox({ listings }: { listings: Listing[] }) {
  const [recommendation, setRecommendation] = useState<RecommendationState>({
    status: "idle",
  });
  const requestBody = JSON.stringify({ listings });

  useEffect(() => {
    if (!listings.length) {
      setRecommendation({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setRecommendation({ status: "loading" });
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Buyer recommendation could not be loaded.");
        }
        return (await response.json()) as { reason: string };
      })
      .then((data) => setRecommendation({ status: "ready", reason: data.reason }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setRecommendation({ status: "error" });
      });

    return () => controller.abort();
  }, [requestBody]);

  if (recommendation.status === "idle") return null;

  return (
    <div
      className="mb-6 rounded-2xl border border-[#C8E6C9] bg-[#EAF5EE] p-4 text-sm text-[#1B4D3E]"
      aria-live="polite"
    >
      <span className="font-semibold">Fair Price AI recommendation: </span>
      {recommendation.status === "loading"
        ? "Comparing asking prices, configured delivery estimates and quality…"
        : recommendation.status === "ready"
          ? recommendation.reason
          : "Unavailable right now. You can still browse and compare all listings."}
      <p className="mt-1 text-[11px] text-[#6B7A74]">
        Advisory only; the listing order is unchanged. Recommendations use
        estimated delivery costs and historical crop prices where available.
      </p>
    </div>
  );
}
