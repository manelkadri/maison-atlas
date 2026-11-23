import { describe, expect, it } from "vitest";
import { buildDeliveredTopProducts, buildProductMargins } from "@/features/analytics/breakdowns";
import { buildReport, buildSeries } from "@/features/analytics/compute";
import { computeCustomerStats, filterCustomers, formatPercent, sortCustomers } from "@/features/customers/logic";
import type { CustomerSummary } from "@/types/customer.types";
import type { Order, OrderItem, OrderStatus } from "@/types/order.types";
import type { Category, Product } from "@/types/product.types";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

function item(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "oi",
    productId: "p1",
    variantId: "v1",
    productName: "Robe",
    productSlug: "robe",
    sku: "ROBE-NOI-M",
    color: "Noir",
    colorCode: "#000000",
    size: "M",
    imageUrl: "/x.svg",
    unitPrice: 5000,
    unitCost: 2000,
    quantity: 1,
    lineTotal: 5000,
    ...over,
  };
}

function order(id: string, status: OrderStatus, ageDays: number, over: Partial<Order> = {}): Order {
  const items = over.items ?? [item()];
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return {
    id,
    orderNumber: `CMD-2026-${id}`,
    customer: { firstName: "A", lastName: "B", phone: "0555000000" },
    shippingAddress: { wilayaCode: "16", wilayaName: "Alger", commune: "X", address: "Y", deliveryMethod: "home" },
    items,
    subtotal,
    discountTotal: 0,
    shippingFee: 500,
    total: subtotal + 500,
    paymentMethod: "cash_on_delivery",
    paymentStatus: "pending",
    deliveryMethod: "home",
    status,
    statusHistory: [{ status: "pending", at: daysAgo(ageDays) }],
    createdAt: daysAgo(ageDays),
    updatedAt: daysAgo(ageDays),
    ...over,
  };
}

const products = [{ id: "p1", categoryId: "c1" }, { id: "p2", categoryId: "c1" }] as unknown as Product[];
const categories = [{ id: "c1", name: "Femme", parentId: null }] as unknown as Category[];

const orders: Order[] = [
  order("1", "delivered", 2, { items: [item({ quantity: 2, lineTotal: 10000 })], discountTotal: 1000 }), // CA 9 000, coût 4 000
  order("2", "delivered", 5), // CA 5 000, coût 2 000
  order("3", "pending", 1), // ne compte pas dans le CA
  order("4", "shipped", 1), // ne compte pas dans le CA
  order("5", "cancelled", 3),
  order("6", "returned", 4, { paymentStatus: "failed" }),
];

describe("buildReport : définitions", () => {
  const r = buildReport({ orders, products, categories, period: "30d", now: NOW });

  it("chiffre d'affaires = commandes livrées, remises déduites, hors livraison", () => {
    expect(r.revenue).toBe(9000 + 5000);
  });

  it("le bénéfice brut est distinct du chiffre d'affaires (CA − coût d'achat)", () => {
    expect(r.costOfGoods).toBe(4000 + 2000);
    expect(r.grossProfit).toBe(r.revenue - r.costOfGoods);
    expect(r.grossProfit).toBe(8000);
    expect(r.grossProfit).not.toBe(r.revenue);
    expect(r.grossMarginRate).toBeCloseTo(8000 / 14000, 5);
  });

  it("n'expose aucun bénéfice net", () => {
    expect(Object.keys(r).some((k) => /net/i.test(k))).toBe(false);
  });

  it("taux d'annulation = annulées + refusées + échecs + retours sur toutes les commandes", () => {
    expect(r.ordersCount).toBe(6);
    expect(r.cancellationRate).toBeCloseTo(2 / 6, 5);
    expect(r.deliveredCount).toBe(2);
    expect(r.averageOrderValue).toBe(7000);
  });

  it("sans commande : zéros, pas de division par zéro", () => {
    const empty = buildReport({ orders: [], products, categories, period: "7d", now: NOW });
    expect(empty).toMatchObject({ revenue: 0, grossProfit: 0, grossMarginRate: 0, cancellationRate: 0, averageOrderValue: 0, ordersCount: 0 });
  });

  it("respecte la période", () => {
    const week = buildReport({ orders, products, categories, period: "7d", now: NOW });
    expect(week.ordersCount).toBe(6);
    const old = buildReport({ orders: [order("9", "delivered", 40)], products, categories, period: "30d", now: NOW });
    expect(old.ordersCount).toBe(0);
    const all = buildReport({ orders: [order("9", "delivered", 40)], products, categories, period: "all", now: NOW });
    expect(all.revenue).toBe(5000);
  });
});

