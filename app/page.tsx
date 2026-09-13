"use client";
import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { useEffect } from "react";

/* ================= ICONS ================= */

function LeafMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
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

function Icon({
  children,
  size = 22,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const SproutIcon = () => (
  <Icon>
    <path d="M12 21v-8" />
    <path d="M12 13c0-4 3-6 8-6 0 4-3 6-8 6z" />
    <path d="M12 13c0-3-2.5-5-7-5 0 3.5 2.5 5 7 5z" />
  </Icon>
);
const StoreIcon = () => (
  <Icon>
    <path d="M4 9l1.2-5h13.6L20 9" />
    <path d="M4 9v11h16V9" />
    <path d="M9.5 20v-6h5v6" />
  </Icon>
);
const HeadsetIcon = () => (
  <Icon>
    <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
    <rect x="3" y="14" width="4" height="6" rx="1" />
    <rect x="17" y="14" width="4" height="6" rx="1" />
    <path d="M20 20a3 3 0 0 1-3 3h-3" />
  </Icon>
);
const BrainIcon = () => (
  <Icon>
    <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 5 2V4a3 3 0 0 0-2 0z" />
    <path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-5 2V4a3 3 0 0 1 2 0z" />
  </Icon>
);
const CameraIcon = () => (
  <Icon>
    <path d="M3 8a2 2 0 0 1 2-2h2l1-2h8l1 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </Icon>
);
const TruckIcon = () => (
  <Icon>
    <path d="M1 5h12v11H1zM13 8h5l3 3v5h-8" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Icon>
);
const PhoneIcon = () => (
  <Icon>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.4 1.9.7 2.9.8a2 2 0 0 1 1.7 1.9z" />
  </Icon>
);
const RupeeIcon = () => (
  <Icon>
    <path d="M6 4h11M6 9h11M8 4c0 5 3 6 6 6l-8 10" />
  </Icon>
);
const LockIcon = () => (
  <Icon>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);
const StarIcon = () => (
  <Icon>
    <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9.1 9z" />
  </Icon>
);
const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M17.5 14.5c2.8.4 4.5 2.5 4.5 5.5" />
  </Icon>
);
const GlobeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
  </Icon>
);
const CheckIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </Icon>
);
const ArrowRight = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const ArrowGreen = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2E7D32"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const ArrowRed = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#C62828"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* ================= SCROLL REVEAL ================= */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ================= DATA ================= */

const roles = [
  {
    href: "/farmer",
    title: "Farmer / FPO",
    tag: "Self-serve + Aggregation",
    icon: <SproutIcon />,
    description:
      "List produce, compare buyer offers, and see true take-home after logistics. FPOs aggregate small farm lots to unlock bulk pricing.",
    chips: ["List produce", "FPO aggregation", "Net realization"],
  },
  {
    href: "/buyer",
    title: "Buyer",
    tag: "Wholesaler · Bulk",
    icon: <StoreIcon />,
    description:
      "Browse verified listings from farmers and FPO hubs, place competitive offers, and track logistics in real time.",
    chips: ["Browse listings", "Place offers", "Track logistics"],
  },
  {
    href: "/pds-operator",
    title: "PDS Operator",
    tag: "Assisted access",
    icon: <HeadsetIcon />,
    description:
      "Village-level operator lists and manages produce on behalf of farmers without smartphones. Earns KrishiLink credits.",
    chips: ["Assist farmers", "IVR bridge", "Village kiosk"],
  },
];

const features = [
  {
    icon: <CameraIcon />,
    title: "Quality AI Camera",
    body: "Scan produce → grade A / B / C with confidence. Quality drives price transparency.",
  },
  {
    icon: <TruckIcon />,
    title: "Smart Logistics",
    body: "Route optimization + vehicle matching + multi-farm pickup to lower ₹/kg transport cost.",
  },
  {
    icon: <PhoneIcon />,
    title: "IVR Voice + Book a Call",
    body: "No smartphone? Call the AI helpline. Negotiate with buyers directly over voice.",
  },
  {
    icon: <LockIcon />,
    title: "Secure Escrow (30 / 70)",
    body: "Buyer pays 30% advance to lock the order. Remaining 70% released only after delivery verification.",
  },
  {
    icon: <StarIcon />,
    title: "Trust Score",
    body: "Every farmer, buyer, and transporter builds a reputation after each completed transaction.",
  },
  {
    icon: <UsersIcon />,
    title: "FPO Aggregation",
    body: "Small farm lots combined into bulk consignments to match large buyers and reduce per-unit cost.",
  },
];

