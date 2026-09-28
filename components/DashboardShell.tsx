"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "./SiteHeader";

const ROLE_LABEL: Record<string, string> = {
  farmer: "Farmer",
  buyer: "Buyer",
  fpo: "FPO Head",
  pds_operator: "PDS Operator",
  admin: "Admin",
};

const ROLE_HOME: Record<string, string> = {
  farmer: "/farmer",
  buyer: "/buyer",
  fpo: "/farmer",
  pds_operator: "/pds-operator",
  admin: "/admin",
};

const FARMER_NAV = [
  { href: "/farmer", label: "Overview" },
  { href: "/farmer/list", label: "List" },
  { href: "/farmer/listings", label: "Listings" },
  { href: "/farmer/offers", label: "Offers" },
  { href: "/farmer/orders", label: "Orders" },
  { href: "/farmer/fpo", label: "FPO" },
  { href: "/wallet", label: "Wallet" },
];

const FPO_NAV = [
  { href: "/farmer/fpo/dashboard", label: "Overview" },
  { href: "/farmer/fpo/dashboard/offers", label: "Offers" },
  { href: "/farmer/fpo/dashboard/members", label: "Members" },
  { href: "/farmer/fpo/dashboard/history", label: "History" },
  { href: "/farmer/fpo/dashboard/wallet", label: "FPO Wallet" },
  { href: "/farmer", label: "← Farm" },
];

const BUYER_NAV = [
  { href: "/buyer", label: "Overview" },
  { href: "/buyer/browse", label: "Browse" },
  { href: "/buyer/pools", label: "Pools" },
  { href: "/buyer/bids", label: "Bids" },
  { href: "/buyer/orders", label: "Orders" },
  { href: "/wallet", label: "Wallet" },
];

const PDS_NAV = [
  { href: "/pds-operator", label: "Overview" },
  { href: "/pds-operator/assist", label: "Assist" },
  { href: "/pds-operator/farmers", label: "Farmers" },
  { href: "/wallet", label: "Wallet" },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/verifications", label: "Verifications" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/fpo", label: "FPO" },
  { href: "/admin/fees", label: "Fees" },
  { href: "/admin/transactions", label: "Txns" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/wallet", label: "Wallet" },
];

function getNav(role: string, pathname: string | null) {
  if (pathname?.startsWith("/farmer/fpo/dashboard")) return FPO_NAV;
  if (role === "farmer") return FARMER_NAV;
  if (role === "buyer") return BUYER_NAV;
  if (role === "pds_operator") return PDS_NAV;
  if (role === "admin") return ADMIN_NAV;
  return [];
}

type DashboardProfile = {
  id?: string;
  full_name: string;
  role: string;
  district?: string | null;
  state?: string | null;
  trust_score?: number | null;
  fpo_status?: string | null;
  fpo_name?: string | null;
  fpo_id?: string | null;
};

export default function DashboardShell({
  profile,
  title,
  subtitle,
  showBack = false,
  children,
}: {
  profile: DashboardProfile;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const inFpoDashboard = pathname?.startsWith("/farmer/fpo/dashboard") ?? false;

  const nav = getNav(profile.role, pathname);
  const homeHref = inFpoDashboard
    ? "/farmer/fpo/dashboard"
    : ROLE_HOME[profile.role] || "/";

  const displayName =
    inFpoDashboard && profile.fpo_name ? profile.fpo_name : profile.full_name;

  const displayRole = inFpoDashboard
    ? "FPO Head"
    : ROLE_LABEL[profile.role] || profile.role;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F1F1A]">
      <SiteHeader
        showBack={showBack}
        logoHref={homeHref}
        nav={nav}
        userId={profile.id}
        right={
          <>
            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium leading-tight">
                {displayName}
              </p>
              <p className="text-[11px] text-[#6B7A74]">
                {displayRole}
                {profile.district && !inFpoDashboard
                  ? ` · ${profile.district}`
                  : ""}
              </p>
            </div>
            <span className="hidden rounded-full bg-[#EAF5EE] px-3 py-1 text-xs font-medium text-[#1B4D3E] sm:inline">
              {profile.trust_score ?? 50}
            </span>
            <form action="/auth/signout" method="post">
              <button className="rounded-full border border-[#E4EBE6] px-3 py-1.5 text-xs font-medium text-[#6B7A74] hover:border-[#1B4D3E] hover:text-[#1B4D3E]">
                Sign out
              </button>
            </form>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        {inFpoDashboard && profile.fpo_name && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#A5D6A7] bg-[#EAF5EE] px-3 py-1 text-[11px] font-medium text-[#2E7D32]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32]" />
            FPO Mode
            {profile.fpo_id ? ` · ${profile.fpo_id}` : ""}
          </div>
        )}

        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-[#6B7A74] md:text-base">
            {subtitle}
          </p>
        )}
        <div className="mt-6 md:mt-8">{children}</div>
      </main>
    </div>
  );
}