describe("séries temporelles continues", () => {
  it("30 jours : un point par jour, sans trou, jours sans vente à 0", () => {
    const series = buildSeries(orders, "30d", NOW);
    expect(series).toHaveLength(31);
    for (let i = 1; i < series.length; i++) {
      const gap = new Date(series[i]!.date).getTime() - new Date(series[i - 1]!.date).getTime();
      expect(gap).toBe(DAY);
    }
    expect(series.some((p) => p.revenue === 0)).toBe(true);
    expect(series.reduce((s, p) => s + p.revenue, 0)).toBe(14000);
    expect(series.reduce((s, p) => s + p.orders, 0)).toBe(6);
  });

  it("12 mois : un point par mois, consécutifs", () => {
    const series = buildSeries(orders, "12m", NOW);
    expect(series.length).toBeGreaterThanOrEqual(12);
    for (let i = 1; i < series.length; i++) {
      const a = new Date(series[i - 1]!.date);
      const b = new Date(series[i]!.date);
      expect((b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth()).toBe(1);
    }
  });
});

describe("marge par produit et produits les plus vendus (livré uniquement)", () => {
  const multi: Order[] = [
    order("a", "delivered", 2, { items: [item({ productId: "p1", productName: "Robe", quantity: 3, unitPrice: 5000, unitCost: 2000, lineTotal: 15000 })] }),
    order("b", "delivered", 3, { items: [item({ productId: "p2", productName: "Pull", quantity: 1, unitPrice: 4000, unitCost: 3500, lineTotal: 4000 })] }),
    order("c", "pending", 1, { items: [item({ productId: "p2", productName: "Pull", quantity: 9, lineTotal: 36000 })] }),
  ];

  it("ignore les commandes non livrées et calcule marge, prix moyen et coût", () => {
    const m = buildProductMargins(multi, "30d", NOW);
    expect(m.map((x) => x.productId)).toEqual(["p1", "p2"]); // triés par bénéfice brut décroissant
    const robe = m[0]!;
    expect(robe).toMatchObject({ unitsSold: 3, revenue: 15000, costOfGoods: 6000, grossProfit: 9000, averageSellingPrice: 5000, averageUnitCost: 2000 });
    expect(robe.marginRate).toBeCloseTo(0.6, 5);
    const pull = m[1]!;
    expect(pull.unitsSold).toBe(1); // les 9 unités de la commande en attente sont exclues
    expect(pull.grossProfit).toBe(500);
  });

  it("classe les produits par unités vendues", () => {
    const top = buildDeliveredTopProducts(multi, "30d", 5, NOW);
    expect(top.map((t) => t.productId)).toEqual(["p1", "p2"]);
    expect(top[0]!.unitsSold).toBe(3);
  });
});

describe("indicateurs client", () => {
  it("panier moyen = total livré / commandes livrées ; taux d'annulation personnel", () => {
    const s = computeCustomerStats([
      { status: "delivered", subtotal: 10000, discountTotal: 1000 },
      { status: "delivered", subtotal: 5000, discountTotal: 0 },
      { status: "cancelled", subtotal: 3000, discountTotal: 0 },
      { status: "pending", subtotal: 2000, discountTotal: 0 },
    ]);
    expect(s).toMatchObject({ ordersCount: 4, deliveredCount: 2, deliveredTotal: 14000, averageBasket: 7000 });
    expect(s.cancellationRate).toBeCloseTo(0.25, 5);
    expect(computeCustomerStats([]).averageBasket).toBe(0);
    expect(formatPercent(0.255)).toBe("25,5 %");
  });

  it("recherche par nom / téléphone / e-mail et tri", () => {
    const base = { wilayaCode: "16", commune: "x", address: "y", createdAt: "2026-01-01T00:00:00.000Z", isGuest: false };
    const list: CustomerSummary[] = [
      { ...base, id: "1", firstName: "Amine", lastName: "Benali", phone: "0555 11 22 33", email: "amine@example.com", ordersCount: 2, totalSpent: 5000, lastOrderAt: "2026-05-01T00:00:00.000Z" },
      { ...base, id: "2", firstName: "Sara", lastName: "Kaci", phone: "0661 44 55 66", ordersCount: 5, totalSpent: 1000, lastOrderAt: null, wilayaCode: "31" },
    ];
    expect(filterCustomers(list, { search: "benali" }).map((c) => c.id)).toEqual(["1"]);
    expect(filterCustomers(list, { search: "0661" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterCustomers(list, { search: "example.com" }).map((c) => c.id)).toEqual(["1"]);
    expect(filterCustomers(list, { wilayaCode: "31" }).map((c) => c.id)).toEqual(["2"]);
    expect(sortCustomers(list, "spent_desc").map((c) => c.id)).toEqual(["1", "2"]);
    expect(sortCustomers(list, "orders_desc").map((c) => c.id)).toEqual(["2", "1"]);
    expect(sortCustomers(list, "last_order_desc").map((c) => c.id)).toEqual(["1", "2"]);
  });
});
