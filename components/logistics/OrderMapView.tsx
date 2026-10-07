"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import ButtonSpinner from "@/components/ButtonSpinner";
import type {
  OrderRouteContext,
  ConsolidationSuggestion,
  NearbyOrder,
} from "@/lib/route-ai/server";

const inr = (v: number) => "₹" + Math.round(v).toLocaleString("en-IN");

export default function OrderMapView({
  orderId,
  perspective,
}: {
  orderId: string;
  perspective: "farmer" | "buyer" | "admin";
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [ctx, setCtx] = useState<OrderRouteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNearby, setShowNearby] = useState(true);
  const [showConsolidation, setShowConsolidation] = useState(true);

  /* Load Leaflet */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await import("leaflet/dist/leaflet.css");
        await import("leaflet");
        if (!cancelled) setLeafletLoaded(true);
      } catch (err) {
        console.error("Leaflet load failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Fetch order context */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/orders/${orderId}/map`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setCtx(null);
        } else {
          setCtx(data);
        }
      })
      .catch(() => {
        if (!cancelled) setCtx(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  /* Init map */
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current || mapRef.current) return;

    let mounted = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
      }).setView([20.5937, 78.9629], 5);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Tiles © Esri" }
      ).addTo(map);

      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded]);

  /* Render markers + routes */
  useEffect(() => {
    if (!mapRef.current || !ctx) return;

    (async () => {
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
          `<b>Pickup</b><br>${ctx.farmer.name}<br>${ctx.farmer.district ?? ""}, ${ctx.farmer.state ?? ""}`
        );

      L.marker([ctx.buyer.coords.lat, ctx.buyer.coords.lng], {
        icon: buyerIcon,
      })
        .addTo(map)
        .bindPopup(
          `<b>Drop</b><br>${ctx.buyer.name}<br>${ctx.buyer.district ?? ""}, ${ctx.buyer.state ?? ""}`
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
              `<b>${n.farmerName}</b><br>${n.crop} · ${n.quantityKg} kg<br><small>${n.distanceFromThisOrderKm} km from this order</small>`
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
      try {
        map.fitBounds(L.latLngBounds(pts).pad(0.2));
      } catch {
        /* ignore */
      }
    })();
  }, [ctx, showNearby, showConsolidation]);

  if (loading) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-[20px] border border-[#E4EBE6] bg-white">
        <ButtonSpinner size={28} />
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="rounded-[20px] border border-[#FFCDD2] bg-[#FFF5F5] p-6 text-sm text-[#C62828]">
        Could not load map for this order.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="relative h-[500px] overflow-hidden rounded-[20px] border border-[#E4EBE6] bg-[#F8F9FA]">
        <div ref={containerRef} className="h-full w-full" />

        {/* Toggle chips */}
        <div className="absolute left-3 top-3 z-[400] flex flex-wrap gap-2">
          <button
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
      </div>

      {/* Route summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Distance" value={`${ctx.route.distanceKm} km`} />
        <Stat label="Vehicle" value={ctx.route.vehicle} />
        <Stat
          label="Transport / kg"
          value={`₹${ctx.perKgTransport.toFixed(2)}`}
        />
        <Stat
          label="Total transport"
          value={`₹${ctx.transportCostTotal.toFixed(0)}`}
          accent
        />
      </div>

      {/* Consolidation card */}
      {ctx.consolidation?.canConsolidate && (
        <div className="rounded-[20px] border-2 border-[#2E7D32] bg-[#EAF5EE] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2E7D32] text-lg text-white">
              🚛
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-[#1B4D3E]">
                Consolidation opportunity
              </p>
              <p className="mt-1 text-xs text-[#1B4D3E]/80">
                {ctx.consolidation.sharedOrdersCount} orders can share 1{" "}
                {ctx.consolidation.vehicle} (
                {ctx.consolidation.utilizationPercent}% loaded)
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
                    Total saved
                  </p>
                  <p className="font-display mt-1 text-base font-bold">
                    {inr(ctx.consolidation.savingsTotal)} ({ctx.consolidation.savingsPercent}%)
                  </p>
                  <p className="text-[10px] text-[#A5D6A7]">
                    ₹{ctx.consolidation.savingsPerKg.toFixed(2)}/kg
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {ctx.nearbyOrders.length > 0 && !ctx.consolidation?.canConsolidate && (
        <div className="rounded-[20px] border border-[#FFE082] bg-[#FFF8E1] p-4 text-xs text-[#B26A00]">
          {ctx.nearbyOrders.length} other active order
          {ctx.nearbyOrders.length === 1 ? "" : "s"} in the same corridor, but
          combined weight exceeds truck capacity. Separate trucks assigned.
        </div>
      )}

      {/* Nearby orders list */}
      {ctx.nearbyOrders.length > 0 && (
        <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            Nearby active orders
          </p>
          <div className="mt-3 space-y-2">
            {ctx.nearbyOrders.map((n) => (
              <NearbyRow key={n.id} order={n} />
            ))}
          </div>
        </div>
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