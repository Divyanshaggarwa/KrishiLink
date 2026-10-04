"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { createListingAction, type ListingState } from "./actions";
import { predictQuality } from "@/lib/ai/client";
import { isRoboflowSupported } from "@/lib/ai/roboflow";
import { createClient } from "@/lib/supabase/client";
import ButtonSpinner from "@/components/ButtonSpinner";

type Profile = {
  id: string;
  full_name: string;
  district: string | null;
  state: string | null;
  pincode: string | null;
};

type AiStatus =
  | { kind: "idle" }
  | { kind: "unsupported"; crop: string }
  | { kind: "uploading" }
  | { kind: "analyzing" }
  | { kind: "done"; grade: "A" | "B" | "C"; confidence: number }
  | { kind: "failed"; reason: string };

export default function ListProduceForm({ profile }: { profile: Profile }) {
  const [state, formAction, isPending] = useActionState<ListingState, FormData>(
    createListingAction,
    null
  );

  /* ---------------- Form state ---------------- */
  const [crop, setCrop] = useState("");
  const [variety, setVariety] = useState("");
  const [quantity, setQuantity] = useState("");
  const [grade, setGrade] = useState<"A" | "B" | "C" | "">("");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [district, setDistrict] = useState(profile.district || "");
  const [stateName, setStateName] = useState(profile.state || "");
  const [pincode, setPincode] = useState(profile.pincode || "");

  /* ---------------- Photo + AI state ---------------- */
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [publicPhotoUrl, setPublicPhotoUrl] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>({ kind: "idle" });

  /* ---------------- Upload photo + run AI ---------------- */
  const analyzePhoto = useCallback(
    async (file: File, cropName: string) => {
      // Step 1: Upload to Supabase Storage
      setAiStatus({ kind: "uploading" });

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAiStatus({ kind: "failed", reason: "Not signed in" });
        return;
      }

      const ext = file.name.split(".").pop() || "jpg";
      const filename = `temp/${user.id}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("listing-photos")
        .upload(filename, file, { upsert: false, contentType: file.type });

      if (upErr) {
        console.warn("[ai] upload failed:", upErr.message);
        setAiStatus({ kind: "failed", reason: "Photo upload failed" });
        return;
      }

      const { data: urlData } = supabase.storage
        .from("listing-photos")
        .getPublicUrl(filename);

      const url = urlData.publicUrl;
      setPublicPhotoUrl(url);

      // Step 2: Check if crop is supported by Roboflow
      if (!cropName || !isRoboflowSupported(cropName)) {
        setAiStatus({ kind: "unsupported", crop: cropName || "this crop" });
        return;
      }

      // Step 3: Read base64 (for fallback mock)
      setAiStatus({ kind: "analyzing" });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = String(reader.result).split(",")[1] || "";
        try {
          const result = await predictQuality(base64, cropName, url);
          setGrade(result.grade);
          setAiStatus({
            kind: "done",
            grade: result.grade,
            confidence: result.confidence,
          });
        } catch (err) {
          console.warn("[ai] analysis failed:", err);
          setAiStatus({ kind: "failed", reason: "Analysis failed" });
        }
      };
      reader.readAsDataURL(file);
    },
    []
  );

  /* ---------------- Photo selection handler ---------------- */
  function handlePhotoChange(file: File | null) {
    setPhoto(file);
    setPublicPhotoUrl(null);
    setAiStatus({ kind: "idle" });

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Auto-run analysis if crop already selected
    void analyzePhoto(file, crop);
  }

  /* ---------------- Re-run AI when crop changes ---------------- */
  useEffect(() => {
    if (!photo) return;

    // Only re-run for supported crops
    if (crop && isRoboflowSupported(crop)) {
      // Avoid double-run right after photo upload
      if (aiStatus.kind === "idle" || aiStatus.kind === "unsupported") {
        void analyzePhoto(photo, crop);
      }
    } else if (crop && !isRoboflowSupported(crop)) {
      setAiStatus({ kind: "unsupported", crop });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop]);

  /* ---------------- Cleanup preview URL ---------------- */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /* ---------------- Render ---------------- */
  return (
    <form action={formAction} className="space-y-8">
      <input
        type="hidden"
        name="photo_url"
        value={publicPhotoUrl ?? ""}
      />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* ================= LEFT: CROP + QUALITY + PRICE ================= */}
        <div className="space-y-6">
          <Section title="Crop details">
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Crop name"
                name="crop"
                required
                value={crop}
                onChange={setCrop}
                placeholder="e.g. Onion, Tomato, Potato"
              />
              <Field
                label="Variety (optional)"
                name="variety"
                value={variety}
                onChange={setVariety}
                placeholder="e.g. Nashik Red"
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

              {/* AI status line */}
              <AiStatusLine status={aiStatus} />
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

        {/* ================= RIGHT: PHOTO + LOCATION ================= */}
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
                onChange={(e) =>
                  handlePhotoChange(e.target.files?.[0] ?? null)
                }
              />
            </label>

            {photo && (
              <button
                type="button"
                onClick={() => handlePhotoChange(null)}
                className="text-xs text-[#C62828] hover:underline"
              >
                Remove photo
              </button>
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
          className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-8 py-3.5 text-sm font-medium text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {isPending ? (
            <>
              <ButtonSpinner size={14} /> Publishing…
            </>
          ) : (
            "Publish listing"
          )}
        </button>
      </div>
    </form>
  );
}

/* ===================== AI STATUS LINE ===================== */

function AiStatusLine({ status }: { status: AiStatus }) {
  if (status.kind === "idle") return null;

  if (status.kind === "uploading") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[#6B7A74]">
        <ButtonSpinner size={12} /> Uploading photo…
      </p>
    );
  }

  if (status.kind === "analyzing") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[#6B7A74]">
        <ButtonSpinner size={12} /> AI analyzing quality…
      </p>
    );
  }

  if (status.kind === "unsupported") {
    return (
      <p className="mt-2 rounded-lg bg-[#FFF8E1] px-3 py-2 text-[11px] text-[#B26A00]">
        ⓘ Quality AI currently supports <strong>Onion</strong> and{" "}
        <strong>Potato</strong>. Please choose grade manually for{" "}
        {status.crop}.
      </p>
    );
  }

  if (status.kind === "done") {
    const pct = Math.round(status.confidence * 100);
    return (
      <p className="mt-2 rounded-lg bg-[#EAF5EE] px-3 py-2 text-[11px] font-medium text-[#2E7D32]">
        ✓ AI graded this <strong>Grade {status.grade}</strong> · {pct}%
        confidence
      </p>
    );
  }

  if (status.kind === "failed") {
    return (
      <p className="mt-2 rounded-lg bg-[#FFF5F5] px-3 py-2 text-[11px] text-[#C62828]">
        ⚠ {status.reason}. Please select grade manually.
      </p>
    );
  }

  return null;
}

/* ===================== HELPERS ===================== */

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