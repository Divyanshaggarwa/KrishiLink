"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DropPoint, PickupPoint } from "@/lib/route-ai";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Props {
  /** Geoapify key injected server-side (never NEXT_PUBLIC_). */
  geoapifyKey: string;
  drops: DropPoint[];
  pickups: PickupPoint[];
  /** Health info from the server (optional). */
  health?: {
    geoapify: "ok" | "missing_key";
    osrm: "ok" | "degraded";
  };
}

type FrameState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "connected"; dropCount: number; pickupCount: number }
  | { kind: "error"; message: string };

interface WireDrop {
  name: string;
  lat: number;
  lng: number;
}
interface WirePickup {
  name: string;
  lat: number;
  lng: number;
  kg: number;
  crop: string;
  price: number;
  drop: number;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function RouteAiFrame({
  geoapifyKey,
  drops,
  pickups,
  health,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [state, setState] = useState<FrameState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0); // bump to retry

  // Stable iframe src — remount only when key changes OR user hits retry.
  const src = `/api/route-ai?k=${encodeURIComponent(geoapifyKey)}&embed=1&v=${attempt}`;

  /* -------- Serialize orders for the iframe -------- */
  const buildPayload = useCallback((): {
    drops: WireDrop[];
    pickups: WirePickup[];
  } => {
    const wireDrops: WireDrop[] = drops.map((d) => ({
      name: d.name,
      lat: d.lat,
      lng: d.lng,
    }));

    const wirePickups: WirePickup[] = pickups.map((p) => ({
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      kg: p.kg,
      crop: p.crop,
      price: p.pricePerKg,
      drop: p.dropIndex,
    }));

    return { drops: wireDrops, pickups: wirePickups };
  }, [drops, pickups]);

  /* -------- Send orders to iframe -------- */
  const sendOrders = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const payload = buildPayload();
    try {
      win.postMessage(
        { type: "krishilink-orders", ...payload },
        window.location.origin
      );
    } catch (err) {
      console.warn("[route-ai] postMessage failed", err);
    }
  }, [buildPayload]);

  /* -------- Listen for iframe → parent messages -------- */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const m = e.data as
        | { type: "krishilink-iframe-ready" }
        | { type: "krishilink-orders-applied"; drops: number; pickups: number }
        | { type: "krishilink-orders-failed"; error: string }
        | { type?: string }
        | null;

      if (!m || typeof m !== "object") return;

      if (m.type === "krishilink-iframe-ready") {
        setState({ kind: "loading" });
        // iframe is ready — push data right away
        sendOrders();
      } else if (m.type === "krishilink-orders-applied") {
        setState({
          kind: "connected",
          dropCount: (m as { drops: number }).drops,
          pickupCount: (m as { pickups: number }).pickups,
        });
      } else if (m.type === "krishilink-orders-failed") {
        setState({
          kind: "error",
          message: (m as { error: string }).error || "Unknown iframe error",
        });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendOrders]);

  /* -------- Push new data whenever orders change -------- */
  useEffect(() => {
    if (state.kind !== "connected") return;
    sendOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops, pickups]);

  /* -------- Handshake timeout: if no "ready" in 6 s, error out -------- */
  useEffect(() => {
    if (state.kind !== "idle" && state.kind !== "loading") return;
    const t = setTimeout(() => {
      setState((prev) =>
        prev.kind === "connected"
          ? prev
          : {
              kind: "error",
              message:
                "The route engine didn't respond in time. Check the /api/route-ai endpoint.",
            }
      );
    }, 6000);
    return () => clearTimeout(t);
  }, [state.kind, attempt]);

  /* -------- Retry handler -------- */
  const retry = () => {
    setState({ kind: "idle" });
    setAttempt((n) => n + 1);
  };

  /* -------- Invalidate size on container resize -------- */
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const onResize = () => {
      try {
        win.postMessage(
          { type: "krishilink-invalidate" },
          window.location.origin
        );
      } catch {
        /* ignore */
      }
    };
    const observer = new ResizeObserver(() => onResize());
    if (iframeRef.current) observer.observe(iframeRef.current);
    return () => observer.disconnect();
  }, [state.kind]);

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const statusColor =
    state.kind === "connected"
      ? "bg-[#2E7D32]"
      : state.kind === "error"
        ? "bg-[#C62828]"
        : "bg-[#B26A00]";

  const statusLabel =
    state.kind === "connected"
      ? "Connected"
      : state.kind === "error"
        ? "Error"
        : state.kind === "loading"
          ? "Connecting…"
          : "Waiting…";

  return (
    <div className="w-full space-y-3">
      {/* Status strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B7A74]">
        <span>
          Live order feed · {pickups.length} pickup
          {pickups.length === 1 ? "" : "s"} → {drops.length} drop
          {drops.length === 1 ? "" : "s"}
        </span>

        <div className="flex items-center gap-3">
          {health?.geoapify === "missing_key" && (
            <span className="rounded-full bg-[#FFF8E1] px-2 py-0.5 text-[10px] font-medium text-[#B26A00]">
              Geoapify key missing
            </span>
          )}
          {health?.osrm === "degraded" && (
            <span className="rounded-full bg-[#FFF8E1] px-2 py-0.5 text-[10px] font-medium text-[#B26A00]">
              OSRM unreachable — using estimates
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {state.kind === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          <span>Route AI failed to load: {state.message}</span>
          <button
            type="button"
            onClick={retry}
            className="rounded-full bg-[#C62828] px-3 py-1 text-xs font-medium text-white hover:bg-[#A02020]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Iframe wrapper */}
      <div className="relative overflow-hidden rounded-2xl border border-[#E4EBE6] bg-white">
        {/* Loading skeleton */}
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