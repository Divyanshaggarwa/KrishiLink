const STEPS = [
  { key: "escrow_pending", label: "Order placed" },
  { key: "escrow_paid", label: "Advance received" },
  { key: "in_transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Paid out" },
] as const;

const ORDER: Record<string, number> = {
  escrow_pending: 0,
  escrow_paid: 1,
  in_transit: 2,
  delivered: 3,
  completed: 4,
  disputed: -1,
  cancelled: -2,
};

export default function Timeline({
  status,
  createdAt,
}: {
  status: string;
  createdAt: string;
}) {
  if (status === "disputed" || status === "cancelled") {
    return (
      <div className="rounded-2xl border border-[#FFCDD2] bg-[#FFF5F5] p-4 text-sm text-[#C62828]">
        <strong className="font-semibold">
          {status === "disputed" ? "Dispute raised" : "Order cancelled"}
        </strong>
        <p className="mt-1 text-xs text-[#C62828]/80">
          Our team will follow up. Reference: opened on{" "}
          {new Date(createdAt).toLocaleDateString()}
        </p>
      </div>
    );
  }

  const currentIdx = ORDER[status] ?? 0;

  return (
    <div className="rounded-2xl border border-[#E4EBE6] bg-white p-6">
      <div className="flex flex-wrap items-start gap-4 md:flex-nowrap">
        {STEPS.map((s, i) => {
          const done = i <= currentIdx;
          const isCurrent = i === currentIdx;

          return (
            <div
              key={s.key}
              className="flex flex-1 items-start gap-3 md:flex-col md:items-center md:text-center"
            >
              <div className="flex items-center gap-3 md:flex-col">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-[#1B4D3E] text-white"
                      : "border-2 border-[#E4EBE6] bg-white text-[#6B7A74]"
                  } ${isCurrent ? "ring-4 ring-[#EAF5EE]" : ""}`}
                >
                  {done ? "✓" : i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className={`hidden h-0.5 w-full md:block ${
                      i < currentIdx ? "bg-[#1B4D3E]" : "bg-[#E4EBE6]"
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 md:flex-none">
                <p
                  className={`text-xs font-medium md:text-[11px] ${
                    done ? "text-[#1B4D3E]" : "text-[#6B7A74]"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}