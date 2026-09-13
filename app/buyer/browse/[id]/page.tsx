import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/DashboardShell";
import OfferForm from "./OfferForm";

export default async function ListingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole(["buyer"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, crop, variety, quantity_kg, quality_grade, expected_price_per_kg, district, state, pincode, harvest_date, photo_url, status, created_at"
    )
    .eq("id", id)
    .single();

  if (!listing || listing.status !== "active") notFound();

  const month = new Date(listing.harvest_date || listing.created_at).getMonth() + 1;

  return (
    <DashboardShell
      profile={profile}
      title={listing.crop}
      subtitle={`${listing.district}, ${listing.state}`}
    >
      <div className="mb-6">
        <Link
          href="/buyer/browse"
          className="text-sm text-[#6B7A74] hover:text-[#1B4D3E]"
        >
          ← Back to browse
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* LEFT: listing info */}
        <div className="space-y-6">
          <div className="relative h-64 w-full overflow-hidden rounded-[24px] bg-[#EAF5EE]">
            {listing.photo_url ? (
              <Image
                src={listing.photo_url}
                alt={listing.crop}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl">
                🌾
              </div>
            )}
            <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#1B4D3E]">
              Grade {listing.quality_grade ?? "—"}
            </span>
          </div>

          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
            <h2 className="font-display text-lg font-bold">Listing details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <Info label="Crop" value={listing.crop} />
              <Info label="Variety" value={listing.variety || "—"} />
              <Info label="Available" value={`${listing.quantity_kg} kg`} />
              <Info
                label="Farmer asks"
                value={`₹${listing.expected_price_per_kg}/kg`}
              />
              <Info label="Quality grade" value={listing.quality_grade ?? "—"} />
              <Info
                label="Harvest"
                value={
                  listing.harvest_date
                    ? new Date(listing.harvest_date).toLocaleDateString()
                    : "—"
                }
              />
              <Info
                label="Location"
                value={`${listing.district}, ${listing.state}`}
              />
              <Info label="PIN" value={listing.pincode || "—"} />
            </dl>
          </div>
        </div>

        {/* RIGHT: offer form */}
        <div>
          <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6 lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-bold">Place an offer</h2>
            <p className="mt-1 text-sm text-[#6B7A74]">
              Enter your price and quantity. Fair Price AI will validate your
              bid against live market data.
            </p>

            <div className="mt-6">
              <OfferForm
                listing={{
                  id: listing.id,
                  crop: listing.crop,
                  quality_grade: listing.quality_grade as
                    | "A"
                    | "B"
                    | "C"
                    | null,
                  quantity_kg: listing.quantity_kg,
                  expected_price_per_kg: listing.expected_price_per_kg,
                  district: listing.district,
                  month,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#6B7A74]">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}