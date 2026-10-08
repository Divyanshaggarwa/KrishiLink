"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import ButtonSpinner from "@/components/ButtonSpinner";
import type {
  OrderRouteContext,
  ConsolidationSuggestion,
  NearbyOrder,
} from "@/lib/route-ai/server";

const inr = (v: number) => "₹" + Math.round(v).toLocaleString("en-IN");
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]!
  );

export default function OrderMapView({
  orderId,
  perspective,
}: {
  orderId: string;
  perspective: "farmer" | "buyer" | "admin";
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fitKeyRef = useRef<string | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<OrderRouteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showNearby, setShowNearby] = useState(true);
  const [showConsolidation, setShowConsolidation] = useState(true);

  /* Load Leaflet */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await import("leaflet");
        if (!cancelled) setLeafletLoaded(true);
      } catch (err) {
        console.error("Leaflet load failed:", err);
        if (!cancelled) {
          setMapError("The map library could not be loaded. Refresh the page to try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Refresh the order route and status while the order is active. */
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let firstLoad = true;

    async function refreshOrder() {
      try {
        const response = await fetch(`/api/orders/${orderId}/map`, {
          cache: "no-store",
        });
        if ([401, 403, 404].includes(response.status)) {
          const data = (await response.json()) as { error?: string };
          if (!cancelled) {
            setLoadError(data.error ?? "This order route is unavailable.");
          }
          return;
        }
        const data = (await response.json()) as
          | OrderRouteContext
          | { error?: string };
        if (!response.ok || !("order" in data)) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "The order route could not be refreshed."
          );
        }
        if (cancelled) return;

        setCtx(data);
        setLoadError(null);
        setLastUpdated(new Date());
        if (!["completed", "cancelled"].includes(data.order.status)) {
          timeout = setTimeout(refreshOrder, 20000);
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "The order route could not be refreshed."
        );
        if (firstLoad) setCtx(null);
        timeout = setTimeout(refreshOrder, 30000);
      } finally {
        if (!cancelled) setLoading(false);
        firstLoad = false;
      }
    }

    void refreshOrder();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [orderId]);

  /* Init map */
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current || mapRef.current) return;

    let mounted = true;
    void (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (!mounted || !containerRef.current) return;

        const map = L.map(containerRef.current, {
          zoomControl: true,
        }).setView([20.5937, 78.9629], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);

        mapRef.current = map;
        setMapReady(true);
        window.setTimeout(() => map.invalidateSize(), 200);
      } catch (error) {
        console.error("Order map initialization failed:", error);
        if (mounted) {
          setMapError("The map could not be initialized. Refresh the page to try again.");
        }
      }
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [leafletLoaded]);

  /* Render markers + routes */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !ctx) return;

    void (async () => {
      try {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
          map.removeLayer(layer);
        }
      });

      // Main route
      if (ctx.route.polyline.length > 1) {
        L.polyline(ctx.route.polyline, {
          color: "#1B4D3E",
          weight: 6,
          opacity: 0.9,
        }).addTo(map);
      }

      // Farmer marker
      const farmerIcon = L.divIcon({
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<div style="width:34px;height:34px;border-radius:50%;background:#1B4D3E;color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)">🌾</div>`,
      });

      const buyerIcon = L.divIcon({
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<div style="width:34px;height:34px;border-radius:50%;background:#1565C0;color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)">🏪</div>`,
      });

      L.marker([ctx.farmer.coords.lat, ctx.farmer.coords.lng], {
        icon: farmerIcon,
      })
        .addTo(map)
        .bindPopup(
          `<b>Pickup</b><br>${escapeHtml(ctx.farmer.name)}<br>${escapeHtml(ctx.farmer.district ?? "")}, ${escapeHtml(ctx.farmer.state ?? "")}`
        );

      L.marker([ctx.buyer.coords.lat, ctx.buyer.coords.lng], {
        icon: buyerIcon,
      })
        .addTo(map)
        .bindPopup(
          `<b>Drop</b><br>${escapeHtml(ctx.buyer.name)}<br>${escapeHtml(ctx.buyer.district ?? "")}, ${escapeHtml(ctx.buyer.state ?? "")}`
        );

      // Nearby orders
      if (showNearby && ctx.nearbyOrders.length > 0) {
        ctx.nearbyOrders.forEach((n) => {
          L.circleMarker([n.farmerCoords.lat, n.farmerCoords.lng], {
            radius: 6,
            color: "#B26A00",
            fillColor: "#FFE082",
            fillOpacity: 0.8,
            weight: 2,
          })
            .addTo(map)
            .bindPopup(
              `<b>${escapeHtml(n.farmerName)}</b><br>${escapeHtml(n.crop)} · ${n.quantityKg} kg<br><small>${n.distanceFromThisOrderKm} km from this order</small>`
            );

          L.circleMarker([n.buyerCoords.lat, n.buyerCoords.lng], {
            radius: 6,
            color: "#1565C0",
            fillColor: "#BBDEFB",
            fillOpacity: 0.8,
            weight: 2,
          }).addTo(map);
        });
      }

      // Consolidation route
      if (
        showConsolidation &&
        ctx.consolidation?.canConsolidate &&
        ctx.consolidation.combinedPolyline.length > 1
      ) {
        L.polyline(ctx.consolidation.combinedPolyline, {
          color: "#2E7D32",
          weight: 3,
          opacity: 0.65,
          dashArray: "8 6",
        }).addTo(map);
        ctx.consolidation.stops.forEach((stop, index) => {
          const icon = L.divIcon({
            className: "",
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            html: `<div style="width:30px;height:30px;border-radius:50%;background:${stop.kind === "pickup" ? "#1B4D3E" : "#1565C0"};color:#fff;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${stop.kind === "pickup" ? "P" : "D"}${index + 1}</div>`,
          });
          L.marker([stop.lat, stop.lng], { icon })
            .addTo(map)
            .bindPopup(
              `<b>${stop.kind === "pickup" ? "Pickup" : "Delivery"} · Order #${stop.orderId.slice(0, 8)}</b><br>${escapeHtml(stop.crop)}<br>${escapeHtml(stop.name)}`
            );
        });
      }

      // Fit bounds
      const pts: [number, number][] = [
        [ctx.farmer.coords.lat, ctx.farmer.coords.lng],
        [ctx.buyer.coords.lat, ctx.buyer.coords.lng],
      ];
      if (showNearby) {
        ctx.nearbyOrders.forEach((n) => {
          pts.push([n.farmerCoords.lat, n.farmerCoords.lng]);
          pts.push([n.buyerCoords.lat, n.buyerCoords.lng]);
        });
      }
      const fitKey = JSON.stringify([
        ctx.order.id,
        ctx.farmer.coords,
        ctx.buyer.coords,
        ctx.route.distanceKm,
        showNearby,
        showConsolidation,
        ctx.consolidation?.stops.map((stop) => [stop.orderId, stop.kind]) ?? [],
      ]);
      if (fitKeyRef.current !== fitKey) {
        try {
          map.fitBounds(L.latLngBounds(pts).pad(0.2));
          fitKeyRef.current = fitKey;
        } catch {
          /* ignore */
        }
      }
      } catch (error) {
        console.error("Order route rendering failed:", error);
        setMapError("The order route could not be drawn on the map.");
      }
    })();
  }, [ctx, mapReady, showNearby, showConsolidation]);

  return (
    <div className="space-y-4">
      {loadError && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#FFE082] bg-[#FFF8E1] p-3 text-xs text-[#8A5A00]"
        >
          <span>
            {ctx ? `Showing the last loaded route. ${loadError}` : loadError}
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-[#8A5A00] px-3 py-1 font-semibold"
          >
            Retry
          </button>
        </div>
      )}
      {mapError && (
        <div
          role="alert"
          className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-xs text-[#C62828]"
        >
          {mapError}
        </div>
      )}
      {!ctx && !loading && loadError && (
        <div className="rounded-xl border border-[#E4EBE6] bg-white p-4 text-xs text-[#6B7A74]">
          The route will appear when order data is available.
        </div>
      )}
      {/* Map */}
      <div className="relative h-[500px] overflow-hidden rounded-[20px] border border-[#E4EBE6] bg-[#EAF0ED]">
        <div ref={containerRef} className="h-full w-full" />
        {(loading || !mapReady) && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2 text-xs text-[#6B7A74]">
              <ButtonSpinner size={28} />
              {loading ? "Loading this order's route…" : "Preparing map…"}
            </div>
          </div>
        )}
        {ctx && (
          <>
        {/* Toggle chips */}
        <div className="absolute left-3 top-3 z-[400] flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowNearby((v) => !v)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              showNearby
                ? "border-[#B26A00] bg-[#FFF8E1] text-[#B26A00]"
                : "border-[#E4EBE6] bg-white text-[#6B7A74]"
            }`}
          >
            {showNearby ? "✓ " : ""}Nearby orders ({ctx.nearbyOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setShowConsolidation((v) => !v)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              showConsolidation
                ? "border-[#2E7D32] bg-[#EAF5EE] text-[#2E7D32]"
                : "border-[#E4EBE6] bg-white text-[#6B7A74]"
            }`}
          >
            {showConsolidation ? "✓ " : ""}Shared route
          </button>
        </div>
        <div className="absolute bottom-3 left-3 z-[400] rounded-xl border border-[#E4EBE6] bg-white/95 px-3 py-2 text-[10px] text-[#405149] shadow">
          <strong>Order #{ctx.order.shortId}</strong> · {ctx.order.crop} ·{" "}
          {ctx.order.status.replaceAll("_", " ")}
        </div>
          </>
        )}
      </div>

      {ctx && (
      <>
      {/* Route summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Distance" value={`${ctx.route.distanceKm} km`} />
        <Stat
          label="Route source"
          value={ctx.route.source === "road" ? "Road network" : "Estimated"}
        />
        <Stat
          label="Farmer net realization"
          value={
            ctx.order.netRealizationPerKg == null
              ? "Not recorded"
              : `₹${ctx.order.netRealizationPerKg.toFixed(2)}/kg`
          }
        />
        <Stat
          label={
            perspective === "buyer"
              ? "Your order total"
              : perspective === "farmer"
                ? "Your take-home"
                : "Farmer net proceeds"
          }
          value={
            perspective === "buyer"
              ? ctx.order.buyerTotalPayable == null
                ? "Not recorded"
                : inr(ctx.order.buyerTotalPayable)
              : ctx.order.netRealizationTotal == null
                ? "Not recorded"
                : inr(ctx.order.netRealizationTotal)
          }
          accent
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6B7A74]">
        <span>
          {ctx.order.transportMode === "krishilink"
            ? `Transport estimate: ${inr(ctx.transportCostTotal)} total · ${inr(ctx.perKgTransport)}/kg`
            : "Transport is not deducted from farmer net realization."}
          {" · "}{ctx.route.vehicle}
        </span>
        <span>
          {lastUpdated
            ? `Order status checked ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Checking order status…"}
          {!["completed", "cancelled"].includes(ctx.order.status) &&
            " · refreshes every 20 sec"}
        </span>
      </div>
      <p className="text-[10px] text-[#6B7A74]">
        Map pins use approximate district-level locations; vehicle GPS tracking
        is not connected.
      </p>

      {/* Consolidation card */}
      {ctx.consolidation?.canConsolidate && (
        <div className="rounded-[20px] border-2 border-[#2E7D32] bg-[#EAF5EE] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2E7D32] text-lg text-white">
              🚛
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-[#1B4D3E]">
                Potential shared-route plan
              </p>
              <p className="mt-1 text-xs text-[#1B4D3E]/80">
                {ctx.consolidation.sharedOrdersCount} compatible orders could use 1{" "}
                {ctx.consolidation.vehicle} (
                {ctx.consolidation.utilizationPercent}% loaded)
              </p>
              <p className="mt-1 text-xs text-[#1B4D3E]/80">
                Planned multi-stop route: {ctx.consolidation.routeKm} km ·{" "}
                {ctx.consolidation.routeDurationMin} min ·{" "}
                {ctx.consolidation.routeSource === "road"
                  ? "road network"
                  : "estimated"}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#6B7A74]">
                    Solo cost
                  </p>
                  <p className="font-display mt-1 text-base font-bold text-[#C62828]">
                    {inr(ctx.consolidation.originalTotalCost)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#6B7A74]">
                    Shared cost
                  </p>
                  <p className="font-display mt-1 text-base font-bold text-[#2E7D32]">
                    {inr(ctx.consolidation.consolidatedTotalCost)}
                  </p>
                </div>
                <div className="rounded-lg bg-[#1B4D3E] p-3 text-white">
                  <p className="text-[10px] uppercase tracking-wide text-[#A5D6A7]">
                    Estimated transport change
                  </p>
                  <p className="font-display mt-1 text-base font-bold">
                    {ctx.consolidation.savingsTotal >= 0 ? "Save " : "Extra "}
                    {inr(Math.abs(ctx.consolidation.savingsTotal))}
                  </p>
                  <p className="text-[10px] text-[#A5D6A7]">
                    Compared with current separate transport estimates
                  </p>
                </div>
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {ctx.consolidation.stops.map((stop, index) => (
                  <li
                    key={`${stop.orderId}-${stop.kind}`}
                    className="flex min-w-0 items-center gap-2 rounded-lg bg-white p-2 text-xs"
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${
                        stop.kind === "pickup"
                          ? "bg-[#1B4D3E]"
                          : "bg-[#1565C0]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate">
                      {stop.kind === "pickup" ? "Pickup" : "Delivery"} · #
                      {stop.orderId.slice(0, 8)} · {stop.crop}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[10px] text-[#1B4D3E]/75">
                Suggested plan only. Orders are not dispatched or assigned to a
                vehicle by this map.
              </p>
            </div>
          </div>
        </div>
      )}

      {ctx.nearbyOrders.length > 0 && !ctx.consolidation?.canConsolidate && (
        <div className="rounded-[20px] border border-[#FFE082] bg-[#FFF8E1] p-4 text-xs text-[#B26A00]">
          {ctx.nearbyOrders.length} compatible order
          {ctx.nearbyOrders.length === 1 ? "" : "s"} in the same corridor, but
          a capacity-safe shared trip could not be formed. Each order keeps its
          own route.
        </div>
      )}

      {/* Nearby orders list */}
      {ctx.nearbyOrders.length > 0 && (
        <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            Compatible route orders
          </p>
          <div className="mt-3 space-y-2">
            {ctx.nearbyOrders.map((n) => (
              <NearbyRow key={n.id} order={n} />
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-[#E4EBE6] bg-white p-4">
      <p className="text-[10px] uppercase tracking-wide text-[#6B7A74]">
        {label}
      </p>
      <p
        className={`font-display mt-1 text-lg font-bold ${
          accent ? "text-[#1B4D3E]" : "text-[#0F1F1A]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function NearbyRow({ order }: { order: NearbyOrder }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#E4EBE6] bg-[#FAFCFA] p-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-[#0F1F1A]">
          #{order.shortId} · {order.crop} · {order.quantityKg} kg
        </p>
        <p className="mt-0.5 text-[10px] text-[#6B7A74]">
          {order.farmerName} → {order.distanceFromThisOrderKm} km away
        </p>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
          order.status === "delivered"
            ? "bg-[#E3F2FD] text-[#1565C0]"
            : "bg-[#FFF8E1] text-[#B26A00]"
        }`}
      >
        {order.status.replace("_", " ")}
      </span>
    </div>
  );
}