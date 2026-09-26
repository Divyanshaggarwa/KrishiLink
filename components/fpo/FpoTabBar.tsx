"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/farmer/fpo/dashboard", label: "Overview" },
  { href: "/farmer/fpo/dashboard/offers", label: "Offers" },
  { href: "/farmer/fpo/dashboard/members", label: "Members" },
  { href: "/farmer/fpo/dashboard/history", label: "History" },
];

export default function FpoTabBar() {
  const pathname = usePathname();

  return (
    <div className="mb-6 border-b border-[#E4EBE6]">
      <nav className="-mb-px flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const active =
            pathname === t.href ||
            (t.href !== "/farmer/fpo/dashboard" &&
              pathname?.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-[#1B4D3E] text-[#1B4D3E]"
                  : "border-transparent text-[#6B7A74] hover:border-[#C8E6C9] hover:text-[#1B4D3E]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}