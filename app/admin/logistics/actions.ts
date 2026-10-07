"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { getDistrictCoords, jitterCoords } from "@/lib/route-ai/districts";
import type {
  DropPoint,
  PickupPoint,
} from "@/lib/route-ai";

export interface LoadedOrderData {
  drops: DropPoint[];
  pickups: PickupPoint[];
  orderCount: number;
}

/**
 * Fetch all confirmed orders (escrow_paid, in_transit, delivered)
 * and convert them into pickups + drops for route optimization.
 */
export async function loadOrdersForRouting(): Promise<LoadedOrderData | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;

  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("transactions")
    .select(
      `
      id,
      quantity_kg,
      gross_amount,
      final_price_per_kg,
      farmer_id,
      buyer_id,
      pool_id,
      listing:listings(crop),
      pool:fpo_pools(crop, fpo_id)
    `
    )
    .in("status", ["escrow_paid", "in_transit", "delivered"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (!orders || orders.length === 0) return null;

  // Collect unique user IDs
  const farmerIds = Array.from(new Set(orders.map((o) => o.farmer_id)));
  const buyerIds = Array.from(new Set(orders.map((o) => o.buyer_id)));
  const poolHeadIds = Array.from(
    new Set(
      orders
        .map((o) => {
          const p = Array.isArray(o.pool) ? o.pool[0] : o.pool;
          return p?.fpo_id;
        })
        .filter(Boolean) as string[]
    )
  );

  const allUserIds = Array.from(
    new Set([...farmerIds, ...buyerIds, ...poolHeadIds])
  );

  const { data: users } = await admin
    .from("profiles")
    .select("id, full_name, district, state, pincode, business_name")
    .in("id", allUserIds);

  const userMap = new Map((users || []).map((u) => [u.id, u]));

  // Build drops (buyer locations)
  const dropMap = new Map<string, number>(); // key = buyer_id → dropIndex
  const drops: DropPoint[] = [];

  // Build pickups
  const pickups: PickupPoint[] = [];

  for (const order of orders) {
    const buyer = userMap.get(order.buyer_id);
    if (!buyer) continue;

    // Get or create drop for this buyer
    let dropIndex = dropMap.get(order.buyer_id);
    if (dropIndex === undefined) {
      const coords = jitterCoords(
        getDistrictCoords(buyer.district, buyer.state, buyer.pincode),
        order.buyer_id
      );
      dropIndex = drops.length;
      dropMap.set(order.buyer_id, dropIndex);
      drops.push({
        name:
          buyer.business_name ||
          `${buyer.full_name} · ${buyer.district ?? ""}`,
        lat: coords.lat,
        lng: coords.lng,
      });
    }

    // Determine pickup source (farmer or FPO head)
    const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing;
    const pool = Array.isArray(order.pool) ? order.pool[0] : order.pool;

    const pickupUserId = pool?.fpo_id ?? order.farmer_id;
    const pickupUser = userMap.get(pickupUserId);
    if (!pickupUser) continue;

    const cropName =
      listing?.crop ?? pool?.crop ?? "Produce";

    const pickCoords = jitterCoords(
      getDistrictCoords(
        pickupUser.district,
        pickupUser.state,
        pickupUser.pincode
      ),
      order.id
    );

    pickups.push({
      name: pool
        ? `${pickupUser.full_name} (FPO) · ${pickupUser.district ?? ""}`
        : `${pickupUser.full_name} · ${pickupUser.district ?? ""}`,
      lat: pickCoords.lat,
      lng: pickCoords.lng,
      kg: Number(order.quantity_kg),
      crop: cropName,
      pricePerKg: Number(order.final_price_per_kg),
      dropIndex,
    });
  }

  // Cap for demo performance
  const maxPickups = 15;
  const cappedPickups = pickups.slice(0, maxPickups);
  const usedDropIndexes = new Set(cappedPickups.map((p) => p.dropIndex));

  // Renumber drops to only keep the ones with pickups
  const dropRemap = new Map<number, number>();
  const finalDrops: DropPoint[] = [];
  for (const idx of Array.from(usedDropIndexes).sort((a, b) => a - b)) {
    dropRemap.set(idx, finalDrops.length);
    finalDrops.push(drops[idx]);
  }

  const finalPickups = cappedPickups.map((p) => ({
    ...p,
    dropIndex: dropRemap.get(p.dropIndex) ?? 0,
  }));

  return {
    drops: finalDrops,
    pickups: finalPickups,
    orderCount: orders.length,
  };
}