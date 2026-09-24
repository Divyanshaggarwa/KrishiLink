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
    <header className="sticky top-0 z-50 h-16 border-b border-[#E4EBE6] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          {showBack && <BackButton />}
          <Logo href={logoHref} height={48} />
        </div>

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

        <div className="flex items-center gap-2">
          {userId && <NotificationBell userId={userId} />}
          {right}
        </div>
      </div>
    </header>
  );
}