import SiteHeader from "./SiteHeader";

const ROLE_LABEL: Record<string, string> = {
  farmer: "Farmer",
  buyer: "Buyer",
  pds_operator: "PDS Operator",
  admin: "Admin",
};

const ROLE_HOME: Record<string, string> = {
  farmer: "/farmer",
  buyer: "/buyer",
  pds_operator: "/pds-operator",
  admin: "/admin",
};

const NAV: Record<string, { href: string; label: string }[]> = {
  farmer: [
    { href: "/farmer", label: "Overview" },
    { href: "/farmer/list", label: "List produce" },
    { href: "/farmer/listings", label: "My listings" },
    { href: "/farmer/offers", label: "Offers received" },
  ],
  buyer: [
    { href: "/buyer", label: "Overview" },
    { href: "/buyer/browse", label: "Browse produce" },
    { href: "/buyer/bids", label: "My bids" },
  ],
  pds_operator: [
    { href: "/pds-operator", label: "Overview" },
    { href: "/pds-operator/assist", label: "Assist a farmer" },
    { href: "/pds-operator/farmers", label: "Village farmers" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/listings", label: "Listings" },
    { href: "/admin/transactions", label: "Transactions" },
  ],
};

export default function DashboardShell({
  profile,
  title,
  subtitle,
  showBack = true,
  children,
}: {
  profile: {
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
      <SiteHeader
        showBack={showBack}
        logoHref={homeHref}
        nav={nav}
        right={
          <>
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-[#6B7A74]">
                {ROLE_LABEL[profile.role] || profile.role}
                {profile.district ? ` · ${profile.district}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-[#EAF5EE] px-3 py-1 text-xs font-medium text-[#1B4D3E]">
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

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[#6B7A74]">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}