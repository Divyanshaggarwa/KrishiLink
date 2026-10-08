"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "listings",
  "offers",
  "transactions",
  "notifications",
  "fpo_pools",
  "fpo_members",
  "fpo_pool_contributions",
  "fpo_pool_payouts",
  "fpo_wallets",
  "wallets",
  "wallet_transactions",
  "profiles",
];

const REFRESH_DEBOUNCE_MS = 500;
const POLL_INTERVAL_MS = 20000;


export default function LiveSyncProvider({ userId }: { userId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pulse, setPulse] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const pathnameRef = useRef<string | null>(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (!mountedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setPulse(true);
      timerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        router.refresh();
        setTimeout(() => {
          if (mountedRef.current) setPulse(false);
        }, 400);
      }, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase.channel(`krishilink-live-${userId ?? "anon"}`);

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          // For notifications, only refresh if it's our row
          if (table === "notifications" && userId) {
            const row = payload.new as { user_id?: string };
            if (row?.user_id && row.user_id !== userId) return;
          }
          scheduleRefresh();
        }
      );
    }

    channel.subscribe();

    // Fallback poll every 20s while tab is visible
    const pollInterval = setInterval(() => {
      if (mountedRef.current && document.visibilityState === "visible") {
        router.refresh();
      }
    }, POLL_INTERVAL_MS);

    // Refresh on tab focus
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [router, userId]);

  // Don't show pill on landing/auth pages
  const hidden =
    !pathname ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth");

  if (hidden) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-[#C8E6C9] bg-white/95 px-3 py-1.5 shadow-[0_10px_30px_-10px_rgba(27,77,62,0.25)] backdrop-blur transition-opacity duration-300"
      aria-hidden="true"
    >
      <span
        className={`h-2 w-2 rounded-full transition-all duration-300 ${
          pulse
            ? "scale-125 bg-[#2E7D32] shadow-[0_0_0_4px_rgba(46,125,50,0.2)]"
            : "bg-[#A5D6A7]"
        }`}
      />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#2E7D32]">
        {pulse ? "Syncing" : "Live"}
      </span>
    </div>
  );
}