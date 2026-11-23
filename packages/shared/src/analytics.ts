import type {
  ActivityEvent,
  AnalyticsPeriod,
  AnalyticsReport,
  CategoryBreakdownItem,
  Category,
  DashboardKpis,
  Order,
  Product,
  StatusBreakdownItem,
  StockMovement,
  TimeSeriesPoint,
  TopProduct,
} from "@fashion/types";
import { formatShortDate } from "./format";
import { FAILED_STATUSES, ORDER_STATUSES, ORDER_STATUS_LABELS } from "./order";
import { getVariantStatus } from "./stock";

/**
 * Calculs statistiques PURS (aucun accès au stockage) à partir des commandes et du catalogue.
 *
 * Définitions — à ne pas confondre :
 *  - Chiffre d'affaires (CA) : somme des ventes des commandes LIVRÉES, remises déduites, hors frais de livraison.
 *  - Bénéfice brut : CA − coût d'achat des marchandises vendues (prix d'achat × quantité).
 *  - Bénéfice net : NON calculable ici (loyer, salaires, publicité, frais de livraison... ne sont pas connus).
 */

const DAY = 24 * 3600 * 1000;

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  "12m": "12 derniers mois",
  all: "Depuis le début",
};

export function periodStart(period: AnalyticsPeriod, now: Date): Date | null {
  switch (period) {
    case "7d": return new Date(now.getTime() - 7 * DAY);
    case "30d": return new Date(now.getTime() - 30 * DAY);
    case "90d": return new Date(now.getTime() - 90 * DAY);
    case "12m": return new Date(now.getTime() - 365 * DAY);
    case "all": return null;
  }
}

/** CA d'une commande : ventes livrées nettes de remise, sans la livraison. */
export const orderRevenue = (o: Order): number => (o.status === "delivered" ? o.subtotal - o.discountTotal : 0);
export const orderCost = (o: Order): number => (o.status === "delivered" ? o.items.reduce((s, it) => s + it.unitCost * it.quantity, 0) : 0);

export function filterOrdersByPeriod(orders: Order[], period: AnalyticsPeriod, now: Date): Order[] {
  const start = periodStart(period, now);
  return start ? orders.filter((o) => new Date(o.createdAt) >= start) : orders;
}

type Bucket = "day" | "week" | "month";

function bucketFor(period: AnalyticsPeriod): Bucket {
  if (period === "7d" || period === "30d") return "day";
  if (period === "90d") return "week";
  return "month";
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function bucketKey(date: Date, bucket: Bucket): { key: string; start: Date; label: string } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (bucket === "week") {
    const weekday = (d.getUTCDay() + 6) % 7; // lundi = 0
    d.setUTCDate(d.getUTCDate() - weekday);
  }
  if (bucket === "month") d.setUTCDate(1);
  const iso = d.toISOString();
  const label = bucket === "month" ? `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear() % 100}` : formatShortDate(iso);
  return { key: iso.slice(0, 10), start: d, label };
}

function nextBucket(d: Date, bucket: Bucket): Date {
  const n = new Date(d);
  if (bucket === "day") n.setUTCDate(n.getUTCDate() + 1);
  else if (bucket === "week") n.setUTCDate(n.getUTCDate() + 7);
  else n.setUTCMonth(n.getUTCMonth() + 1);
  return n;
}

/** Série temporelle continue (les périodes sans vente apparaissent à 0). */
export function buildSeries(orders: Order[], period: AnalyticsPeriod, now: Date): TimeSeriesPoint[] {
  const bucket = bucketFor(period);
  const startBound = periodStart(period, now);
  const first = startBound ?? (orders.length ? new Date(Math.min(...orders.map((o) => new Date(o.createdAt).getTime()))) : now);
  const map = new Map<string, TimeSeriesPoint>();

  let cursor = bucketKey(first, bucket).start;
  const end = bucketKey(now, bucket).start;
  while (cursor <= end) {
    const { key, label } = bucketKey(cursor, bucket);
    map.set(key, { label, date: cursor.toISOString(), revenue: 0, orders: 0 });
    cursor = nextBucket(cursor, bucket);
  }
  for (const o of orders) {
    const point = map.get(bucketKey(new Date(o.createdAt), bucket).key);
    if (!point) continue;
    point.orders += 1;
    point.revenue += orderRevenue(o);
  }
  return [...map.values()];
}

export function buildStatusBreakdown(orders: Order[]): StatusBreakdownItem[] {
  return ORDER_STATUSES.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    count: orders.filter((o) => o.status === status).length,
  })).filter((s) => s.count > 0);
}

