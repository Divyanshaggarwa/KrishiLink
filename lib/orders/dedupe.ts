type OrderRecord = {
  id: string;
  offer_id: string | null;
  status: string;
  created_at: string;
};

const STATUS_PRIORITY: Record<string, number> = {
  cancelled: 0,
  escrow_pending: 1,
  escrow_paid: 2,
  in_transit: 3,
  delivered: 4,
  disputed: 5,
  completed: 6,
};

export function dedupeOrders<T extends OrderRecord>(orders: T[]) {
  const byOffer = new Map<string, T>();
  let duplicateCount = 0;

  for (const order of orders) {
    const key = order.offer_id ?? order.id;
    const existing = byOffer.get(key);
    if (!existing) {
      byOffer.set(key, order);
      continue;
    }

    duplicateCount += 1;
    const currentPriority = STATUS_PRIORITY[order.status] ?? -1;
    const existingPriority = STATUS_PRIORITY[existing.status] ?? -1;
    if (
      currentPriority > existingPriority ||
      (currentPriority === existingPriority &&
        order.created_at > existing.created_at)
    ) {
      byOffer.set(key, order);
    }
  }

  return {
    orders: Array.from(byOffer.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    ),
    duplicateCount,
  };
}
