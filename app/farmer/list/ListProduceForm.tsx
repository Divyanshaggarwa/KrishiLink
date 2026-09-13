"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { createListingAction, type ListingState } from "./actions";
import { predictQuality } from "@/lib/ai";
import ButtonSpinner from "@/components/ButtonSpinner";
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

  const [crop, setCrop] = useState("");
  const [variety, setVariety] = useState("");
  const [quantity, setQuantity] = useState("");
  const [grade, setGrade] = useState<"A" | "B" | "C" | "">("");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [district, setDistrict] = useState(profile.district || "");
  const [stateName, setStateName] = useState(profile.state || "");
  const [pincode, setPincode] = useState(profile.pincode || "");

  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [qualitySource, setQualitySource] = useState<"ai" | "mock" | null>(null);
  const [qualityConfidence, setQualityConfidence] = useState<number | null>(null);

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

  return (
    <form action={formAction} className="space-y-8">
      <input
        type="hidden"
        name="quality_confidence"
        value={qualityConfidence ?? ""}
      />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
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
              label="Your expected price (₹/kg)"
              name="expected_price_per_kg"
              type="number"
              required
              value={expectedPrice}
              onChange={setExpectedPrice}
              placeholder="e.g. 24"
            />
            <p className="text-[11px] text-[#6B7A74]">
              Fair Price AI will validate this against the buyer&apos;s bid and
              live market data when a buyer places an offer.
            </p>
          </Section>
        </div>

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
              <div className="flex items-center gap-2 text-xs text-[#6B7A74]">
                <ButtonSpinner size={12} />
                Analyzing quality with AI…
              </div>
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
          className="flex items-center justify-center gap-2 rounded-full bg-[#1B4D3E] px-8 py-3.5 text-sm font-medium text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? (
            <>
              <ButtonSpinner />
              Publishing your listing…
            </>
          ) : (
            "Publish listing"
          )}
        </button>
      </div>
    </form>
  );
}

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