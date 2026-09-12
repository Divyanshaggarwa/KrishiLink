import Link from "next/link";
import { notFound } from "next/navigation";
import SignupForm from "./SignupForm";
import SiteHeader from "@/components/SiteHeader";

const VALID = ["farmer", "buyer", "pds-operator", "admin"] as const;
type UrlRole = (typeof VALID)[number];

const META: Record<
  UrlRole,
  { title: string; subtitle: string; accent: string }
> = {
  farmer: {
    title: "Create your Farmer account",
    subtitle: "List produce and get the true take-home on every offer.",
    accent: "#2E7D32",
  },
  buyer: {
    title: "Create your Buyer account",
    subtitle: "Browse verified produce and place competitive offers.",
    accent: "#1B4D3E",
  },
  "pds-operator": {
    title: "Create your PDS Operator account",
    subtitle: "Assist farmers in your village — one kiosk, many farmers.",
    accent: "#2E7D32",
  },
  admin: {
    title: "Admin signup",
    subtitle: "Requires the admin code issued to the core team.",
    accent: "#1B4D3E",
  },
};

export default async function SignupPage({
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
            href={`/login/${role}`}
            className="rounded-full border border-[#1B4D3E] px-4 py-1.5 text-sm font-medium text-[#1B4D3E] hover:bg-[#EAF5EE]"
          >
            Sign in
          </Link>
        }
      />
      <main className="mx-auto max-w-2xl px-6 py-14">
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: meta.accent }}
        >
          {r.replace("-", " ")}
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight">
          {meta.title}
        </h1>
        <p className="mt-2 text-[#6B7A74]">{meta.subtitle}</p>

        <div className="mt-10 rounded-[24px] border border-[#E4EBE6] bg-white p-8 shadow-[0_20px_50px_-30px_rgba(27,77,62,0.3)]">
          <SignupForm role={r} />
        </div>

        <p className="mt-6 text-center text-sm text-[#6B7A74]">
          Already have an account?{" "}
          <Link href={`/login/${r}`} className="font-medium text-[#2E7D32]">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}