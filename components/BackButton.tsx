"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BackButton() {
  const router = useRouter();
  const [hovering, setHovering] = useState(false);

  return (
    <button
      type="button"
      onClick={() => router.back()}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      aria-label="Go back"
      className="group relative flex h-10 items-center gap-2 overflow-hidden rounded-full border border-[#E4EBE6] bg-white pl-2.5 pr-3 text-sm font-medium text-[#1B4D3E] shadow-[0_2px_8px_-4px_rgba(27,77,62,0.15)] transition-all duration-300 hover:border-[#2E7D32] hover:bg-[#1B4D3E] hover:text-white hover:shadow-[0_8px_20px_-8px_rgba(27,77,62,0.5)] active:scale-[0.97]"
    >
      {/* Sliding arrow icon */}
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF5EE] text-[#1B4D3E] transition-all duration-300 group-hover:bg-[#A5D6A7] ${
          hovering ? "-translate-x-0.5" : ""
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </span>

      {/* Label */}
      <span className="relative hidden md:inline">
        Back
        <span className="absolute -bottom-0.5 left-0 h-[2px] w-0 rounded-full bg-current transition-all duration-300 group-hover:w-full" />
      </span>
    </button>
  );
}