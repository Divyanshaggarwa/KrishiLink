import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

function LeafMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#1B4D3E" />
      <path d="M9 23C9 15 15 9 24 8c0 9-6 15-15 15z" fill="#A5D6A7" />
    </svg>
  );
}

const roleCards = [
  {
    slug: "farmer",
    title: "Farmer / FPO",
    desc: "Self-serve. List produce, compare offers, track net realization.",
  },
  {
    slug: "buyer",
    title: "Buyer",
    desc: "Wholesaler, bulk buyer, or FPO procurement desk.",
  },
  {
    slug: "pds-operator",
    title: "PDS Operator",
    desc: "Village-level kiosk that assists farmers without smartphones.",
  },
  {
    slug: "admin",
    title: "Admin",
    desc: "Platform operations and analytics. Requires admin code.",
  },
];

export default function SignupChooser() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F1F1A]">
            <SiteHeader
        right={
          <Link
            href="/login"
            className="rounded-full border border-[#1B4D3E] px-4 py-1.5 text-sm font-medium text-[#1B4D3E] hover:bg-[#EAF5EE]"
          >
            Sign in
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Join the KrishiLink ecosystem
          </h1>
          <p className="mt-3 text-[#6B7A74]">
            Pick your role — signup forms are tailored to each.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {roleCards.map((r) => (
            <Link
              key={r.slug}
              href={`/signup/${r.slug}`}
              className="group rounded-[24px] border border-[#E4EBE6] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.3)]"
            >
              <h3 className="font-display text-xl font-bold text-[#1B4D3E]">
                {r.title}
              </h3>
              <p className="mt-2 text-sm text-[#6B7A74]">{r.desc}</p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[#2E7D32]">
                Sign up as {r.title} →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}