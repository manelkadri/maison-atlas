import { FAILED_STATUSES, getWilaya } from "@fashion/shared";
import type { CustomerSummary } from "@/types/customer.types";
import type { Order } from "@/types/order.types";

export const CUSTOMERS_PAGE_SIZE = 15;

export type CustomerSort = "spent_desc" | "orders_desc" | "last_order_desc" | "name";

export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  spent_desc: "Total des achats",
  orders_desc: "Nombre de commandes",
  last_order_desc: "Dernière commande",
  name: "Nom (A-Z)",
};

export const customerName = (c: Pick<CustomerSummary, "firstName" | "lastName">) => `${c.firstName} ${c.lastName}`.trim();

export function getWilayaName(code: string): string {
  return getWilaya(code)?.name ?? code;
}

export function filterCustomers(customers: CustomerSummary[], opts: { search?: string; wilayaCode?: string }): CustomerSummary[] {
  const q = opts.search?.trim().toLowerCase();
  const digits = q?.replace(/\D/g, "");
  return customers.filter((c) => {
    if (opts.wilayaCode && opts.wilayaCode !== "all" && c.wilayaCode !== opts.wilayaCode) return false;
    if (!q) return true;
    const text = `${customerName(c)} ${c.email ?? ""}`.toLowerCase();
    if (text.includes(q)) return true;
    return !!digits && c.phone.replace(/\D/g, "").includes(digits);
  });
}

export function sortCustomers(customers: CustomerSummary[], sort: CustomerSort): CustomerSummary[] {
  const copy = [...customers];
  switch (sort) {
    case "spent_desc":
      return copy.sort((a, b) => b.totalSpent - a.totalSpent || b.ordersCount - a.ordersCount);
    case "orders_desc":
      return copy.sort((a, b) => b.ordersCount - a.ordersCount || b.totalSpent - a.totalSpent);
    case "last_order_desc":
      return copy.sort((a, b) => (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? ""));
    case "name":
      return copy.sort((a, b) => customerName(a).localeCompare(customerName(b), "fr"));
  }
}

/** Wilayas présentes chez les clients (liste du filtre dérivée des données). */
export function deriveWilayaOptions(customers: CustomerSummary[]): Array<{ code: string; name: string }> {
  const codes = new Set(customers.map((c) => c.wilayaCode));
  return [...codes].map((code) => ({ code, name: getWilayaName(code) })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export type CustomerStats = {
  ordersCount: number;
  deliveredCount: number;
  /** Somme des commandes livrées, hors livraison. */
  deliveredTotal: number;
  /** Panier moyen = total livré / nombre de commandes livrées. */
  averageBasket: number;
  /** Part de commandes annulées / refusées / échouées / retournées. */
  cancellationRate: number;
};

export function computeCustomerStats(orders: Pick<Order, "status" | "subtotal" | "discountTotal">[]): CustomerStats {
  const delivered = orders.filter((o) => o.status === "delivered");
  const deliveredTotal = delivered.reduce((s, o) => s + o.subtotal - o.discountTotal, 0);
  const failed = orders.filter((o) => FAILED_STATUSES.includes(o.status));
  return {
    ordersCount: orders.length,
    deliveredCount: delivered.length,
    deliveredTotal,
    averageBasket: delivered.length ? Math.round(deliveredTotal / delivered.length) : 0,
    cancellationRate: orders.length ? failed.length / orders.length : 0,
  };
}

export function formatPercent(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits).replace(".", ",")} %`;
}
