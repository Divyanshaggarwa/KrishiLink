import Link from "next/link";

function LeafMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#1B4D3E" />
      <path d="M9 23C9 15 15 9 24 8c0 9-6 15-15 15z" fill="#A5D6A7" />
      <path
        d="M9 23c3-4 8-9 13-12"
        stroke="#1B4D3E"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F1F1A]">
      <header className="sticky top-0 z-50 h-16 border-b border-[#E4EBE6] bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D32]"
          >
            <LeafMark />
            <span className="font-display text-xl font-bold tracking-tight">
              KrishiLink
            </span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[#1B4D3E] px-4 py-1.5 text-sm font-medium text-[#1B4D3E] transition-colors hover:bg-[#EAF5EE]"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-[#1B4D3E] md:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[#6B7A74]">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}