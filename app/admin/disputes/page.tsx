export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function AdminDisputesPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: disputedTxns } = await supabase
    .from("transactions")
    .select(
      "id, listing_id, pool_id, farmer_id, buyer_id, gross_amount, status, created_at"
    )
    .eq("status", "disputed")
    .order("created_at", { ascending: false });

  const safeTxns = disputedTxns || [];

  const userIds = Array.from(
    new Set([
      ...safeTxns.map((t) => t.farmer_id),
      ...safeTxns.map((t) => t.buyer_id),
    ])
  );

  const { data: users } =
    userIds.length > 0
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, business_name")
          .in("id", userIds)
      : { data: [] as never[] };

  const userMap = new Map((users || []).map((u) => [u.id, u]));

  return (
    <DashboardShell
      profile={profile}
      showBack={true}
      title="Disputes"
      subtitle="Transactions flagged for review."
    >
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]">
          ← Back to overview
        </Link>
      </div>

      {safeTxns.length === 0 ? (
        <div className="rounded-[24px] border border-[#A5D6A7] bg-[#EAF5EE] p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2E7D32] text-2xl text-white">
            ✓
          </div>
          <h3 className="font-display mt-4 text-lg font-bold text-[#1B4D3E]">
            All clear
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#1B4D3E]/80">
            No open disputes right now. Every transaction is progressing
            smoothly.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {safeTxns.map((t) => {
            const seller = userMap.get(t.farmer_id);
            const buyer = userMap.get(t.buyer_id);
            return (
              <div
                key={t.id}
                className="rounded-[24px] border border-[#FFCDD2] bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#C62828]">
                      Disputed transaction
                    </h3>
                    <p className="mt-1 text-xs text-[#6B7A74]">
                      ID: <span className="font-mono">{t.id.slice(0, 8)}</span>{" "}
                      · Raised{" "}
                      {new Date(t.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FFF5F5] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#C62828]">
                    Under review
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <Field
                    label="Seller"
                    value={seller?.business_name || seller?.full_name || "—"}
                  />
                  <Field
                    label="Buyer"
                    value={buyer?.business_name || buyer?.full_name || "—"}
                  />
                  <Field
                    label="Amount"
                    value={`₹${Number(t.gross_amount).toLocaleString("en-IN")}`}
                    accent
                  />
                </div>

                <div className="mt-5 rounded-xl bg-[#FFF8E1] p-3 text-xs text-[#B26A00]">
                  ⚠️ Contact both parties to resolve the dispute. Mark resolved
                  by updating the transaction status in Supabase once settled.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          accent ? "text-[#1B4D3E]" : "text-[#0F1F1A]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}