import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import IvrClient from "./IvrClient";

export const metadata = {
  title: "KrishiLink — IVR Simulation",
  description:
    "Feature-phone access to KrishiLink. List produce, hear offers, and check mandi prices over a simple phone call — no smartphone required.",
};

export default function IvrSimPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <SiteHeader
        showBack={false}
        logoHref="/"
        nav={[
          { href: "/#problem", label: "The gap" },
          { href: "/#features", label: "Features" },
          { href: "/#how", label: "How it works" },
          { href: "/#roles", label: "Roles" },
        ]}
        right={
          <>
            <Link
              href="/login"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-[#1B4D3E] transition-colors hover:bg-[#EAF5EE]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#1B4D3E] px-4 py-1.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
            >
              Sign up
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8E6C9] bg-[#EAF5EE] px-4 py-1.5 text-xs font-medium text-[#1B4D3E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32]" />
            Public demo · No login required
          </span>
          <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
            IVR — Voice-first access for every farmer
          </h1>
          <p className="mt-2 max-w-2xl text-[#6B7A74]">
            A working simulation of KrishiLink&apos;s feature-phone flow. Farmers
            without smartphones can list produce, hear offers ranked by net
            realization, and check mandi prices — all over a phone call. Every
            action writes to the same database as the main app.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap gap-2">
          {[
            "Same state machine as Exotel / Twilio",
            "Hindi · English · Kannada",
            "Writes real listings & offers",
            "KrishiLink ID + OTP secured",
          ].map((t) => (
            <span
              key={t}
              className="rounded-full border border-[#E4EBE6] bg-white px-3 py-1 text-[11px] text-[#6B7A74]"
            >
              {t}
            </span>
          ))}
        </div>

        <IvrClient />
      </main>
    </div>
  );
}