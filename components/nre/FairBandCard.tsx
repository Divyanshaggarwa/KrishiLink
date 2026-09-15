import type { FairBand } from "@/lib/nre/fairBand";

export default function FairBandCard({
  band,
  farmerPrice,
  buyerBid,
  perspective,
}: {
  band: FairBand;
  farmerPrice: number;
  buyerBid: number;
  perspective: "farmer" | "buyer";
}) {
  const verdictColor =
    band.verdict === "narrow"
      ? "border-[#A5D6A7] bg-[#EAF5EE]"
      : band.verdict === "moderate"
      ? "border-[#FFE082] bg-[#FFF8E1]"
      : "border-[#FFCDD2] bg-[#FFF5F5]";

  const verdictText =
    band.verdict === "narrow"
      ? "text-[#2E7D32]"
      : band.verdict === "moderate"
      ? "text-[#B26A00]"
      : "text-[#C62828]";

  // Position markers on a 0-100 scale within [low-2, high+2]
  const rangeMin = band.low - 2;
  const rangeMax = band.high + 2;
  const span = Math.max(rangeMax - rangeMin, 0.001);
  const pct = (v: number) =>
    Math.max(0, Math.min(100, ((v - rangeMin) / span) * 100));

  return (
    <div className="rounded-2xl border border-[#C8E6C9] bg-[#FAFCFA] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
          Shared Fair Band
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#6B7A74]">
          Both parties see this
        </span>
      </div>

      <p className="font-display mt-3 text-3xl font-extrabold text-[#1B4D3E]">
        ₹{band.low.toFixed(2)} – ₹{band.high.toFixed(2)}
        <span className="ml-1 text-sm font-medium text-[#6B7A74]">/kg</span>
      </p>
      <p className="mt-1 text-xs text-[#6B7A74]">
        Fair midpoint:{" "}
        <strong className="text-[#1B4D3E]">₹{band.mid.toFixed(2)}</strong>
        {" · "}Quality ×{band.qualityMultiplier}
      </p>

      {/* Range bar with markers */}
      <div className="mt-5">
        <div className="relative h-2 rounded-full bg-[#E4EBE6]">
          <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-[#A5D6A7]" />

          {/* Fair midpoint marker */}
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1B4D3E] shadow"
            style={{ left: `${pct(band.mid)}%` }}
            title={`Fair mid: ₹${band.mid}`}
          />

          {/* Farmer price marker */}
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#C62828] shadow"
            style={{ left: `${pct(farmerPrice)}%` }}
            title={`Farmer asks: ₹${farmerPrice}`}
          />

          {/* Buyer bid marker */}
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1565C0] shadow"
            style={{ left: `${pct(buyerBid)}%` }}
            title={`Buyer bid: ₹${buyerBid}`}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-[#6B7A74]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#C62828]" />
            Farmer ₹{farmerPrice.toFixed(2)}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#1B4D3E]" />
            Fair mid
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#1565C0]" />
            Buyer ₹{buyerBid.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Shared cost breakdown */}
      <div className="mt-5 rounded-xl border border-[#E4EBE6] bg-white p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
          Shared costs (50/50 split)
        </p>
        <div className="mt-2 space-y-1.5 text-xs">
          <Row
            label="Transport share"
            value={`₹${band.transportSharePerKg.toFixed(2)}/kg`}
          />
          <Row
            label="Labour / handling"
            value={`₹${band.labourPerKg.toFixed(2)}/kg`}
          />
          <Row
            label="Payment / platform"
            value={`₹${band.txnSharePerKg.toFixed(2)}/kg`}
          />
          <div className="my-2 border-t border-dashed border-[#E4EBE6]" />
          <Row
            label="Total shared cost"
            value={`₹${band.sharedCostPerKg.toFixed(2)}/kg`}
            bold
          />
        </div>
      </div>

      {/* Verdict message */}
      <div className={`mt-4 rounded-xl border ${verdictColor} p-3`}>
        <p className={`text-xs font-medium ${verdictText}`}>
          {perspective === "farmer" ? "🎯 " : "🤝 "}
          {band.message}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "font-semibold text-[#1B4D3E]" : "text-[#6B7A74]"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}