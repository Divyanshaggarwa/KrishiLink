"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function fetchAll() {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setItems(json.items || []);
    setUnread(json.unread || 0);
    setLoaded(true);
  }

  useEffect(() => {
    fetchAll();
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
  }

  async function markOne(id: string) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_read: true } : i))
    );
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#E4EBE6] bg-white text-[#6B7A74] transition-colors hover:border-[#1B4D3E] hover:text-[#1B4D3E]"
        aria-label="Notifications"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C62828] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-[#E4EBE6] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#E4EBE6] px-4 py-3">
            <p className="text-sm font-semibold text-[#1B4D3E]">
              Notifications
            </p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-medium text-[#2E7D32] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!loaded ? (
              <p className="p-4 text-center text-xs text-[#6B7A74]">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-xs text-[#6B7A74]">
                No notifications yet.
              </p>
            ) : (
              items.map((n) => {
                const inner = (
                  <div
                    className={`flex items-start gap-3 border-b border-[#F0F3F1] px-4 py-3 transition-colors hover:bg-[#FAFCFA] ${
                      !n.is_read ? "bg-[#FAFCFA]" : ""
                    }`}
                  >
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        !n.is_read ? "bg-[#2E7D32]" : "bg-[#E4EBE6]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#0F1F1A]">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 text-[11px] text-[#6B7A74]">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[#6B7A74]">
                        {new Date(n.created_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );

                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => {
                      markOne(n.id);
                      setOpen(false);
                    }}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    onClick={() => markOne(n.id)}
                    className="block w-full text-left"
                  >
                    {inner}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}