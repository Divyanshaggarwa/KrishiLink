import Link from "next/link";
import IvrClient from "./IvrClient";

export default function IvrSimPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="sticky top-0 z-40 h-16 border-b border-[#E4EBE6] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-[#1B4D3E]">
            KrishiLink
          </Link>
          <span className="rounded-full bg-[#EAF5EE] px-3 py-1 text-xs font-medium text-[#2E7D32]">
            IVR Simulation
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Interactive Voice Response — Simulation
        </h1>
        <p className="mt-2 max-w-2xl text-[#6B7A74]">
          A working demo of KrishiLink&apos;s feature-phone access. Farmers without
          smartphones can list produce, hear ranked offers, accept deals, and
          check mandi prices — entirely over a phone call. Everything you do
          here writes to the same database as the main app.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-[11px] text-[#6B7A74] border border-[#E4EBE6]">
            Same state machine as Exotel / Twilio
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-[11px] text-[#6B7A74] border border-[#E4EBE6]">
            Hindi · English · Kannada
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-[11px] text-[#6B7A74] border border-[#E4EBE6]">
            Writes real listings &amp; offers
          </span>
        </div>

        <div className="mt-10">
          <IvrClient />
        </div>
      </main>
    </div>
  );
}