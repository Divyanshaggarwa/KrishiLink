import Logo from "./Logo";
import BackButton from "./BackButton";
import NotificationBell from "./NotificationBell";
import Link from "next/link";

export default function SiteHeader({
  nav,
  right,
  showBack = true,
  logoHref = "/",
  userId,
}: {
  nav?: { href: string; label: string }[];
  right?: React.ReactNode;
  showBack?: boolean;
  logoHref?: string;
  userId?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E4EBE6] bg-white/85 backdrop-blur-md">
      {/* Top row */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {showBack && <BackButton />}
          <Logo href={logoHref} height={40} />
        </div>

        {/* Desktop nav — hidden on mobile */}
        {nav && nav.length > 0 && (
          <nav className="hidden items-center gap-6 text-sm text-[#6B7A74] md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap transition-colors hover:text-[#1B4D3E]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {userId && <NotificationBell userId={userId} />}
          {right}
        </div>
      </div>

      {/* Mobile nav row — scrollable pills */}
      {nav && nav.length > 0 && (
        <div className="border-t border-[#E4EBE6] bg-white md:hidden">
          <div className="flex gap-2 overflow-x-auto px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-full border border-[#E4EBE6] bg-white px-3 py-1.5 text-xs font-medium text-[#6B7A74] transition-colors hover:border-[#1B4D3E] hover:text-[#1B4D3E]"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}