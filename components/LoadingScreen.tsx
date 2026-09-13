"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Connecting to KrishiLink…",
  "Loading verified listings…",
  "Checking market rates…",
  "Preparing your dashboard…",
  "Almost there…",
];

export default function LoadingScreen({
  message,
  variant = "page",
}: {
  message?: string;
  variant?: "page" | "section";
}) {
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
        {/* Pulsing background aura */}
        <div
          className="absolute -inset-16 -z-10 rounded-full bg-[#A5D6A7] opacity-20 blur-3xl"
          aria-hidden="true"
        />

        {/* Animated logo mark */}
        <LeafSpinner size={80} />

        {/* Brand */}
        <p className="font-display mt-6 text-2xl font-bold text-[#1B4D3E]">
          KrishiLink
        </p>

        {/* Rotating message */}
        <div className="mt-3 h-5 overflow-hidden">
          <p
            key={displayMessage}
            style={{
              animation: "fadeIn 0.4s ease-out",
            }}
            className="text-sm text-[#6B7A74]"
          >
            {displayMessage}
          </p>
        </div>

        {/* Progress dots */}
        <div className="mt-6 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                animation: `pulseDot 1.4s ease-in-out ${i * 0.15}s infinite`,
              }}
              className="h-1.5 w-1.5 rounded-full bg-[#A5D6A7]"
            />
          ))}
        </div>
      </div>

      {/* Global keyframes injected inline */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Animated leaf spinner ---------- */
function LeafSpinner({ size = 64 }: { size?: number }) {
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Rotating ring */}
      <svg
        viewBox="0 0 100 100"
        style={{
          width: size,
          height: size,
          animation: "spinSlow 2s linear infinite",
        }}
        className="absolute inset-0"
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

      {/* Center leaf mark with pulse */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          style={{
            width: size * 0.55,
            height: size * 0.55,
            animation: "breathe 1.6s ease-in-out infinite",
          }}
          className="flex items-center justify-center rounded-full bg-[#1B4D3E]"
        >
          <svg
            viewBox="0 0 32 32"
            style={{ width: size * 0.4, height: size * 0.4 }}
          >
            <path
              d="M9 23C9 15 15 9 24 8c0 9-6 15-15 15z"
              fill="#A5D6A7"
            />
            <path
              d="M9 23c3-4 8-9 13-12"
              stroke="#1B4D3E"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}