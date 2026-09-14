"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const MESSAGES = [
  "Connecting to KrishiLink…",
  "Loading verified listings…",
  "Checking market rates…",
  "Preparing your dashboard…",
  "Almost there…",
];

type Props = {
  message?: string;
  variant?: "page" | "section";
};

export default function LoadingScreen({ message, variant = "page" }: Props) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 1400);
    return () => clearInterval(id);
  }, [message]);

  const displayMessage = message || MESSAGES[msgIndex];

  if (variant === "section") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border border-[#E4EBE6] bg-white py-16">
        <LeafSpinner size={48} />
        <p className="text-sm text-[#6B7A74]">{displayMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
      <div className="relative flex flex-col items-center">
        {/* Soft green glow behind the logo */}
        <div
          className="absolute -inset-16 -z-10 rounded-full bg-[#A5D6A7] opacity-20 blur-3xl"
          aria-hidden="true"
        />

        <LeafSpinner size={96} />

        <p className="font-display mt-6 text-2xl font-bold text-[#1B4D3E]">
          KrishiLink
        </p>
        <p className="mt-2 text-sm text-[#6B7A74]">{displayMessage}</p>

        <div className="mt-6 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#A5D6A7]" />
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#A5D6A7]"
            style={{ animationDelay: "0.15s" }}
          />
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#A5D6A7]"
            style={{ animationDelay: "0.3s" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- Leaf spinner using your actual logo icon ---------- */
function LeafSpinner({ size = 64 }: { size?: number }) {
  const iconSize = size * 0.68;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Rotating ring */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 animate-spin"
        style={{ width: size, height: size }}
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#EAF5EE"
          strokeWidth="4"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#2E7D32"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="70 220"
        />
      </svg>

      {/* Your logo icon in the center, gently pulsing */}
      <Image
        src="/logo-icon.png"
        alt=""
        width={iconSize}
        height={iconSize}
        priority
        className="animate-pulse object-contain"
        style={{ width: iconSize, height: iconSize }}
      />
    </div>
  );
}