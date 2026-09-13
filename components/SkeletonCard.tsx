export default function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-white">
      <div className="h-40 w-full animate-pulse bg-[#EAF5EE]" />
      <div className="p-5">
        <div className="h-5 w-24 animate-pulse rounded bg-[#EAF5EE]" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="h-3 w-16 animate-pulse rounded bg-[#EAF5EE]" />
          <div className="h-3 w-16 animate-pulse rounded bg-[#EAF5EE]" />
          <div className="col-span-2 h-3 w-32 animate-pulse rounded bg-[#EAF5EE]" />
        </div>
      </div>
    </div>
  );
}