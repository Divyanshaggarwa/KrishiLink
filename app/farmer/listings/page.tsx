import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";

export default async function MyListingsPage() {
  const profile = await requireRole(["farmer"]);
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("farmer_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell
      profile={profile}
      title="My listings"
      subtitle="Every crop you've published, with current status."
    >
      <div className="mb-6 flex justify-end">
        <Link
          href="/farmer/list"
          className="rounded-full bg-[#1B4D3E] px-5 py-2.5 text-sm font-medium text-white hover:scale-[1.02] transition-transform"
        >
          + New listing
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-12 text-center">
          <p className="text-[#6B7A74]">
            You haven&apos;t published any listings yet.
          </p>
          <Link
            href="/farmer/list"
            className="mt-4 inline-block text-sm font-medium text-[#2E7D32] hover:underline"
          >
            Create your first listing →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA] text-left text-xs uppercase tracking-wide text-[#6B7A74]">
              <tr>
                <th className="p-4">Crop</th>
                <th className="p-4">Qty (kg)</th>
                <th className="p-4">Grade</th>
                <th className="p-4">Expected ₹/kg</th>
                <th className="p-4">District</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-[#E4EBE6] hover:bg-[#FAFCFA]"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {l.photo_url ? (
                        <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                          <Image
                            src={l.photo_url}
                            alt={l.crop}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-[#EAF5EE]" />
                      )}
                      <span className="font-medium">{l.crop}</span>
                    </div>
                  </td>
                  <td className="p-4">{l.quantity_kg}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-[#EAF5EE] px-2.5 py-1 text-xs font-medium text-[#1B4D3E]">
                      {l.quality_grade ?? "—"}
                    </span>
                  </td>
                  <td className="p-4">₹{l.expected_price_per_kg}</td>
                  <td className="p-4 text-[#6B7A74]">{l.district}</td>
                  <td className="p-4">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href="/farmer/offers"
                      className="rounded-full bg-[#EAF5EE] px-3 py-1.5 text-xs font-medium text-[#1B4D3E] hover:bg-[#1B4D3E] hover:text-white transition-colors"
                    >
                      View offers →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-[#EAF5EE] text-[#2E7D32]",
    sold: "bg-[#E3F2FD] text-[#1565C0]",
    expired: "bg-[#FFF5F5] text-[#C62828]",
    cancelled: "bg-[#F5F5F5] text-[#6B7A74]",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ?? "bg-[#F5F5F5] text-[#6B7A74]"
      }`}
    >
      {status}
    </span>
  );
}