const steps = [
  {
    n: "01",
    t: "List produce",
    d: "Farmer or PDS operator posts crop, quantity, quality, location, harvest date, and photo.",
  },
  {
    n: "02",
    t: "AI grades & prices",
    d: "Quality AI scans the photo. Fair Price AI returns an explainable price band in seconds.",
  },
  {
    n: "03",
    t: "Buyers bid",
    d: "Verified buyers place per-kg offers. Farmer can negotiate via Book a Call.",
  },
  {
    n: "04",
    t: "Best net deal",
    d: "KrishiLink compares all offers after transport + transaction costs and recommends the highest net realization.",
  },
];

const beforeFlow = [
  "Farmer ₹15",
  "Trader / Agent",
  "Local Mandi",
  "Secondary Agent",
  "Other Mandi",
  "Sabji Wale",
  "Consumer ₹65",
];

const afterFlow = [
  "Farmer",
  "KrishiLink",
  "Wholesaler",
  "Sabji Wale",
  "Consumer",
];

/* ================= PAGE ================= */

export default function Home() {
  return (
    <div
      className="relative min-h-screen bg-white text-[#0F1F1A]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% 0%, #EAF5EE 0%, #FFFFFF 65%)",
      }}
    >
      <div
        className="grain pointer-events-none fixed inset-0 z-[1] opacity-[0.03] mix-blend-multiply"
        aria-hidden="true"
      />

      {/* ================= HEADER ================= */}
            <SiteHeader
        showBack={false}
        nav={[
          { href: "#problem", label: "The gap" },
          { href: "#features", label: "Features" },
          { href: "#how", label: "How it works" },
          { href: "#roles", label: "Roles" },
        ]}
        right={
          <>
            <Link
              href="/login"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-[#1B4D3E] transition-colors hover:bg-[#EAF5EE]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#1B4D3E] px-4 py-1.5 text-sm font-medium text-white transition-transform hover:scale-[1.03]"
            >
              Sign up
            </Link>
          </>
        }
      />

      <main className="relative z-[2]">
        {/* ================= HERO ================= */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 md:grid-cols-[1.05fr_1fr] md:gap-20 md:py-28">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#C8E6C9] bg-[#EAF5EE] px-4 py-1.5 text-xs font-medium text-[#1B4D3E]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32]" />
              The KrishiLink Ecosystem
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="font-display mt-6 text-[38px] font-extrabold leading-[1.08] tracking-tight text-[#0F1F1A] md:text-[54px]"
            >
              One ecosystem.{" "}
              <span className="relative inline-block">
                <span className="relative z-10">Direct farmer-to-buyer</span>
                <span className="absolute inset-x-0 bottom-1 -z-0 h-3 bg-[#A5D6A7]/60" />
              </span>{" "}
              trade. Zero unnecessary middlemen.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-[#6B7A74]"
            >
              KrishiLink is an{" "}
              <span className="font-medium text-[#1B4D3E]">
                AI-powered agricultural ecosystem
              </span>{" "}
              — not just an app — connecting farmers, FPOs, and verified buyers
              through fair pricing, quality verification, optimized logistics,
              and transparent net realization.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/login?mode=signup"
                className="group inline-flex items-center gap-2 rounded-full bg-[#1B4D3E] px-7 py-3.5 text-sm font-medium text-white shadow-[0_10px_30px_-10px_rgba(27,77,62,0.6)] transition-all hover:scale-[1.03] hover:shadow-[0_15px_35px_-10px_rgba(27,77,62,0.7)]"
              >
                Join the ecosystem
                <span className="transition-transform group-hover:translate-x-0.5">
                  <ArrowRight />
                </span>
              </Link>
              <a
                href="#problem"
                className="rounded-full border border-[#1B4D3E] px-7 py-3.5 text-sm font-medium text-[#1B4D3E] transition-colors hover:bg-[#EAF5EE]"
              >
                See the Gap 
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-10 flex flex-wrap items-center gap-4 text-sm text-[#6B7A74]"
            >
              <span>14.6 Cr farmers</span>
              <span className="h-1 w-1 rounded-full bg-[#A5D6A7]" />
              <span>₹4.82 L Cr mandi trade</span>
              <span className="h-1 w-1 rounded-full bg-[#A5D6A7]" />
              <span>6 layers → 0</span>
            </motion.div>
          </div>

                    {/* Right: ecosystem-at-a-glance card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div
              className="absolute -inset-6 -z-10 rounded-[40px] bg-[#A5D6A7] opacity-30 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative rounded-[24px] border border-[#E4EBE6] bg-white p-8 shadow-[0_25px_60px_-25px_rgba(27,77,62,0.35)]">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-[#6B7A74]">
                  One ecosystem
                </p>
                <span className="rounded-full bg-[#EAF5EE] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#2E7D32]">
                  Live
                </span>
              </div>

              <h3 className="font-display mt-4 text-xl font-bold text-[#0F1F1A]">
                Three entry points.
                <br />
                One bridge to every buyer.
              </h3>

              {/* Three access paths */}
              <div className="mt-6 grid gap-3">
                <AccessRow
                  icon={<PhoneIcon />}
                  title="Smartphone App"
                  sub="Tech-savvy farmers"
                />
                <AccessRow
                  icon={<HeadsetIcon />}
                  title="IVR Voice Helpline"
                  sub="On-call · no app needed"
                />
                <AccessRow
                  icon={<UsersIcon />}
                  title="PDS Operator Kiosk"
                  sub="Assisted access · village hub"
                />
              </div>

              {/* Converge arrow */}
              <div className="mt-5 flex justify-center" aria-hidden="true">
                <svg
                  width="20"
                  height="24"
                  viewBox="0 0 20 24"
                  fill="none"
                  stroke="#2E7D32"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 2v16M4 14l6 6 6-6" />
                </svg>
              </div>

              {/* KrishiLink hub */}
              <div className="mt-3 rounded-2xl bg-[#1B4D3E] p-5 text-center text-white">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[#A5D6A7]">
                    <BrainIcon />
                  </span>
                  <p className="font-display text-lg font-bold">
                    KrishiLink Hub
                  </p>
                </div>
                <p className="mt-1 text-[11px] text-[#A5D6A7]">
                  AI pricing · quality · logistics · escrow
                </p>
              </div>

              {/* Arrow to buyer */}
              <div className="mt-3 flex justify-center" aria-hidden="true">
                <svg
                  width="20"
                  height="24"
                  viewBox="0 0 20 24"
                  fill="none"
                  stroke="#2E7D32"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 2v16M4 14l6 6 6-6" />
                </svg>
              </div>

              {/* Buyer destination */}
              <div className="mt-3 rounded-2xl border border-[#C8E6C9] bg-[#EAF5EE] p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-[#1B4D3E]">
                  <StoreIcon />
                  <p className="font-display text-sm font-bold">
                    Verified Buyers
                  </p>
                </div>
                <p className="mt-1 text-[11px] text-[#1B4D3E]/70">
                  Wholesalers · bulk aggregators · retail chains
                </p>
              </div>

              <p className="mt-5 text-[11px] text-[#6B7A74]">
                Works for every farmer — with or without a smartphone.
              </p>
            </div>
          </motion.div>
        </section>

        {/* ================= TRUST STRIP ================= */}
        <section className="border-y border-[#123528] bg-[#1B4D3E] py-5 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 text-sm">
            <TrustItem icon={<CheckIcon />} label="e-NAM–verified public data" />
            <TrustItem icon={<PhoneIcon />} label="IVR-first · no smartphone needed" />
            <TrustItem icon={<GlobeIcon />} label="Open marketplace · any buyer, any farmer" />
            <TrustItem icon={<RupeeIcon />} label="Transparent net realization math" />
          </div>
        </section>

        {/* ================= THE ₹50 QUESTION (PROBLEM STATEMENT) ================= */}
        <section id="problem" className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-[#C62828]">
              Problem statement
            </p>
            <h2 className="font-display mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-[#0F1F1A] md:text-4xl">
              The farmer works for 6 months. The middleman works for 6 hours.
              The farmer earns less.
            </h2>
            <p className="mt-4 max-w-2xl text-[#6B7A74]">
              Multiple intermediaries reduce the farmer&apos;s earnings and raise
              the consumer&apos;s price. Same crop. Same day. ₹50/kg difference.
            </p>
          </Reveal>

          {/* BEFORE flow */}
          <Reveal delay={0.1}>
            <div className="mt-14 rounded-[24px] border border-[#FFCDD2] bg-[#FFF5F5] p-6 md:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#C62828]">
                    Before · Traditional model
                  </p>
                  <p className="font-display mt-1 text-lg font-bold text-[#0F1F1A]">
                    6 layers eat the value
                  </p>
                </div>
                <span className="rounded-full bg-[#C62828] px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                  Leakage
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2 md:gap-3">
                {beforeFlow.map((step, i) => (
                  <div key={step} className="flex items-center gap-2 md:gap-3">
                    <div
                      className={`rounded-xl border px-3 py-2 text-xs font-medium md:text-sm ${
                        i === 0 || i === beforeFlow.length - 1
                          ? "border-[#C62828] bg-white text-[#C62828]"
                          : "border-[#E4EBE6] bg-white text-[#6B7A74]"
                      }`}
                    >
                      {step}
                    </div>
                    {i < beforeFlow.length - 1 && <ArrowRed />}
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3 text-xs text-[#6B7A74] md:grid-cols-4">
                <GapChip
                  label="Price transparency"
                  detail="Limited visibility of demand and rates"
                />
                <GapChip
                  label="Trust & verification"
                  detail="No common trusted mechanism"
                />
                <GapChip
                  label="Quality disputes"
                  detail="Inconsistent grading → conflicts"
                />
                <GapChip
                  label="Logistics"
                  detail="Complex pickups, multiple handling"
                />
              </div>
            </div>
          </Reveal>

          {/* AFTER flow */}
          <Reveal delay={0.2}>
            <div className="mt-8 rounded-[24px] border-2 border-[#2E7D32] bg-[#EAF5EE] p-6 md:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#2E7D32]">
                    After · KrishiLink bridge
                  </p>
                  <p className="font-display mt-1 text-lg font-bold text-[#0F1F1A]">
                    Cutting the unnecessary layers
                  </p>
                </div>
                <span className="rounded-full bg-[#2E7D32] px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                  Direct
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2 md:gap-3">
                {afterFlow.map((step, i) => (
                  <div key={step} className="flex items-center gap-2 md:gap-3">
                    <div
                      className={`rounded-xl border px-3 py-2 text-xs font-medium md:text-sm ${
                        step === "KrishiLink"
                          ? "border-[#1B4D3E] bg-[#1B4D3E] text-white"
                          : "border-[#C8E6C9] bg-white text-[#1B4D3E]"
                      }`}
                    >
                      {step}
                    </div>
                    {i < afterFlow.length - 1 && <ArrowGreen />}
                  </div>
                ))}
              </div>

              <p className="mt-6 text-sm text-[#1B4D3E]/80">
                We don&apos;t remove essential services — FPO aggregation, quality
                verification, logistics stay. We remove the{" "}
                <span className="font-semibold text-[#1B4D3E]">
                  unnecessary, opaque intermediaries
                </span>
                .
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <p className="mt-10 text-center text-sm text-[#6B7A74]">
              Same crop. Same day. The ₹50 stays in the ecosystem — split between
              farmer income and consumer savings.
            </p>
          </Reveal>
        </section>

        {/* ================= FEATURES (BENTO) ================= */}
        <section
          id="features"
          className="border-y border-[#E4EBE6] bg-[#F8F9FA]"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <p className="text-xs font-medium uppercase tracking-widest text-[#2E7D32]">
                What the KrishiLink ecosystem does
              </p>
              <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-[#0F1F1A] md:text-4xl">
                Not just a marketplace — a full ecosystem.
              </h2>
              <p className="mt-3 max-w-2xl text-[#6B7A74]">
                Every feature below is built to remove a specific leak in the
                traditional chain.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-4">
              {/* Big: Fair Price AI + Net Realization */}
              <Reveal className="md:col-span-2 md:row-span-2">
                <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-[24px] border border-[#1B4D3E] bg-gradient-to-br from-[#1B4D3E] to-[#123528] p-8 text-white shadow-[0_25px_50px_-20px_rgba(27,77,62,0.5)]">
                  <div
                    className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#A5D6A7]/20 blur-3xl"
                    aria-hidden="true"
                  />
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-[#A5D6A7]">
                      <BrainIcon />
                    </div>
                    <h3 className="font-display mt-6 text-2xl font-bold">
                      Fair Price AI + Net Realization
                    </h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
                      An explainable price band from market signals, demand, and
                      quality. Then every buyer offer is re-computed as{" "}
                      <span className="font-mono text-[#A5D6A7]">
                        price − logistics − transaction
                      </span>
                      .
                    </p>
                  </div>
                  <div className="relative mt-8 rounded-2xl bg-white/5 p-4 font-mono text-xs text-[#A5D6A7] backdrop-blur">
                    ₹25.00 → −₹1.20 → −₹0.30 →{" "}
                    <span className="text-white">₹23.50</span>
                  </div>
                </div>
              </Reveal>

              {features.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.05}>
                  <div className="group h-full rounded-[24px] border border-[#E4EBE6] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#2E7D32] hover:shadow-[0_20px_40px_-20px_rgba(27,77,62,0.3)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF5EE] text-[#1B4D3E] transition-colors group-hover:bg-[#1B4D3E] group-hover:text-[#A5D6A7]">
                      {f.icon}
                    </div>
                    <h3 className="font-display mt-5 text-lg font-bold">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#6B7A74]">
                      {f.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how" className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-[#2E7D32]">
              How it works
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold tracking-tight md:text-4xl">
              From listing to pickup, in four steps.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-4">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="relative h-full rounded-[24px] border border-[#E4EBE6] bg-white p-6">
                  <span className="font-display text-4xl font-extrabold text-[#A5D6A7]">
                    {s.n}
                  </span>
                  <h3 className="font-display mt-4 text-lg font-bold">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B7A74]">
                    {s.d}
                  </p>
                  {i < steps.length - 1 && (
                    <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 md:block">
                      <ArrowGreen />
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================= ROLES ================= */}
        <section
          id="roles"
          className="border-y border-[#E4EBE6] bg-[#F8F9FA]"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="text-center">
                <p className="text-xs font-medium uppercase tracking-widest text-[#2E7D32]">
                  Choose your role
                </p>
                <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
                  Same ecosystem. Three views.
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[#6B7A74]">
                  Inclusive by design — farmers who can&apos;t use a smartphone
                  are served by a village-level PDS operator.
                </p>
              </div>
            </Reveal>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {roles.map((r, i) => (
                <Reveal key={r.href} delay={i * 0.08}>
                  <Link
                    href={r.href}
                    className="group flex h-full flex-col rounded-[24px] border border-[#E4EBE6] bg-white p-7 transition-all duration-300 hover:-translate-y-2 hover:border-[#2E7D32] hover:shadow-[0_30px_50px_-20px_rgba(27,77,62,0.35)]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF5EE] text-[#1B4D3E] transition-colors group-hover:bg-[#1B4D3E] group-hover:text-[#A5D6A7]">
                        {r.icon}
                      </div>
                      <span className="rounded-full border border-[#E4EBE6] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#6B7A74]">
                        {r.tag}
                      </span>
                    </div>
                    <h3 className="font-display mt-6 text-xl font-bold">
                      {r.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#6B7A74]">
                      {r.description}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E4EBE6] pt-5">
                      {r.chips.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-[#EAF5EE] px-2.5 py-1 text-[11px] font-medium text-[#1B4D3E]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#2E7D32]">
                      Continue
                      <span className="transition-transform group-hover:translate-x-1">
                        <ArrowRight />
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= IMPACT TARGETS ================= */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-[#2E7D32]">
              What we&apos;re measuring
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold tracking-tight md:text-4xl">
              Honest KPIs — not marketing numbers.
            </h2>
            <p className="mt-3 max-w-xl text-[#6B7A74]">
              Every figure below is a target. Pilot data will validate or replace
              them.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-4">
            {[
              {
                label: "Farmer share of retail price",
                value: "25% → 58%",
                unit: "target uplift",
              },
              {
                label: "Additional net realization",
                value: "₹2–4",
                unit: "/ kg (target)",
              },
              {
                label: "Middlemen layers",
                value: "6 → 0",
                unit: "in KrishiLink flow",
              },
              {
                label: "Verification method",
                value: "Pilot",
                unit: "field-tested",
              },
            ].map((k, i) => (
              <Reveal key={k.label} delay={i * 0.06}>
                <div className="rounded-[24px] border border-[#E4EBE6] bg-white p-6">
                  <p className="text-xs uppercase tracking-wide text-[#6B7A74]">
                    {k.label}
                  </p>
                  <p className="font-display mt-3 text-3xl font-extrabold text-[#1B4D3E]">
                    {k.value}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7A74]">{k.unit}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] bg-[#1B4D3E] px-8 py-16 text-center text-white md:px-16">
              <div
                className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#A5D6A7]/15 blur-3xl"
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-[#2E7D32]/25 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative">
                <h2 className="font-display mx-auto max-w-3xl text-3xl font-extrabold tracking-tight md:text-5xl">
                  A farmer with a ₹1,000 phone deserves the same digital power as
                  a bulk buyer.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-white/80">
                  Explore the ecosystem, compare offers, and see the net
                  realization math in action.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/login?mode=signup"
                    className="rounded-full bg-white px-7 py-3.5 text-sm font-medium text-[#1B4D3E] transition-transform hover:scale-105"
                  >
                    Create your account
                  </Link>
                  <Link
                    href="/farmer"
                    className="rounded-full border border-white/30 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    Explore as Farmer / FPO
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-[#E4EBE6] bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <LeafMark size={28} />
            <div>
              <p className="font-display text-sm font-bold">KrishiLink</p>
              <p className="text-xs text-[#6B7A74]">
                AI-powered agricultural ecosystem
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#6B7A74]">
            <span className="rounded-full border border-[#E4EBE6] px-3 py-1">
              ₹ Saved/kg · pilot pending
            </span>
            <span className="rounded-full border border-[#E4EBE6] px-3 py-1">
              Farmers · demo data
            </span>
            <span className="rounded-full border border-[#E4EBE6] px-3 py-1">
              Buyers · demo data
            </span>
            <Link
              href="/admin"
              className="rounded-full border border-[#E4EBE6] px-3 py-1 transition-colors hover:border-[#1B4D3E] hover:text-[#1B4D3E]"
            >
              Admin panel →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ================= HELPERS ================= */

function TrustItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 text-white/90">
      <span className="text-[#A5D6A7]">{icon}</span>
      {label}
    </span>
  );
}

function GapChip({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[#FFCDD2] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C62828]">
        {label}
      </p>
      <p className="mt-1 text-[11px] text-[#6B7A74]">{detail}</p>
    </div>
  );
}
function AccessRow({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E4EBE6] bg-[#F8F9FA] px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#1B4D3E]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#0F1F1A]">{title}</p>
        <p className="text-[11px] text-[#6B7A74]">{sub}</p>
      </div>
    </div>
  );
}