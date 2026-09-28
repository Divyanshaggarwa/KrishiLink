"use client";

import { useActionState, useState } from "react";
import {
  approveVerificationAction,
  rejectVerificationAction,
  type VerificationActionState,
} from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

const INITIAL: VerificationActionState = { ok: false };

type User = {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  krishilink_id: string | null;
  district: string | null;
  state: string | null;
  business_name: string | null;
  pds_center_id: string | null;
  gst_number: string | null;
  verification_submitted_at: string | null;
};

export default function VerificationList({ users }: { users: User[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-[24px] border border-[#A5D6A7] bg-[#EAF5EE] p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#2E7D32] text-2xl text-white">
          ✓
        </div>
        <h3 className="font-display mt-4 text-lg font-bold text-[#1B4D3E]">
          All caught up
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#1B4D3E]/80">
          No accounts are awaiting verification right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {users.map((u) => (
        <VerificationCard key={u.id} user={u} />
      ))}
    </div>
  );
}

function VerificationCard({ user }: { user: User }) {
  const [approveState, approveAction, approvePending] = useActionState<
    VerificationActionState,
    FormData
  >(approveVerificationAction, INITIAL);

  const [rejectState, rejectAction, rejectPending] = useActionState<
    VerificationActionState,
    FormData
  >(rejectVerificationAction, INITIAL);

  const [reason, setReason] = useState("");

  const roleLabel: Record<string, string> = {
    farmer: "Farmer",
    buyer: "Buyer / FPO",
    pds_operator: "PDS Operator",
  };

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E4EBE6] bg-[#FAFCFA] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF5EE] text-base font-bold text-[#1B4D3E]">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-bold text-[#0F1F1A]">
                {user.full_name}
              </p>
              <span className="rounded-full bg-[#EAF5EE] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2E7D32]">
                {roleLabel[user.role] ?? user.role}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#6B7A74]">
              Submitted{" "}
              {user.verification_submitted_at
                ? new Date(user.verification_submitted_at).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short", year: "numeric" }
                  )
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid gap-4 p-6 md:grid-cols-3 lg:grid-cols-4">
        <Detail label="KrishiLink ID" value={user.krishilink_id ?? "—"} mono />
        <Detail label="Phone" value={user.phone ?? "—"} />
        <Detail
          label="Location"
          value={
            user.district
              ? `${user.district}${user.state ? `, ${user.state}` : ""}`
              : "—"
          }
        />
        {user.role === "buyer" && (
          <>
            <Detail label="Business" value={user.business_name ?? "—"} />
            <Detail label="GST" value={user.gst_number ?? "—"} mono />
          </>
        )}
        {user.role === "pds_operator" && (
          <Detail label="PDS Centre" value={user.pds_center_id ?? "—"} mono />
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E4EBE6] bg-[#FAFCFA] p-4">
        <form
          action={rejectAction}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="userId" value={user.id} />
          <input
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (min 5 chars)"
            className="w-64 rounded-full border border-[#E4EBE6] bg-white px-4 py-2 text-xs outline-none focus:border-[#C62828]"
          />
          <button
            type="submit"
            disabled={rejectPending || reason.trim().length < 5}
            className="flex items-center gap-2 rounded-full border border-[#C62828] px-4 py-2 text-xs font-medium text-[#C62828] transition-colors hover:bg-[#FFF5F5] disabled:opacity-50"
          >
            {rejectPending ? <ButtonSpinner size={12} /> : null}
            Reject
          </button>
        </form>
        <form action={approveAction}>
          <input type="hidden" name="userId" value={user.id} />
          <button
            type="submit"
            disabled={approvePending}
            className="flex items-center gap-2 rounded-full bg-[#1B4D3E] px-5 py-2.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03] disabled:opacity-60"
          >
            {approvePending ? (
              <>
                <ButtonSpinner size={12} /> Approving…
              </>
            ) : (
              "✓ Approve"
            )}
          </button>
        </form>
      </div>

      {approveState.error && (
        <p className="px-6 pb-3 text-right text-[11px] text-[#C62828]">
          {approveState.error}
        </p>
      )}
      {rejectState.error && (
        <p className="px-6 pb-3 text-right text-[11px] text-[#C62828]">
          {rejectState.error}
        </p>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-semibold text-[#0F1F1A] ${
          mono ? "font-mono tracking-wide" : ""
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}