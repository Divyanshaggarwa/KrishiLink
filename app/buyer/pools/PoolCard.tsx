import Link from "next/link";

export default function PoolCard({
  pool,
  fpoName,
  fpoBusinessName,
  memberCount,
}: {
  pool: {
    id: string;
    crop: string;
    totalQuantityKg: number;
    qualityGrade: string | null;
    district: string;
    state: string | null;
    expectedPricePerKg: number;
    notes: string | null;
    createdAt: string;
  };
  fpoName: string;
  fpoBusinessName: string | null;
  memberCount: number;
}) {
  return (
    <Link
      href={`/buyer/pools/${pool.id}`}
      className="group flex flex-col overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.3)]"
    >
      {/* Header strip */}
      <div className="relative bg-gradient-to-br from-[#1B4D3E] to-[#0F3428] px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#A5D6A7]">
            FPO Pool
          </span>
          {pool.qualityGrade && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1B4D3E]">
              Grade {pool.qualityGrade}
            </span>
          )}
        </div>
        <h3 className="font-display mt-3 text-xl font-bold">{pool.crop}</h3>
        <p className="mt-1 text-xs text-white/70">
          {memberCount} farmer{memberCount === 1 ? "" : "s"} pooled
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[#6B7A74]">Total quantity</p>
            <p className="mt-0.5 font-semibold">{pool.totalQuantityKg} kg</p>
          </div>
          <div>
            <p className="text-[#6B7A74]">Asking price</p>
            <p className="mt-0.5 font-semibold">
              ₹{pool.expectedPricePerKg}/kg
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[#6B7A74]">Region</p>
            <p className="mt-0.5 font-semibold">
              {pool.district}
              {pool.state ? `, ${pool.state}` : ""}
            </p>
          </div>
        </div>

        {pool.notes && (
          <p className="mt-3 line-clamp-2 text-[11px] italic text-[#6B7A74]">
            &ldquo;{pool.notes}&rdquo;
          </p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-[#E4EBE6] pt-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[#0F1F1A]">
              {fpoBusinessName || fpoName}
            </p>
            <p className="text-[10px] text-[#6B7A74]">FPO head</p>
          </div>
          <span className="rounded-full bg-[#EAF5EE] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#2E7D32]">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}