export function buildTopProducts(orders: Order[], limit = 5): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const o of orders) {
    // Cohérent avec le CA : seules les commandes LIVRÉES comptent comme ventes.
    if (o.status !== "delivered") continue;
    const ratio = o.subtotal > 0 ? (o.subtotal - o.discountTotal) / o.subtotal : 1; // remise répartie au prorata
    for (const it of o.items) {
      const cur = map.get(it.productId) ?? { productId: it.productId, name: it.productName, imageUrl: it.imageUrl, unitsSold: 0, revenue: 0 };
      cur.unitsSold += it.quantity;
      cur.revenue += Math.round(it.lineTotal * ratio);
      map.set(it.productId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, limit);
}

export function buildCategoryBreakdown(orders: Order[], products: Product[], categories: Category[]): CategoryBreakdownItem[] {
  const productCat = new Map(products.map((p) => [p.id, p.categoryId]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const map = new Map<string, CategoryBreakdownItem>();
  for (const o of orders) {
    if (o.status !== "delivered") continue;
    const ratio = o.subtotal > 0 ? (o.subtotal - o.discountTotal) / o.subtotal : 1; // remise répartie au prorata
    for (const it of o.items) {
      let cat = catById.get(productCat.get(it.productId) ?? "");
      // On remonte à la catégorie racine (Femme, Accessoires) pour une lecture synthétique.
      while (cat?.parentId) cat = catById.get(cat.parentId) ?? cat;
      if (!cat) continue;
      const cur = map.get(cat.id) ?? { categoryId: cat.id, name: cat.name, revenue: 0, unitsSold: 0 };
      cur.revenue += Math.round(it.lineTotal * ratio);
      cur.unitsSold += it.quantity;
      map.set(cat.id, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export function buildReport(params: {
  orders: Order[];
  products: Product[];
  categories: Category[];
  period: AnalyticsPeriod;
  now?: Date;
}): AnalyticsReport {
  const now = params.now ?? new Date();
  const orders = filterOrdersByPeriod(params.orders, params.period, now);
  const revenue = orders.reduce((s, o) => s + orderRevenue(o), 0);
  const costOfGoods = orders.reduce((s, o) => s + orderCost(o), 0);
  const grossProfit = revenue - costOfGoods;
  const delivered = orders.filter((o) => o.status === "delivered");
  const cancelled = orders.filter((o) => FAILED_STATUSES.includes(o.status));
  return {
    period: params.period,
    revenue,
    costOfGoods,
    grossProfit,
    grossMarginRate: revenue > 0 ? grossProfit / revenue : 0,
    ordersCount: orders.length,
    deliveredCount: delivered.length,
    averageOrderValue: delivered.length ? Math.round(revenue / delivered.length) : 0,
    cancellationRate: orders.length ? cancelled.length / orders.length : 0,
    series: buildSeries(orders, params.period, now),
    topProducts: buildTopProducts(orders),
    byCategory: buildCategoryBreakdown(orders, params.products, params.categories),
    byStatus: buildStatusBreakdown(orders),
  };
}

export function buildKpis(orders: Order[], products: Product[]): DashboardKpis {
  const activeProducts = products.filter((p) => !p.isArchived);
  return {
    revenue: orders.reduce((s, o) => s + orderRevenue(o), 0),
    ordersCount: orders.length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    deliveredOrders: orders.filter((o) => o.status === "delivered").length,
    productsCount: activeProducts.length,
    outOfStockVariants: activeProducts.reduce((s, p) => s + p.variants.filter((v) => getVariantStatus(v) === "out_of_stock").length, 0),
  };
}

export function buildActivity(orders: Order[], movements: StockMovement[], limit = 8): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...orders.slice(0, 20).map<ActivityEvent>((o) => ({
      id: `act_${o.id}`,
      type: "order",
      message: `Commande ${o.orderNumber} — ${ORDER_STATUS_LABELS[o.status].toLowerCase()} (${o.customer.firstName} ${o.customer.lastName})`,
      at: o.updatedAt,
    })),
    ...movements
      .filter((m) => m.type !== "initial" && m.type !== "sale")
      .slice(0, 20)
      .map<ActivityEvent>((m) => ({
        id: `act_${m.id}`,
        type: "stock",
        message: `${m.quantityDelta > 0 ? "+" : ""}${m.quantityDelta} · ${m.productName} (${m.color}, ${m.size}) — ${m.reason}`,
        at: m.createdAt,
      })),
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
