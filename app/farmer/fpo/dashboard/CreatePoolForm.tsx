"use client";

import { useState } from "react";
import ButtonSpinner from "@/components/ButtonSpinner";
import { createPoolAction } from "./actions";

type Member = {
  id: string;
  member_name: string | null;
  member_krishilink_id: string | null;
  member_id: string;
};

export default function CreatePoolForm({
  members,
  headId,
  headName,
  headKlid,
}: {
  members: Member[];
  headId: string;
  headName: string;
  headKlid: string | null;
}) {
  const [crop, setCrop] = useState("");
  const [total, setTotal] = useState("");
  const [grade, setGrade] = useState<"A" | "B" | "C">("A");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [headContribution, setHeadContribution] = useState("");
  const [contribs, setContribs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const totalNum = Number(total) || 0;
  const headQty = Number(headContribution) || 0;
  const sumContrib =
    members.reduce((s, m) => s + (Number(contribs[m.member_id]) || 0), 0) +
    headQty;
  const diff = totalNum - sumContrib;

  async function submit() {
    setError(null);
    setBusy(true);

    const allContribs: { memberId: string; quantityKg: number }[] = [];
    if (headQty > 0) {
      allContribs.push({ memberId: headId, quantityKg: headQty });
    }
    members.forEach((m) => {
      const qty = Number(contribs[m.member_id]) || 0;
      if (qty > 0) {
        allContribs.push({ memberId: m.member_id, quantityKg: qty });
      }
    });

    const res = await createPoolAction({
      crop,
      totalQuantityKg: totalNum,
      qualityGrade: grade,
      expectedPricePerKg: Number(price),
      notes,
      contributions: allContribs,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not create pool");
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="rounded-[24px] border border-[#A5D6A7] bg-[#EAF5EE] p-6 text-center">
        <p className="text-3xl">✓</p>
        <p className="font-display mt-2 text-lg font-bold text-[#1B4D3E]">
          Pool created
        </p>
        <p className="mt-1 text-sm text-[#1B4D3E]/80">
          Members have been notified. Buyers can now see this pool.
        </p>
        <button
          onClick={() => {
            setSuccess(false);
            setCrop("");
            setTotal("");
            setPrice("");
            setNotes("");
            setContribs({});
            setHeadContribution("");
          }}
          className="mt-4 rounded-full bg-[#1B4D3E] px-5 py-2 text-xs font-semibold text-white"
        >
          Create another pool
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
        <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
          Pool details
        </h3>
        <p className="mt-1 text-xs text-[#6B7A74]">
          Aggregate crops from your members into one listing.
        </p>

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
              Total quantity (kg) <span className="text-[#C62828]">*</span>
            </label>
            <input
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              type="number"
              placeholder="e.g. 2000"
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
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                    grade === g
                      ? "border-[#1B4D3E] bg-[#1B4D3E] text-white"
                      : "border-[#E4EBE6] bg-white text-[#6B7A74]"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#0F1F1A]">
              Expected price (₹/kg) <span className="text-[#C62828]">*</span>
            </label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              placeholder="e.g. 25"
              className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="text-xs font-medium text-[#0F1F1A]">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Harvested this week, ready for pickup"
            className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-2.5 text-sm outline-none focus:border-[#2E7D32]"
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              Who is contributing?
            </h3>
            <p className="mt-1 text-xs text-[#6B7A74]">
              Assign each member&apos;s share. Total must match the pool
              quantity.
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              Math.abs(diff) < 0.01
                ? "bg-[#EAF5EE] text-[#2E7D32]"
                : diff > 0
                  ? "bg-[#FFF8E1] text-[#B26A00]"
                  : "bg-[#FFF5F5] text-[#C62828]"
            }`}
          >
            {sumContrib} / {totalNum} kg
            {Math.abs(diff) > 0.01 && (
              <> · {diff > 0 ? `${diff} left` : `${-diff} over`}</>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-[#2E7D32] bg-[#EAF5EE] p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#1B4D3E]">
                {headName}{" "}
                <span className="ml-1 rounded-full bg-[#2E7D32] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  You · FPO head
                </span>
              </p>
              <p className="font-mono text-[10px] text-[#2E7D32]">
                {headKlid ?? "—"}
              </p>
            </div>
            <input
              type="number"
              value={headContribution}
              onChange={(e) => setHeadContribution(e.target.value)}
              placeholder="kg"
              className="w-24 rounded-lg border border-[#A5D6A7] bg-white px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
            />
            <span className="w-16 text-right text-xs text-[#6B7A74]">
              {totalNum > 0 ? ((headQty / totalNum) * 100).toFixed(1) : "0"}%
            </span>
          </div>

          {members.length === 0 ? (
            <p className="rounded-xl bg-[#F8F9FA] p-4 text-sm text-[#6B7A74]">
              No other members yet. You can still create a pool by contributing
              yourself.
            </p>
          ) : (
            members.map((m) => {
              const val = contribs[m.member_id] ?? "";
              const qty = Number(val) || 0;
              const share =
                totalNum > 0 ? ((qty / totalNum) * 100).toFixed(1) : "0";
              return (
                <div
                  key={m.member_id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E4EBE6] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.member_name ?? "Member"}
                    </p>
                    <p className="font-mono text-[10px] text-[#6B7A74]">
                      {m.member_krishilink_id ?? "—"}
                    </p>
                  </div>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) =>
                      setContribs((p) => ({
                        ...p,
                        [m.member_id]: e.target.value,
                      }))
                    }
                    placeholder="kg"
                    className="w-24 rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
                  />
                  <span className="w-16 text-right text-xs text-[#6B7A74]">
                    {share}%
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={busy || totalNum <= 0 || Math.abs(diff) > 0.01}
          className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-8 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <ButtonSpinner size={14} /> Creating…
            </>
          ) : (
            "Create pooled listing"
          )}
        </button>
      </div>
    </div>
  );
}