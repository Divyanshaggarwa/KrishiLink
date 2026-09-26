import SiteHeader from "./SiteHeader";
import RealtimeRefresher from "./RealtimeRefresher";

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

const NAV: Record<string, { href: string; label: string }[]> = {
  farmer: [
    { href: "/farmer", label: "Overview" },
    { href: "/farmer/list", label: "List" },
    { href: "/farmer/listings", label: "Listings" },
    { href: "/farmer/offers", label: "Offers" },
    { href: "/farmer/orders", label: "Orders" },
    { href: "/farmer/fpo", label: "FPO" },
    { href: "/wallet", label: "Wallet" },
  ],
  buyer: [
    { href: "/buyer", label: "Overview" },
    { href: "/buyer/browse", label: "Browse" },
    { href: "/buyer/pools", label: "Pools" },
    { href: "/buyer/bids", label: "Bids" },
    { href: "/buyer/orders", label: "Orders" },
    { href: "/wallet", label: "Wallet" },
  ],
  pds_operator: [
    { href: "/pds-operator", label: "Overview" },
    { href: "/pds-operator/assist", label: "Assist" },
    { href: "/pds-operator/farmers", label: "Farmers" },
    { href: "/wallet", label: "Wallet" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/fpo", label: "FPO" },
    { href: "/admin/fees", label: "Fees" },
    { href: "/admin/transactions", label: "Txns" },
    { href: "/admin/disputes", label: "Disputes" },
    { href: "/wallet", label: "Wallet" },
  ],
};

export default function DashboardShell({
  profile,
  title,
  subtitle,
  showBack = false,
  children,
}: {
  profile: {
    id?: string;
    full_name: string;
    role: string;
    district?: string | null;
    state?: string | null;
    trust_score?: number | null;
  };
  title: string;
  subtitle?: string;
  showBack?: boolean;
  children: React.ReactNode;
}) {
  const nav = NAV[profile.role] || [];
  const homeHref = ROLE_HOME[profile.role] || "/";

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F1F1A]">
      <RealtimeRefresher userId={profile.id} />

      <SiteHeader
        showBack={showBack}
        logoHref={homeHref}
        nav={nav}
        userId={profile.id}
        right={
          <>
            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium leading-tight">
                {profile.full_name}
              </p>
              <p className="text-[11px] text-[#6B7A74]">
                {ROLE_LABEL[profile.role] || profile.role}
                {profile.district ? ` · ${profile.district}` : ""}
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