"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["offers", "listings", "transactions", "notifications"];

export default function RealtimeRefresher({
  userId,
}: {
  userId?: string;
}) {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const supabase = createClient();

    // Debounce: collect bursts of events into one refresh
    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (isMounted.current) {
          router.refresh();
        }
      }, 600);
    };

    const channel = supabase.channel("krishilink-realtime");

    // Subscribe to each table
    TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          // If notifications has a user_id filter and it isn't us, skip
          if (table === "notifications" && userId) {
            const row = payload.new as { user_id?: string };
            if (row?.user_id && row.user_id !== userId) return;
          }
          scheduleRefresh();
        }
      );
    });

    channel.subscribe();

    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [router, userId]);

  return null; // invisible component
}