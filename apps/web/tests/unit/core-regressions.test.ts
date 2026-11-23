import { beforeEach, describe, expect, it } from "vitest";
import { buildCategoryBreakdown, buildReport, buildTopProducts } from "@/features/analytics/compute";
import { inventoryService, orderService, productService } from "@/services";
import { getDb, resetDb } from "@/services/mock/db";

beforeEach(() => resetDb());

describe("statistiques : cohérence avec la définition du chiffre d'affaires", () => {
  it("les produits les plus vendus ne comptent que les commandes livrées", () => {
    const { orders } = getDb();
    const top = buildTopProducts(orders, 50);
    const delivered = new Map<string, number>();
    for (const o of orders.filter((x) => x.status === "delivered")) {
      for (const it of o.items) delivered.set(it.productId, (delivered.get(it.productId) ?? 0) + it.quantity);
    }
    for (const t of top) expect(t.unitsSold).toBe(delivered.get(t.productId));
  });

  it("la somme du CA par catégorie égale le CA global (remises réparties au prorata)", () => {
    const db = getDb();
    const report = buildReport({ orders: db.orders, products: db.products, categories: db.categories, period: "all" });
    const sum = buildCategoryBreakdown(db.orders, db.products, db.categories).reduce((s, c) => s + c.revenue, 0);
    // tolérance d'arrondi : 1 DA par ligne de commande livrée
    const lines = db.orders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.items.length, 0);
    expect(Math.abs(sum - report.revenue)).toBeLessThanOrEqual(lines);
  });

  it("le bénéfice brut est le CA moins le coût des marchandises, jamais confondu avec le CA", () => {
    const db = getDb();
    const r = buildReport({ orders: db.orders, products: db.products, categories: db.categories, period: "all" });
    expect(r.grossProfit).toBe(r.revenue - r.costOfGoods);
    expect(r.grossProfit).toBeLessThan(r.revenue);
    expect(r.grossProfit).toBeGreaterThan(0);
  });
});

describe("services : règles métier corrigées", () => {
  async function pendingOrderId() {
    const [o] = await orderService.getOrders({ status: "pending" });
    return o!.id;
  }

  it("après un échec de livraison puis une nouvelle expédition, le paiement COD redevient « à encaisser »", async () => {
    const [seed] = (await orderService.getOrders({ status: "delivery_failed" }));
    expect(seed).toBeDefined();
    expect(seed!.paymentStatus).toBe("failed");
    const shipped = await orderService.updateOrderStatus(seed!.id, "shipped");
    expect(shipped.paymentStatus).toBe("pending");
    const delivered = await orderService.updateOrderStatus(seed!.id, "delivered");
    expect(delivered.paymentStatus).toBe("paid");
  });

  it("une commande refusée restitue le stock de chaque variante et l'historise", async () => {
    const id = await pendingOrderId();
    const order = (await orderService.getOrderById(id))!;
    const before = new Map<string, number>();
    for (const it of order.items) before.set(it.variantId, (await productService.getProductById(it.productId))!.variants.find((v) => v.id === it.variantId)!.stock);

    await orderService.updateOrderStatus(id, "rejected", "Client injoignable");

    for (const it of order.items) {
      const after = (await productService.getProductById(it.productId))!.variants.find((v) => v.id === it.variantId)!.stock;
      expect(after).toBe((before.get(it.variantId) ?? 0) + it.quantity);
    }
    const moves = await inventoryService.getMovements({ productId: order.items[0]!.productId });
    expect(moves.some((m) => m.type === "return" && m.reference === order.orderNumber)).toBe(true);
  });

  it("refuse les mouvements de stock dans le futur et les ajustements sans effet", async () => {
    const [item] = await inventoryService.getInventory({ status: "available" });
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    await expect(
      inventoryService.recordMovement({ variantId: item!.variantId, type: "in", quantity: 3, reason: "test", date: future }),
    ).rejects.toThrow(/futur/);
    await expect(
      inventoryService.recordMovement({ variantId: item!.variantId, type: "adjustment", quantity: item!.stock, reason: "test" }),
    ).rejects.toThrow(/ne change pas/);
  });

  it("filtre par date de commande en heure locale (jour entier inclus)", async () => {
    const [o] = await orderService.getOrders();
    const d = new Date(o!.createdAt);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const found = await orderService.getOrders({ dateFrom: day, dateTo: day });
    expect(found.map((x) => x.id)).toContain(o!.id);
  });
});
