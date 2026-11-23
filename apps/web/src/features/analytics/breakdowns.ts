import { filterOrdersByPeriod, orderCost, orderRevenue } from "@/features/analytics/compute";
import type { AnalyticsPeriod } from "@/types/analytics.types";
import type { Order } from "@/types/order.types";

/**
 * Calculs complémentaires de la page Statistiques (purs). Mêmes définitions que `compute.ts` :
 * - chiffre d'affaires = commandes LIVRÉES, remises déduites, hors livraison ;
 * - bénéfice brut = chiffre d'affaires - coût d'achat des marchandises vendues.
 *
 * Les lignes produit utilisent les prix figés dans les commandes livrées, AVANT remise par code promo
 * (la remise est appliquée à la commande entière, pas à une ligne).
 */

export type ProductMargin = {
  productId: string;
  name: string;
  unitsSold: number;
  /** Ventes de la ligne (prix figé × quantité), avant remise code promo. */
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  averageSellingPrice: number;
  averageUnitCost: number;
  /** grossProfit / revenue (0 si pas de vente). */
  marginRate: number;
};

export function buildProductMargins(orders: Order[], period: AnalyticsPeriod, now: Date = new Date()): ProductMargin[] {
  const map = new Map<string, { name: string; units: number; revenue: number; cost: number }>();
  for (const o of filterOrdersByPeriod(orders, period, now)) {
    if (o.status !== "delivered") continue;
    for (const it of o.items) {
      const cur = map.get(it.productId) ?? { name: it.productName, units: 0, revenue: 0, cost: 0 };
      cur.units += it.quantity;
      cur.revenue += it.lineTotal;
      cur.cost += it.unitCost * it.quantity;
      map.set(it.productId, cur);
    }
  }
  return [...map]
    .map<ProductMargin>(([productId, v]) => ({
      productId,
      name: v.name,
      unitsSold: v.units,
      revenue: v.revenue,
      costOfGoods: v.cost,
      grossProfit: v.revenue - v.cost,
      averageSellingPrice: v.units ? Math.round(v.revenue / v.units) : 0,
      averageUnitCost: v.units ? Math.round(v.cost / v.units) : 0,
      marginRate: v.revenue > 0 ? (v.revenue - v.cost) / v.revenue : 0,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

export type DeliveredTopProduct = { productId: string; name: string; unitsSold: number; revenue: number };

/** Produits les plus vendus parmi les commandes LIVRÉES (cohérent avec la définition du chiffre d'affaires). */
export function buildDeliveredTopProducts(orders: Order[], period: AnalyticsPeriod, limit = 6, now: Date = new Date()): DeliveredTopProduct[] {
  return buildProductMargins(orders, period, now)
    .map(({ productId, name, unitsSold, revenue }) => ({ productId, name, unitsSold, revenue }))
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .slice(0, limit);
}

/** Contrôle de cohérence : CA et coût recalculés depuis les commandes (même formules que buildReport). */
export function sumRevenueAndCost(orders: Order[]): { revenue: number; cost: number } {
  return { revenue: orders.reduce((s, o) => s + orderRevenue(o), 0), cost: orders.reduce((s, o) => s + orderCost(o), 0) };
}
