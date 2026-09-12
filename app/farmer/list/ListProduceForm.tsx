"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { createListingAction, type ListingState } from "./actions";
import { predictFairPrice, predictQuality } from "@/lib/ai";

type Profile = {
  id: string;
  full_name: string;
  district: string | null;
  state: string | null;
  pincode: string | null;
};

export default function ListProduceForm({ profile }: { profile: Profile }) {
  const [state, formAction, isPending] = useActionState<ListingState, FormData>(
    createListingAction,
    null
  );

  // Form state
  const [crop, setCrop] = useState("");
  const [variety, setVariety] = useState("");
  const [quantity, setQuantity] = useState("");
  const [grade, setGrade] = useState<"A" | "B" | "C" | "">("");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [district, setDistrict] = useState(profile.district || "");
  const [stateName, setStateName] = useState(profile.state || "");
  const [pincode, setPincode] = useState(profile.pincode || "");

  // Photo + AI state
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [qualitySource, setQualitySource] = useState<"ai" | "mock" | null>(null);
  const [qualityConfidence, setQualityConfidence] = useState<number | null>(null);
  const [fairLow, setFairLow] = useState<number | null>(null);
  const [fairHigh, setFairHigh] = useState<number | null>(null);
  const [fairFactors, setFairFactors] = useState<string[]>([]);
  const [priceSource, setPriceSource] = useState<"ai" | "mock" | null>(null);

  // Photo preview + auto AI quality grading
  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result).split(",")[1] || "";
      setAiBusy(true);
      try {
        const result = await predictQuality(base64);
        setGrade(result.grade);
        setQualityConfidence(result.confidence);
        setQualitySource(result.source);
      } finally {
        setAiBusy(false);
      }
    };
    reader.readAsDataURL(photo);

    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Fair price suggestion — runs when crop + grade + quantity + district are set
  useEffect(() => {
    const qty = Number(quantity);
    if (!crop || !grade || !qty || qty <= 0 || !district) {
      setFairLow(null);
      setFairHigh(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await predictFairPrice({
        crop,
        quality: grade,
        quantityKg: qty,
        district,
        month: new Date().getMonth() + 1,
      });
      if (cancelled) return;
      setFairLow(result.low);
      setFairHigh(result.high);
      setFairFactors(result.factors);
      setPriceSource(result.source);
      // Pre-fill expected price if empty
      if (!expectedPrice) {
        setExpectedPrice(result.mid.toFixed(2));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop, grade, quantity, district]);

  return (
    <form action={formAction} className="space-y-8">
      {/* HIDDEN FIELDS (controlled inputs must sync to native name=) */}
      <input type="hidden" name="fair_price_low" value={fairLow ?? ""} />
      <input type="hidden" name="fair_price_high" value={fairHigh ?? ""} />
      <input
        type="hidden"
        name="quality_confidence"
        value={qualityConfidence ?? ""}
      />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* ============ LEFT COLUMN ============ */}
        <div className="space-y-6">
          <Section title="Crop details">
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Crop name"
                name="crop"
                required
                value={crop}
                onChange={setCrop}
                placeholder="e.g. Tomato"
              />
              <Field
                label="Variety (optional)"
                name="variety"
                value={variety}
                onChange={setVariety}
                placeholder="e.g. Hybrid PKM-1"
              />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Quantity (kg)"
                name="quantity_kg"
                type="number"
                required
                value={quantity}
                onChange={setQuantity}
                placeholder="e.g. 500"
              />
              <Field
                label="Harvest date"
                name="harvest_date"
                type="date"
                value={harvestDate}
                onChange={setHarvestDate}
              />
            </div>
          </Section>

          <Section title="Quality">
            <div>
              <label className="text-xs font-medium text-[#0F1F1A]">
                Quality grade <span className="text-[#C62828]">*</span>
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["A", "B", "C"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      grade === g
                        ? "border-[#1B4D3E] bg-[#1B4D3E] text-white"
                        : "border-[#E4EBE6] bg-white text-[#6B7A74] hover:border-[#2E7D32]"
                    }`}
                  >
                    Grade {g}
                  </button>
                ))}
              </div>
              <input type="hidden" name="quality_grade" value={grade} />

              {qualityConfidence !== null && (
                <p className="mt-2 text-xs text-[#6B7A74]">
                  AI confidence:{" "}
                  <span className="font-medium text-[#1B4D3E]">
                    {(qualityConfidence * 100).toFixed(0)}%
                  </span>
                  {qualitySource === "mock" && (
                    <span className="ml-2 rounded-full bg-[#FFF5F5] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#C62828]">
                      Prototype
                    </span>
                  )}
                </p>
              )}
            </div>
          </Section>

          <Section title="Pricing">
            <Field
              label="Expected price (₹/kg)"
              name="expected_price_per_kg"
              type="number"
              required
              value={expectedPrice}
              onChange={setExpectedPrice}
              placeholder="e.g. 24"
            />

            {fairLow !== null && fairHigh !== null && (
              <div className="rounded-2xl border border-[#C8E6C9] bg-[#EAF5EE] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
                    Fair Price AI
                  </p>
                  {priceSource === "mock" && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#C62828]">
                      Indicative
                    </span>
                  )}
                </div>
                <p className="font-display mt-2 text-2xl font-extrabold text-[#1B4D3E]">
                  ₹{fairLow.toFixed(2)} – ₹{fairHigh.toFixed(2)}
                  <span className="ml-1 text-sm font-medium text-[#6B7A74]">
                    /kg
                  </span>
                </p>
                <ul className="mt-3 space-y-1 text-[11px] text-[#1B4D3E]/80">
                  {fairFactors.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <div className="space-y-6">
          <Section title="Photo">
            <label
              htmlFor="photo-input"
              className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#C8E6C9] bg-[#FAFCFA] p-6 text-center transition-colors hover:border-[#2E7D32]"
            >
              {previewUrl ? (
                <div className="relative h-48 w-full overflow-hidden rounded-xl">
                  <Image
                    src={previewUrl}
                    alt="Produce preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#1B4D3E]">
                    Upload produce photo
                  </p>
                  <p className="mt-1 text-xs text-[#6B7A74]">
                    JPG, PNG, or WebP · max 5 MB
                  </p>
                </>
              )}
              <input
                id="photo-input"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
            {photo && (
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setGrade("");
                  setQualityConfidence(null);
                }}
                className="text-xs text-[#C62828] hover:underline"
              >
                Remove photo
              </button>
            )}
            {aiBusy && (
              <p className="text-xs text-[#6B7A74]">
                Analyzing quality…
              </p>
            )}
          </Section>

          <Section title="Location">
            <Field
              label="District"
              name="district"
              required
              value={district}
              onChange={setDistrict}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="State"
                name="state"
                required
                value={stateName}
                onChange={setStateName}
              />
              <Field
                label="PIN code"
                name="pincode"
                value={pincode}
                onChange={setPincode}
                maxLength={6}
              />
            </div>
          </Section>
        </div>
      </div>

      {state?.error && (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          {state.error}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-[#E4EBE6] pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-[#1B4D3E] px-8 py-3.5 text-sm font-medium text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {isPending ? "Publishing…" : "Publish listing"}
        </button>
      </div>
    </form>
  );
}

/* ============== SMALL HELPERS ============== */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
        {title}
      </p>
      <div className="mt-4 space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-[#0F1F1A]">
        {label} {required && <span className="text-[#C62828]">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        maxLength={maxLength}
        className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#EAF5EE]"
      />
    </div>
  );
}