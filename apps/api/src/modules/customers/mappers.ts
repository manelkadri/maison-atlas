import type { Customer, CustomerSummary, Order } from "@fashion/types";
import type { Customer as CustomerRow } from "@prisma/client";

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    ...(row.email ? { email: row.email } : {}),
    wilayaCode: row.wilayaCode,
    commune: row.commune,
    address: row.address,
    isGuest: row.isGuest,
    createdAt: row.createdAt.toISOString(),
  };
}

export type CustomerStats = { ordersCount: number; totalSpent: number; lastOrderAt: Date | null };

export const EMPTY_STATS: CustomerStats = { ordersCount: 0, totalSpent: 0, lastOrderAt: null };

export function toCustomerSummary(row: CustomerRow, stats: CustomerStats): CustomerSummary {
  return {
    ...toCustomer(row),
    ordersCount: stats.ordersCount,
    totalSpent: stats.totalSpent,
    lastOrderAt: stats.lastOrderAt ? stats.lastOrderAt.toISOString() : null,
  };
}

/** Mêmes règles que l'agrégation SQL, appliquées à des commandes déjà chargées (fiche détaillée). */
export function statsFromOrders(orders: Order[]): CustomerStats {
  let lastOrderAt: Date | null = null;
  let totalSpent = 0;
  for (const o of orders) {
    const at = new Date(o.createdAt);
    if (!lastOrderAt || at > lastOrderAt) lastOrderAt = at;
    // Total des achats = commandes LIVRÉES uniquement (COD : seul le livré est encaissé), hors livraison.
    if (o.status === "delivered") totalSpent += o.subtotal - o.discountTotal;
  }
  return { ordersCount: orders.length, totalSpent, lastOrderAt };
}
