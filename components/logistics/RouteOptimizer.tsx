"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  Map as LeafletMap,
  LayerGroup,
  LatLngBoundsExpression,
} from "leaflet";
import {
  optimizeRoutes,
  createDefaultState,
  PRESET_PLACES,
  CROPS_ROUTE,
  BOUNDS_DEHRADUN,
  type DropPoint,
  type PickupPoint,
  type RiskZone,
  type OptimizeResult,
} from "@/lib/route-ai";
import { loadOrdersForRouting } from "@/app/admin/logistics/actions";
import ButtonSpinner from "@/components/ButtonSpinner";

type EditMode = "pickup" | "drop" | "risk";
type DataSource = "demo" | "orders" | "loading";

const letter = (i: number) => String.fromCharCode(65 + i);
const inr = (v: number) => "₹" + Math.round(v).toLocaleString("en-IN");

export default function RouteOptimizer() {
  /* ============================================================
     ALL HOOKS FIRST — inside the component function
     ============================================================ */
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [drops, setDrops] = useState<DropPoint[]>([]);
  const [pickups, setPickups] = useState<PickupPoint[]>([]);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Loading map…");
  const [dataSource, setDataSource] = useState<DataSource>("loading");
  const [orderCount, setOrderCount] = useState(0);

  const [truckCap, setTruckCap] = useState(800);
  const [costPerKm, setCostPerKm] = useState(14);
  const [preferSafe, setPreferSafe] = useState(true);
  const [mode, setMode] = useState<EditMode>("pickup");

  /* ============================================================
     Step 1: Load Leaflet client-side
     ============================================================ */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await import("leaflet/dist/leaflet.css");
        await import("leaflet");
        if (!cancelled) {
          setLeafletLoaded(true);
          setStatusMsg("Map ready");
        }
      } catch (err) {
        console.error("Leaflet load failed:", err);
        if (!cancelled) setStatusMsg("Failed to load map");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     Step 2: Load data — real orders first, demo fallback
     ============================================================ */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loaded = await loadOrdersForRouting();
        if (cancelled) return;

        if (loaded && loaded.pickups.length > 0) {
          setDrops(loaded.drops);
          setPickups(loaded.pickups);
          setRiskZones([]);
          setOrderCount(loaded.orderCount);
          setDataSource("orders");
          setStatusMsg(
            `Loaded ${loaded.pickups.length} pickups from ${loaded.orderCount} order(s)`
          );
        } else {
          const s = createDefaultState();
          setDrops(s.drops);
          setPickups(s.pickups);
          setRiskZones(s.riskZones);
          setDataSource("demo");
          setStatusMsg("No orders yet — showing demo data");
        }
      } catch (err) {
        console.error("Load orders failed:", err);
        if (cancelled) return;
        const s = createDefaultState();
        setDrops(s.drops);
        setPickups(s.pickups);
        setRiskZones(s.riskZones);
        setDataSource("demo");
        setStatusMsg("Could not load orders — showing demo data");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     Step 3: Init map once Leaflet is loaded
     ============================================================ */
  useEffect(() => {
    if (!leafletLoaded || !containerRef.current || mapRef.current) return;

    let mounted = true;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !containerRef.current) return;

      const bounds: LatLngBoundsExpression = [
        [BOUNDS_DEHRADUN.south, BOUNDS_DEHRADUN.west],
        [BOUNDS_DEHRADUN.north, BOUNDS_DEHRADUN.east],
      ];

      const map = L.map(containerRef.current, {
        maxBounds: bounds,
        minZoom: 11,
        zoomControl: true,
      }).setView([30.3243, 78.0415], 12);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Tiles © Esri",
        }
      ).addTo(map);

      const layer = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerRef.current = layer;

      // Handle resize
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, [leafletLoaded]);

  /* ============================================================
     Step 4: Map click handler
     ============================================================ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: { latlng: { lat: number; lng: number } }) => {
      const { lat, lng } = e.latlng;
      if (
        lat < BOUNDS_DEHRADUN.south ||
        lat > BOUNDS_DEHRADUN.north ||
        lng < BOUNDS_DEHRADUN.west ||
        lng > BOUNDS_DEHRADUN.east
      ) {
        setStatusMsg("Outside service area. Click closer to the city.");
        return;
      }

      if (mode === "drop") {
        if (drops.length >= 4) {
          setStatusMsg("Demo limit: 4 drop points.");
          return;
        }
        setDrops((prev) => [
          ...prev,
          { name: `Drop ${letter(prev.length)}`, lat, lng },
        ]);
      } else if (mode === "risk") {
        if (riskZones.length >= 6) {
          setStatusMsg("Demo limit: 6 risk zones.");
          return;
        }
        setRiskZones((prev) => [...prev, { lat, lng }]);
      } else {
        if (pickups.length >= 15) {
          setStatusMsg("Demo limit: 15 pickups.");
          return;
        }
        setPickups((prev) => [
          ...prev,
          {
            name: `Pickup ${prev.length + 1}`,
            lat,
            lng,
            kg: 300,
            crop: CROPS_ROUTE[0].name,
            pricePerKg: CROPS_ROUTE[0].pricePerKg,
            dropIndex: 0,
          },
        ]);
      }
    };

    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [leafletLoaded, mode, drops.length, riskZones.length, pickups.length]);

  /* ============================================================
     Step 5: Run optimizer whenever inputs change
     ============================================================ */
  useEffect(() => {
    if (!drops.length || !pickups.length) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setBusy(true);

    optimizeRoutes({
      drops,
      pickups,
      riskZones,
      truckCapacityKg: truckCap,
      costPerKm,
      preferSafe,
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setStatusMsg(
          r.usedLiveRoadData
            ? "Live OSRM road data connected"
            : "OSRM unreachable — using straight-line estimates"
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Optimize failed:", err);
        setStatusMsg("Optimization failed");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [drops, pickups, riskZones, truckCap, costPerKm, preferSafe]);

  /* ============================================================
     Step 6: Render routes on map
     ============================================================ */
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !result) return;

    (async () => {
      const L = (await import("leaflet")).default;
      layer.clearLayers();

      // Risk zones
      riskZones.forEach((z, i) => {
        L.circle([z.lat, z.lng], {
          radius: 150,
          color: "#c0392b",
          fillOpacity: 0.25,
          weight: 2,
        })
          .addTo(layer)
          .bindPopup(
            `<b>Risk zone #${i + 1}</b><br><small>Click to dismiss</small>`
          );
      });

      // Drop markers
      drops.forEach((d, i) => {
        L.marker([d.lat, d.lng], {
          icon: L.divIcon({
            className: "",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            html: `<div style="width:28px;height:28px;border-radius:50%;background:#1d2a24;color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${letter(i)}</div>`,
          }),
        })
          .addTo(layer)
          .bindPopup(`<b>Drop ${letter(i)}</b><br>${d.name}`);
      });

      // Truck polylines + stop markers
      result.trucks.forEach((t) => {
        if (t.polyline.length > 1) {
          L.polyline(t.polyline, {
            color: t.color,
            weight: 5,
            opacity: 0.85,
          }).addTo(layer);
        }

        t.stops.forEach((stop, idx) => {
          L.marker([stop.lat, stop.lng], {
            icon: L.divIcon({
              className: "",
              iconSize: [26, 26],
              iconAnchor: [13, 13],
              html: `<div style="width:26px;height:26px;border-radius:50%;background:${t.color};color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${idx + 1}</div>`,
            }),
          })
            .addTo(layer)
            .bindPopup(
              `<b>${stop.name}</b><br>${stop.crop} · ${stop.kg} kg @ ₹${stop.pricePerKg}/kg<br><small>Truck ${t.truckNumber}, stop ${idx + 1}</small>`
            );
        });
      });

      // Fit bounds to show all markers
      if (result.trucks.length > 0) {
        const allPts: [number, number][] = [];
        drops.forEach((d) => allPts.push([d.lat, d.lng]));
        result.trucks.forEach((t) =>
          t.stops.forEach((s) => allPts.push([s.lat, s.lng]))
        );
        if (allPts.length > 0 && mapRef.current) {
          try {
            mapRef.current.fitBounds(L.latLngBounds(allPts).pad(0.15));
          } catch {
            /* ignore */
          }
        }
      }
    })();
  }, [result, riskZones, drops]);

  /* ============================================================
     Handlers (defined with useCallback)
     ============================================================ */
  const resetAll = useCallback(() => {
    const s = createDefaultState();
    setDrops(s.drops);
    setPickups(s.pickups);
    setRiskZones(s.riskZones);
    setDataSource("demo");
    setStatusMsg("Reset to demo data");
  }, []);

  const updatePickup = useCallback((i: number, patch: Partial<PickupPoint>) => {
    setPickups((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    );
  }, []);

  const removePickup = useCallback((i: number) => {
    setPickups((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const addPresetDrop = useCallback(
    (presetIndex: number) => {
      const p = PRESET_PLACES[presetIndex];
      if (!p) return;
      if (drops.length >= 4) {
        setStatusMsg("Demo limit: 4 drop points.");
        return;
      }
      setDrops((prev) => [...prev, { ...p }]);
    },
    [drops.length]
  );

  const removeDrop = useCallback(
    (i: number) => {
      if (drops.length < 2) {
        setStatusMsg("Keep at least one drop point.");
        return;
      }
      setDrops((prev) => prev.filter((_, idx) => idx !== i));
      setPickups((prev) =>
        prev.map((p) => ({
          ...p,
          dropIndex:
            p.dropIndex === i
              ? 0
              : p.dropIndex > i
                ? p.dropIndex - 1
                : p.dropIndex,
        }))
      );
    },
    [drops.length]
  );

  const addSampleRiskZone = useCallback(() => {
    const line = result?.trucks[0]?.polyline;
    if (!line || line.length === 0) {
      setStatusMsg("Wait for routes to finish first.");
      return;
    }
    if (riskZones.length >= 6) {
      setStatusMsg("Demo limit: 6 risk zones.");
      return;
    }
    const mid = line[Math.floor(line.length / 2)];
    setRiskZones((prev) => [...prev, { lat: mid[0], lng: mid[1] }]);
  }, [result, riskZones.length]);

  /* ============================================================
     Render
     ============================================================ */
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      {/* ============ MAP ============ */}
      <div className="relative min-h-[500px] overflow-hidden rounded-[24px] border border-[#E4EBE6] bg-[#F8F9FA] lg:min-h-[700px]">
        <div ref={containerRef} className="h-full min-h-[500px] w-full lg:min-h-[700px]" />

        {!leafletLoaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F8F9FA]">
            <div className="flex flex-col items-center gap-2">
              <ButtonSpinner size={28} />
              <p className="text-sm text-[#6B7A74]">Loading map…</p>
            </div>
          </div>
        )}

        {/* Status pill */}
        <div className="pointer-events-none absolute left-4 top-4 z-[400] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-md backdrop-blur">
          <span
            className={`h-2 w-2 rounded-full ${
              busy ? "animate-pulse bg-[#B26A00]" : "bg-[#2E7D32]"
            }`}
          />
          <span className="text-[11px] font-medium text-[#0F1F1A]">
            {busy ? "Optimizing…" : statusMsg}
          </span>
        </div>

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-[400] rounded-xl border border-[#E4EBE6] bg-white/95 p-3 shadow-md backdrop-blur">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#6B7A74]">
            Legend
          </p>
          <div className="space-y-1 text-[10px] text-[#0F1F1A]">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#1d2a24]" />
              Drop point
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#d1495b]" />
              Pickup stop
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#c0392b]/30 ring-1 ring-[#c0392b]" />
              Risk zone
            </div>
          </div>
        </div>
      </div>

      {/* ============ SIDEBAR ============ */}
      <aside className="space-y-4">
        {/* Intro */}
        <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
          <h2 className="font-display text-lg font-bold text-[#1B4D3E]">
            Route Optimization
          </h2>
          <p className="mt-1 text-xs text-[#6B7A74]">
            Plan truck pickups from farms to drop points. Fewer trucks, shorter
            routes, safer roads.
          </p>

          {dataSource === "loading" && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#6B7A74]">
              <ButtonSpinner size={12} /> Loading confirmed orders…
            </p>
          )}

          {dataSource === "orders" && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#EAF5EE] px-2.5 py-1.5 text-[11px] font-medium text-[#2E7D32]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32]" />
              Live orders · {orderCount} confirmed · {pickups.length} pickups
            </p>
          )}

          {dataSource === "demo" && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#FFF8E1] px-2.5 py-1.5 text-[11px] font-medium text-[#B26A00]">
              ⓘ No confirmed orders — showing demo data
            </p>
          )}
        </div>

        {/* Settings */}
        <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            Settings
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-[#0F1F1A]">
              Truck cap. (kg)
              <input
                type="number"
                value={truckCap}
                min={100}
                step={50}
                onChange={(e) => setTruckCap(Number(e.target.value) || 800)}
                className="mt-1.5 w-full rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
              />
            </label>
            <label className="text-xs font-medium text-[#0F1F1A]">
              Cost (₹/km)
              <input
                type="number"
                value={costPerKm}
                min={1}
                onChange={(e) => setCostPerKm(Number(e.target.value) || 14)}
                className="mt-1.5 w-full rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
              />
            </label>
          </div>

          <label className="mt-3 block text-xs font-medium text-[#0F1F1A]">
            Route preference
            <select
              value={preferSafe ? "safe" : "fast"}
              onChange={(e) => setPreferSafe(e.target.value === "safe")}
              className="mt-1.5 w-full rounded-lg border border-[#E4EBE6] bg-white px-3 py-2 text-sm outline-none focus:border-[#2E7D32]"
            >
              <option value="safe">Safest — avoid risk zones</option>
              <option value="fast">Fastest — shortest roads</option>
            </select>
          </label>

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            Click mode
          </p>
          <div className="mt-2 space-y-1">
            {(
              [
                { key: "pickup", label: "Add pickup point" },
                { key: "drop", label: "Add drop point" },
                { key: "risk", label: "Mark risk zone" },
              ] as const
            ).map((m) => (
              <label
                key={m.key}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#0F1F1A] transition-colors hover:bg-[#F8F9FA]"
              >
                <input
                  type="radio"
                  name="mode"
                  checked={mode === m.key}
                  onChange={() => setMode(m.key)}
                  className="accent-[#1B4D3E]"
                />
                {m.label}
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setStatusMsg("Re-running optimization…")}
              disabled={busy}
              className="flex-1 rounded-full bg-[#1B4D3E] px-4 py-2.5 text-xs font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              Re-optimize
            </button>
            <button
              onClick={resetAll}
              className="rounded-full border border-[#1B4D3E] px-4 py-2.5 text-xs font-semibold text-[#1B4D3E] transition-colors hover:bg-[#EAF5EE]"
            >
              Reset
            </button>
          </div>

          <button
            onClick={addSampleRiskZone}
            className="mt-3 w-full rounded-full border border-[#C8E6C9] bg-[#EAF5EE] px-4 py-2.5 text-xs font-medium text-[#2E7D32]"
          >
            Add a sample risk zone
          </button>
        </div>

        {/* KPIs */}
        {result && (
          <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
              Impact summary
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Kpi
                value={inr(result.costSaved)}
                label={`Cost saved (${result.savingsPercent}%)`}
                highlight
              />
              <Kpi
                value={`${result.trucks.length} truck${
                  result.trucks.length === 1 ? "" : "s"
                }`}
                label={`Instead of ${pickups.length} solo trips`}
              />
              <Kpi
                value={`${result.totalKmAfter.toFixed(0)} km`}
                label={`Planned (was ${result.totalKmBefore.toFixed(0)} km)`}
              />
              <Kpi
                value={
                  riskZones.length === 0
                    ? "No zones"
                    : result.riskHits === 0
                      ? "All clear"
                      : `${result.riskHits} hits`
                }
                label={
                  riskZones.length === 0
                    ? "Mark zones to test safety"
                    : `${riskZones.length} risk zone${
                        riskZones.length === 1 ? "" : "s"
                      }`
                }
              />
            </div>
          </div>
        )}

        {/* Trucks */}
        {result && result.trucks.length > 0 && (
          <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
              Planned trucks
            </p>
            <div className="mt-3 space-y-2">
              {result.trucks.map((t) => (
                <div
                  key={t.truckNumber}
                  className="rounded-xl border-l-4 bg-[#F8F9FA] p-3"
                  style={{ borderLeftColor: t.color }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#0F1F1A]">
                      Truck {t.truckNumber} → Drop {letter(t.dropIndex)}
                    </p>
                    <span className="text-[10px] font-medium text-[#6B7A74]">
                      {t.totalKg} kg
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#6B7A74]">
                    {t.stops.map((s) => s.name).join(" → ")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[#6B7A74]">
                    <span>{t.totalKm.toFixed(1)} km</span>
                    <span>·</span>
                    <span>{Math.round(t.totalMin)} min</span>
                    <span>·</span>
                    <span className="font-medium text-[#1B4D3E]">
                      {inr(t.cost)}
                    </span>
                    {t.riskHits > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-[#C62828]">
                          ⚠ {t.riskHits} risk hit
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pickups editor */}
        <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            Pickups ({pickups.length})
          </p>
          <div className="mt-3 space-y-2">
            {pickups.map((p, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#E4EBE6] bg-[#FAFCFA] p-2.5"
              >
                <div className="flex gap-2">
                  <input
                    value={p.name}
                    onChange={(e) => updatePickup(i, { name: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-[#E4EBE6] px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => removePickup(i)}
                    className="rounded-lg bg-[#FFF5F5] px-2 py-1 text-xs text-[#C62828] hover:bg-[#FFCDD2]"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                  <input
                    type="number"
                    value={p.kg}
                    onChange={(e) =>
                      updatePickup(i, { kg: Number(e.target.value) || 0 })
                    }
                    className="rounded-lg border border-[#E4EBE6] px-2 py-1"
                  />
                  <input
                    type="number"
                    value={p.pricePerKg}
                    onChange={(e) =>
                      updatePickup(i, {
                        pricePerKg: Number(e.target.value) || 0,
                      })
                    }
                    className="rounded-lg border border-[#E4EBE6] px-2 py-1"
                  />
                  <select
                    value={p.dropIndex}
                    onChange={(e) =>
                      updatePickup(i, { dropIndex: Number(e.target.value) })
                    }
                    className="rounded-lg border border-[#E4EBE6] bg-white px-2 py-1"
                  >
                    {drops.map((d, di) => (
                      <option key={di} value={di}>
                        {letter(di)} · {d.name.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {pickups.length === 0 && (
              <p className="py-3 text-center text-xs text-[#6B7A74]">
                No pickups yet. Choose a mode and click the map.
              </p>
            )}
          </div>
        </div>

        {/* Drops editor */}
        <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
            Drop points ({drops.length})
          </p>
          <div className="mt-3 space-y-2">
            {drops.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d2a24] text-[11px] font-bold text-white">
                  {letter(i)}
                </span>
                <input
                  value={d.name}
                  onChange={(e) =>
                    setDrops((prev) =>
                      prev.map((x, idx) =>
                        idx === i ? { ...x, name: e.target.value } : x
                      )
                    )
                  }
                  className="min-w-0 flex-1 rounded-lg border border-[#E4EBE6] px-2 py-1 text-xs"
                />
                <button
                  onClick={() => removeDrop(i)}
                  className="rounded-lg bg-[#FFF5F5] px-2 py-1 text-xs text-[#C62828] hover:bg-[#FFCDD2]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <select
            value=""
            onChange={(e) => {
              const idx = Number(e.target.value);
              if (!isNaN(idx) && e.target.value !== "") addPresetDrop(idx);
            }}
            className="mt-3 w-full rounded-lg border border-[#E4EBE6] bg-white px-3 py-2 text-xs"
          >
            <option value="">+ Add preset drop point…</option>
            {PRESET_PLACES.map((p, i) => (
              <option key={i} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Farmer net realization */}
        {result && result.realizations.length > 0 && (
          <div className="rounded-[20px] border border-[#E4EBE6] bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
              Farmer net realization
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead className="text-[#6B7A74]">
                  <tr className="border-b border-[#E4EBE6]">
                    <th className="pb-2 text-left font-medium">Pickup</th>
                    <th className="pb-2 text-right font-medium">Sale</th>
                    <th className="pb-2 text-right font-medium">Transport</th>
                    <th className="pb-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {result.realizations.map((r, i) => (
                    <tr key={i} className="border-b border-[#F0F3F1]">
                      <td className="py-1.5 text-left">{r.pickupName}</td>
                      <td className="py-1.5 text-right">
                        {inr(r.grossRevenue)}
                      </td>
                      <td className="py-1.5 text-right text-[#C62828]">
                        −{inr(r.transportShare)}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-[#1B4D3E]">
                        {inr(r.netRealization)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Kpi({
  value,
  label,
  highlight,
}: {
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        highlight ? "bg-[#1B4D3E] text-white" : "bg-[#F8F9FA]"
      }`}
    >
      <p
        className={`font-display text-base font-bold ${
          highlight ? "text-white" : "text-[#1B4D3E]"
        }`}
      >
        {value}
      </p>
      <p
        className={`mt-0.5 text-[10px] ${
          highlight ? "text-[#A5D6A7]" : "text-[#6B7A74]"
        }`}
      >
        {label}
      </p>
    </div>
  );
}