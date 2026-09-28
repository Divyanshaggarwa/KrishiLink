"use client";

import { useState } from "react";
import Link from "next/link";
import ButtonSpinner from "@/components/ButtonSpinner";
import {
  lookupFarmerByKlid,
  pdsCreateListing,
} from "./actions";

type Farmer = {
  id: string;
  full_name: string;
  krishilink_id: string;
  district: string | null;
  state: string | null;
};

export default function AssistForm() {
  const [step, setStep] = useState<"lookup" | "list">("lookup");
  const [klid, setKlid] = useState("");
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [crop, setCrop] = useState("");
  const [quantity, setQuantity] = useState("");
  const [grade, setGrade] = useState<"A" | "B" | "C">("A");
  const [price, setPrice] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLookup() {
    setLookupError(null);
    const digits = klid.replace(/\D/g, "");
    if (digits.length !== 6) {
      setLookupError("Enter 6 digits after KL-");
      return;
    }
    setLookupBusy(true);
    const res = await lookupFarmerByKlid(digits);
    setLookupBusy(false);
    if (!res.ok) {
      setLookupError(res.error);
      return;
    }
    setFarmer(res.farmer);
    setStep("list");
  }

  async function handleSubmit() {
    if (!farmer) return;
    setSubmitError(null);
    setSubmitBusy(true);
    const res = await pdsCreateListing({
      farmerId: farmer.id,
      crop,
      quantityKg: Number(quantity),
      grade,
      expectedPricePerKg: Number(price),
      harvestDate: harvestDate || undefined,
      notes: notes || undefined,
    });
    setSubmitBusy(false);
    if (!res.ok) {
      setSubmitError(res.error);
      return;
    }
    setSuccess(res.listingId);
  }

  function reset() {
    setStep("lookup");
    setKlid("");
    setFarmer(null);
    setCrop("");
    setQuantity("");
    setGrade("A");
    setPrice("");
    setHarvestDate("");
    setNotes("");
    setSuccess(null);
    setSubmitError(null);
    setLookupError(null);
  }

  if (success) {
    return (
      <div className="rounded-[24px] border border-[#A5D6A7] bg-[#EAF5EE] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#2E7D32] text-2xl text-white">
          ✓
        </div>
        <h3 className="font-display mt-4 text-xl font-bold text-[#1B4D3E]">
          Listing created for {farmer?.full_name}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#1B4D3E]/80">
          The farmer has been notified. The crop is now visible to buyers.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Assist another farmer
          </button>
          <Link
            href="/pds-operator/farmers"
            className="rounded-full border border-[#1B4D3E] px-6 py-3 text-sm font-semibold text-[#1B4D3E]"
          >
            View assisted farmers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {step === "lookup" && (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
          <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
            Step 1 · Identify the farmer
          </h3>
          <p className="mt-1 text-xs text-[#6B7A74]">
            Enter the farmer&apos;s KrishiLink ID to verify their account.
          </p>

          <div className="mt-5">
            <label className="text-xs font-medium text-[#0F1F1A]">
              KrishiLink ID
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6B7A74]">
                  KL-
                </span>
                <input
                  value={klid}
                  onChange={(e) =>
                    setKlid(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  placeholder="XXXXXX"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-xl border border-[#E4EBE6] py-3 pl-12 pr-4 text-sm tracking-[0.2em] outline-none focus:border-[#2E7D32]"
                />
              </div>
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookupBusy || klid.length !== 6}
                className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {lookupBusy ? (
                  <>
                    <ButtonSpinner size={14} /> Looking up…
                  </>
                ) : (
                  "Verify"
                )}
              </button>
            </div>
            {lookupError && (
              <p className="mt-2 text-xs text-[#C62828]">{lookupError}</p>
            )}
          </div>
        </div>
      )}

      {step === "list" && farmer && (
        <>
          <div className="rounded-[24px] border border-[#A5D6A7] bg-[#EAF5EE] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2E7D32] text-base font-bold text-white">
                  {farmer.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-display text-base font-bold text-[#1B4D3E]">
                    {farmer.full_name}
                  </p>
                  <p className="mt-0.5 text-xs text-[#1B4D3E]/70">
                    {farmer.krishilink_id}
                    {farmer.district && ` · ${farmer.district}`}
                    {farmer.state && `, ${farmer.state}`}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#2E7D32] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                ✓ Verified farmer
              </span>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              Step 2 · Crop details
            </h3>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[#0F1F1A]">
                  Crop <span className="text-[#C62828]">*</span>
                </label>
                <input
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  placeholder="e.g. Tomato"
                  className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#0F1F1A]">
                  Quantity (kg) <span className="text-[#C62828]">*</span>
                </label>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  type="number"
                  placeholder="e.g. 500"
                  className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#0F1F1A]">
                  Quality grade
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(["A", "B", "C"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        grade === g
                          ? "border-[#1B4D3E] bg-[#1B4D3E] text-white"
                          : "border-[#E4EBE6] bg-white text-[#6B7A74] hover:border-[#2E7D32]"
                      }`}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#0F1F1A]">
                  Expected price (₹/kg){" "}
                  <span className="text-[#C62828]">*</span>
                </label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  placeholder="e.g. 25"
                  className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#0F1F1A]">
                  Harvest date (optional)
                </label>
                <input
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  type="date"
                  className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#0F1F1A]">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Freshly harvested, ready for pickup"
                  className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
                />
              </div>
            </div>

            {submitError && (
              <p className="mt-4 rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-xs text-[#C62828]">
                {submitError}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[#E4EBE6] pt-5">
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-[#E4EBE6] px-6 py-3 text-sm font-medium text-[#6B7A74]"
              >
                Change farmer
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitBusy || !crop || !quantity || !price}
                className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-8 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {submitBusy ? (
                  <>
                    <ButtonSpinner size={14} /> Creating…
                  </>
                ) : (
                  "Create listing"
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}