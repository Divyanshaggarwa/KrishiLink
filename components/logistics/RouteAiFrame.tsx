"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DropPoint, PickupPoint } from "@/lib/route-ai";

interface Props {
  geoapifyKey: string;
  drops: DropPoint[];
  pickups: PickupPoint[];
}

type FrameState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "connected"; dropCount: number; pickupCount: number }
  | { kind: "error"; message: string };

interface WireDrop { name: string; lat: number; lng: number; }
interface WirePickup {
  name: string; lat: number; lng: number;
  kg: number; crop: string; price: number; drop: number;
}

export default function RouteAiFrame({ geoapifyKey, drops, pickups }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [state, setState] = useState<FrameState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);

  const src = `/api/route-ai?k=${encodeURIComponent(geoapifyKey)}&embed=1&v=${attempt}`;

  const buildPayload = useCallback(() => {
    const wireDrops: WireDrop[] = drops.map((d) => ({
      name: d.name, lat: d.lat, lng: d.lng,
    }));
    const wirePickups: WirePickup[] = pickups.map((p) => ({
      name: p.name, lat: p.lat, lng: p.lng,
      kg: p.kg, crop: p.crop,
      price: p.pricePerKg,
      drop: p.dropIndex,
    }));
    return { drops: wireDrops, pickups: wirePickups };
  }, [drops, pickups]);

  const sendOrders = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        { type: "krishilink-orders", ...buildPayload() },
        window.location.origin
      );
    } catch (err) {
      console.warn("[route-ai] postMessage failed", err);
    }
  }, [buildPayload]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const m = e.data as { type?: string } | null;
      if (!m || typeof m !== "object") return;

      if (m.type === "krishilink-iframe-ready") {
        setState({ kind: "loading" });
        sendOrders();
      } else if (m.type === "krishilink-orders-applied") {
        const a = e.data as { drops: number; pickups: number };
        setState({ kind: "connected", dropCount: a.drops, pickupCount: a.pickups });
      } else if (m.type === "krishilink-orders-failed") {
        const a = e.data as { error: string };
        setState({ kind: "error", message: a.error || "Unknown iframe error" });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendOrders]);

  // Push new data whenever props change (after first connect)
  useEffect(() => {
    if (state.kind !== "connected") return;
    sendOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops, pickups]);

  // 6s handshake timeout
  useEffect(() => {
    if (state.kind === "connected" || state.kind === "error") return;
    const t = setTimeout(() => {
      setState((prev) =>
        prev.kind === "connected"
          ? prev
          : {
              kind: "error",
              message:
                "Route engine didn't respond. Check the /api/route-ai endpoint.",
            }
      );
    }, 6000);
    return () => clearTimeout(t);
  }, [state.kind, attempt]);

  const retry = () => {
    setState({ kind: "idle" });
    setAttempt((n) => n + 1);
  };

  const statusColor =
    state.kind === "connected" ? "bg-[#2E7D32]"
    : state.kind === "error" ? "bg-[#C62828]"
    : "bg-[#B26A00]";

  const statusLabel =
    state.kind === "connected" ? "Connected"
    : state.kind === "error" ? "Error"
    : state.kind === "loading" ? "Connecting…"
    : "Waiting…";

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B7A74]">
        <span>
          Live order feed · {pickups.length} pickup{pickups.length === 1 ? "" : "s"} →{" "}
          {drops.length} drop{drops.length === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
          {statusLabel}
        </span>
      </div>

      {state.kind === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          <span>Route AI failed: {state.message}</span>
          <button
            type="button"
            onClick={retry}
            className="rounded-full bg-[#C62828] px-3 py-1 text-xs font-medium text-white hover:bg-[#A02020]"
          >
            Retry
          </button>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-[#E4EBE6] bg-white">
        {(state.kind === "idle" || state.kind === "loading") && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2 text-xs text-[#6B7A74]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1B4D3E] border-t-transparent" />
              Loading Route AI…
            </div>
          </div>
        )}

        <iframe
          key={attempt}
          ref={iframeRef}
          src={src}
          title="KrishiLink Route-AI"
          className="h-[78vh] w-full border-0"
          allow="geolocation"
        />
      </div>

      <p className="text-[11px] text-[#6B7A74]">
        Live OpenStreetMap road data via OSRM. Risk zones, truck capacity, and
        route preference (safe / fast) are configurable on the left.
      </p>
    </div>
  );
}