import Link from "next/link";
import { notFound } from "next/navigation";
import LoginForm from "./LoginForm";
import SiteHeader from "@/components/SiteHeader";

const VALID = ["farmer", "buyer", "pds-operator", "admin"] as const;
type UrlRole = (typeof VALID)[number];

const META: Record<UrlRole, { title: string; subtitle: string }> = {
  farmer: {
    title: "Farmer sign in",
    subtitle: "Access your listings and offers.",
  },
  buyer: {
    title: "Buyer sign in",
    subtitle: "Browse produce and manage your bids.",
  },
  "pds-operator": {
    title: "PDS Operator sign in",
    subtitle: "Assist farmers in your village.",
  },
  admin: {
    title: "Admin sign in",
    subtitle: "Platform operations and analytics.",
  },
};

export default async function LoginPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (!VALID.includes(role as UrlRole)) notFound();
  const r = role as UrlRole;
  const meta = META[r];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F1F1A]">
            <SiteHeader
        right={
          <Link
            href={`/signup/${role}`}
            className="rounded-full border border-[#1B4D3E] px-4 py-1.5 text-sm font-medium text-[#1B4D3E] hover:bg-[#EAF5EE]"
          >
            Sign up
          </Link>
        }
      />

      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          {meta.title}
        </h1>
        <p className="mt-2 text-[#6B7A74]">{meta.subtitle}</p>

        <div className="mt-8 rounded-[24px] border border-[#E4EBE6] bg-white p-8 shadow-[0_20px_50px_-30px_rgba(27,77,62,0.3)]">
          <LoginForm role={r} />
        </div>

        <p className="mt-6 text-center text-sm text-[#6B7A74]">
          New here?{" "}
          <Link
            href={`/signup/${r}`}
            className="font-medium text-[#2E7D32]"
          >
            Create {r.replace("-", " ")} account
          </Link>
        </p>
      </main>
    </div>
  );
}