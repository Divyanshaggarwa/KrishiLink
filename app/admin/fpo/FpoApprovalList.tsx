"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  approveFpoAction,
  rejectFpoAction,
  type FpoAdminActionState,
} from "./actions";
import ButtonSpinner from "@/components/ButtonSpinner";

type MemberRow = {
  id: string;
  member_name: string | null;
  member_krishilink_id: string | null;
  status: string;
};

type FpoApplication = {
  head_id: string;
  head_name: string;
  head_krishilink_id: string | null;
  head_phone: string | null;
  fpo_name: string | null;
  fpo_region: string | null;
  fpo_member_count: number | null;
  fpo_applied_at: string | null;
  members: MemberRow[];
};

export default function FpoApprovalList({
  applications,
}: {
  applications: FpoApplication[];
}) {
  if (applications.length === 0) {
    return (
      <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
        <p className="text-sm text-[#6B7A74]">
          No pending FPO applications right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {applications.map((app) => (
        <ApplicationCard key={app.head_id} app={app} />
      ))}
    </div>
  );
}

function ApplicationCard({ app }: { app: FpoApplication }) {
  const [approveState, approveFormAction, approvePending] = useActionState<
    FpoAdminActionState,
    FormData
  >(approveFpoAction, null);

  const [rejectState, rejectFormAction, rejectPending] = useActionState<
    FpoAdminActionState,
    FormData
  >(rejectFpoAction, null);

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E4EBE6] bg-[#FAFCFA] px-6 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold text-[#1B4D3E]">
              {app.fpo_name || "Unnamed FPO"}
            </h3>
            <span className="rounded-full bg-[#FFF8E1] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#B26A00]">
              Pending review
            </span>
          </div>
          <p className="mt-1 text-xs text-[#6B7A74]">
            {app.fpo_region} · {app.members.length} member
            {app.members.length === 1 ? "" : "s"} · Applied{" "}
            {app.fpo_applied_at
              ? new Date(app.fpo_applied_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        {/* Left: head details */}
        <div className="space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            FPO head
          </p>
          <div className="rounded-2xl border border-[#E4EBE6] p-4">
            <p className="font-medium text-[#0F1F1A]">{app.head_name}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#6B7A74]">KrishiLink ID</p>
                <p className="mt-0.5 font-mono font-semibold text-[#1B4D3E]">
                  {app.head_krishilink_id ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[#6B7A74]">Phone</p>
                <p className="mt-0.5 font-medium">
                  {app.head_phone ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: members */}
        <div className="space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            Member farmers ({app.members.length})
          </p>
          <div className="max-h-64 overflow-y-auto rounded-2xl border border-[#E4EBE6]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#F8F9FA] text-left text-[10px] uppercase tracking-wider text-[#6B7A74]">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">KrishiLink ID</th>
                </tr>
              </thead>
              <tbody>
                {app.members.map((m) => (
                  <tr key={m.id} className="border-t border-[#E4EBE6]">
                    <td className="px-3 py-2">{m.member_name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[#1B4D3E]">
                      {m.member_krishilink_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-[#E4EBE6] bg-[#FAFCFA] p-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <RejectPanel
            headId={app.head_id}
            rejectState={rejectState}
            rejectFormAction={rejectFormAction}
            rejectPending={rejectPending}
          />
          <form action={approveFormAction}>
            <input type="hidden" name="fpoHeadId" value={app.head_id} />
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
                "✓ Approve FPO"
              )}
            </button>
          </form>
        </div>

        {approveState?.ok === false && (
          <p className="mt-2 text-right text-[11px] text-[#C62828]">
            {approveState.error}
          </p>
        )}
        {rejectState?.ok === false && (
          <p className="mt-2 text-right text-[11px] text-[#C62828]">
            {rejectState.error}
          </p>
        )}
      </div>
    </div>
  );
}

function RejectPanel({
  headId,
  rejectState,
  rejectFormAction,
  rejectPending,
}: {
  headId: string;
  rejectState: FpoAdminActionState;
  rejectFormAction: (formData: FormData) => void;
  rejectPending: boolean;
}) {
  return (
    <form
      action={rejectFormAction}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="fpoHeadId" value={headId} />
      <input
        name="reason"
        placeholder="Reason for rejection"
        className="w-56 rounded-full border border-[#E4EBE6] bg-white px-4 py-2 text-xs outline-none focus:border-[#C62828]"
      />
      <button
        type="submit"
        disabled={rejectPending}
        className="flex items-center gap-2 rounded-full border border-[#C62828] px-4 py-2 text-xs font-medium text-[#C62828] transition-colors hover:bg-[#FFF5F5] disabled:opacity-60"
      >
        {rejectPending ? <ButtonSpinner size={12} /> : null}
        Reject
      </button>
    </form>
  );
}