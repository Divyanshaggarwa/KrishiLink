import Logo from "./Logo";
import BackButton from "./BackButton";
import Link from "next/link";

export default function SiteHeader({
  nav,
  right,
  showBack = true,
  logoHref = "/",
}: {
  nav?: { href: string; label: string }[];
  right?: React.ReactNode;
  showBack?: boolean;
  logoHref?: string;
}) {
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-[#E4EBE6] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6">
        {/* Left cluster: back + logo */}
        <div className="flex items-center gap-3">
          {showBack && <BackButton />}
          <Logo href={logoHref} height={48} />
        </div>

        {/* Optional center nav */}
        {nav && nav.length > 0 && (
          <nav className="hidden items-center gap-7 text-sm text-[#6B7A74] md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="transition-colors hover:text-[#1B4D3E]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}