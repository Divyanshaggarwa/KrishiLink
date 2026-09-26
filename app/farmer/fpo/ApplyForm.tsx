"use client";

import { useState } from "react";
import ButtonSpinner from "@/components/ButtonSpinner";
import { applyForFpo } from "./actions";

export default function ApplyForm() {
  const [fpoName, setFpoName] = useState("");
  const [fpoRegion, setFpoRegion] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function updateMember(i: number, v: string) {
    setMemberIds((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  function addMember() {
    if (memberIds.length >= 200) return;
    setMemberIds((prev) => [...prev, ""]);
  }

  function removeMember(i: number) {
    if (memberIds.length <= 2) return;
    setMemberIds((prev) => prev.filter((_, idx) => idx !== i));
  }

  function normalizeId(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    return digits.length === 6 ? `KL-${digits}` : digits;
  }

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await applyForFpo({
      fpoName,
      fpoRegion,
      members: memberIds.map((id) => ({ krishilink_id: id })),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="rounded-[24px] border border-[#A5D6A7] bg-[#EAF5EE] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#2E7D32] text-2xl text-white">
          ✓
        </div>
        <h3 className="font-display mt-4 text-xl font-bold text-[#1B4D3E]">
          Application submitted
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#1B4D3E]/80">
          Your FPO application is now under review. Once KrishiLink admin
          approves it, your FPO receives its own FPO-ID (KF-XXXXXX) and every
          member gets notified.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* FPO details */}
      <section className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
        <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
          FPO details
        </h3>
        <p className="mt-1 text-xs text-[#6B7A74]">
          Name and region your members operate in.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <label className="text-xs font-medium text-[#0F1F1A]">
              FPO name <span className="text-[#C62828]">*</span>
            </label>
            <input
              value={fpoName}
              onChange={(e) => setFpoName(e.target.value)}
              placeholder="e.g. Nashik Tomato Growers FPO"
              className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#0F1F1A]">
              Region / area <span className="text-[#C62828]">*</span>
            </label>
            <input
              value={fpoRegion}
              onChange={(e) => setFpoRegion(e.target.value)}
              placeholder="e.g. Nashik, Maharashtra"
              className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
            />
          </div>
        </div>
      </section>

      {/* Members via KrishiLink ID */}
      <section className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              Member farmers
            </h3>
            <p className="mt-1 text-xs text-[#6B7A74]">
              Add members using their KrishiLink ID (KL-XXXXXX). Minimum 2,
              maximum 200. Contact details stay private.
            </p>
          </div>
          <span className="rounded-full bg-[#EAF5EE] px-3 py-1 text-[11px] font-medium text-[#2E7D32]">
            {memberIds.length} member{memberIds.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {memberIds.map((id, i) => {
            const invalid = id.length > 0 && !/^KL-\d{6}$/.test(normalizeId(id));
            return (
              <div
                key={i}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors ${
                  invalid ? "border-[#FFCDD2] bg-[#FFF5F5]" : "border-[#E4EBE6]"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF5EE] text-xs font-bold text-[#1B4D3E]">
                  {i + 1}
                </span>
                <div className="relative min-w-[200px] flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#6B7A74]">
                    KL-
                  </span>
                  <input
                    value={id.replace(/^KL-/, "")}
                    onChange={(e) => updateMember(i, e.target.value)}
                    placeholder="XXXXXX"
                    maxLength={6}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-[#E4EBE6] py-2 pl-10 pr-3 text-sm tracking-[0.2em] outline-none focus:border-[#2E7D32]"
                  />
                </div>
                {memberIds.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-xs text-[#C62828] hover:border-[#C62828]"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addMember}
          className="mt-4 rounded-full border border-dashed border-[#A5D6A7] px-4 py-2 text-xs font-medium text-[#2E7D32] hover:bg-[#EAF5EE]"
        >
          + Add another member
        </button>
      </section>

      {error && (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-8 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {busy ? (
            <>
              <ButtonSpinner size={14} /> Submitting…
            </>
          ) : (
            "Submit FPO application"
          )}
        </button>
      </div>
    </div>
  );
}