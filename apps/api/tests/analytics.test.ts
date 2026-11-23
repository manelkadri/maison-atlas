import { buildActivity, buildKpis, buildReport, buildSeries, buildStatusBreakdown, buildTopProducts } from "@fashion/shared";
import type { AnalyticsPeriod } from "@fashion/types";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadDemoData, seedDemo } from "../prisma/seed-demo";
import { getDashboard, getReport } from "../src/modules/analytics";
import { adminAgent, http, prisma, resetDatabase } from "./helpers";
import { makeProduct, orderBody } from "./api2-factories";

beforeEach(resetDatabase);

type Agent = Awaited<ReturnType<typeof adminAgent>>;
const PERIODS: AnalyticsPeriod[] = ["7d", "30d", "90d", "12m", "all"];
const DAY = 86_400_000;

async function place(variantId: string, quantity: number, promoCode?: string) {
  const res = await http().post("/api/orders").send(orderBody([{ variantId, quantity }], promoCode ? { promoCode } : {}));
  expect(res.status).toBe(201);
  return res.body as { id: string };
}
const go = async (agent: Agent, id: string, ...path: string[]) => {
  for (const status of path) expect((await agent.patch(`/api/admin/orders/${id}/status`).send({ status })).status).toBe(200);
};

/** 6 commandes : 2 livrées (dont une avec remise), 1 annulée, 1 refusée, 1 échec de livraison, 1 en attente. */
async function scenario() {
  const product = await makeProduct({ price: 10_000, costPrice: 4_000, variants: [{ stock: 100 }, { stock: 0, color: "Rouge", size: "M" }] });
  const variant = product.variants[0]!;
  await prisma.promotion.create({
    data: { code: "MOINS10", label: "10 %", type: "percentage", value: 10, startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY) },
  });
  const agent = await adminAgent();
  const o1 = await place(variant.id, 2, "MOINS10");
  const o2 = await place(variant.id, 1);
  const o3 = await place(variant.id, 1);
  const o4 = await place(variant.id, 1);
  const o5 = await place(variant.id, 1);
  await place(variant.id, 1);
  const deliver = ["confirmed", "processing", "shipped", "delivered"];
  await go(agent, o1.id, ...deliver);
  await go(agent, o2.id, ...deliver);
  await go(agent, o3.id, "cancelled");
  await go(agent, o4.id, "rejected");
  await go(agent, o5.id, "confirmed", "processing", "shipped", "delivery_failed");
  return { product, variant, agent, ids: [o1.id, o2.id, o3.id, o4.id, o5.id] };
}

describe("analytics — protection et entrées", () => {
  it("exige une session et valide la période", async () => {
    expect((await http().get("/api/admin/analytics/dashboard")).status).toBe(401);
    expect((await http().get("/api/admin/analytics/report")).status).toBe(401);
    const agent = await adminAgent();
    expect((await agent.get("/api/admin/analytics/report").query({ period: "bogus" })).status).toBe(400);
    expect((await agent.get("/api/admin/analytics/report").query({ period: "all" })).status).toBe(200);
  });

  it("fonctionne sur une base vide (zéros, séries continues, pas d'erreur)", async () => {
    const agent = await adminAgent();
    const report = await agent.get("/api/admin/analytics/report").query({ period: "30d" });
    expect(report.status).toBe(200);
    expect(report.body).toMatchObject({ revenue: 0, costOfGoods: 0, grossProfit: 0, grossMarginRate: 0, ordersCount: 0, cancellationRate: 0, averageOrderValue: 0 });
    expect(report.body.series).toHaveLength(31);
    const dash = await agent.get("/api/admin/analytics/dashboard");
    expect(dash.status).toBe(200);
    expect(dash.body.kpis).toEqual({ revenue: 0, ordersCount: 0, pendingOrders: 0, deliveredOrders: 0, productsCount: 0, outOfStockVariants: 0 });
    expect(dash.body.recentOrders).toEqual([]);
  });
});

describe("analytics — chiffres du rapport", () => {
  it("CA = livré hors livraison remise déduite ; bénéfice brut = CA − coût ; taux d'annulation ; panier moyen", async () => {
    const { agent } = await scenario();
    const res = await agent.get("/api/admin/analytics/report").query({ period: "30d" });
    expect(res.status).toBe(200);
    const r = res.body;
    // o1 : 2 × 10 000 − 10 % = 18 000 ; o2 : 10 000 ⇒ 28 000 (les frais de livraison sont exclus).
    expect(r.revenue).toBe(28_000);
    expect(r.costOfGoods).toBe(12_000); // 3 pièces livrées × 4 000
    expect(r.grossProfit).toBe(16_000);
    expect(r.grossMarginRate).toBeCloseTo(16_000 / 28_000, 10);
    expect(r.ordersCount).toBe(6);
    expect(r.deliveredCount).toBe(2);
    expect(r.averageOrderValue).toBe(14_000);
    expect(r.cancellationRate).toBeCloseTo(3 / 6, 10); // annulée + refusée + échec de livraison
    expect(r.period).toBe("30d");
    expect(r.byStatus).toEqual(
      expect.arrayContaining([
        { status: "pending", label: "En attente", count: 1 },
        { status: "delivered", label: "Livrée", count: 2 },
        { status: "cancelled", label: "Annulée", count: 1 },
        { status: "rejected", label: "Refusée", count: 1 },
        { status: "delivery_failed", label: "Échec de livraison", count: 1 },
      ]),
    );
    expect(r.topProducts).toHaveLength(1);
    expect(r.topProducts[0]).toMatchObject({ unitsSold: 3, revenue: 28_000 });
    expect(r.byCategory).toHaveLength(1);
    expect(r.byCategory[0]).toMatchObject({ revenue: 28_000, unitsSold: 3 });
  });

  it("série continue : un point par jour sur 30 j, jours sans vente à 0, totaux conservés", async () => {
    const { agent } = await scenario();
    const { body } = await agent.get("/api/admin/analytics/report").query({ period: "30d" });
    expect(body.series).toHaveLength(31);
    for (let i = 1; i < body.series.length; i++) {
      expect(new Date(body.series[i].date).getTime() - new Date(body.series[i - 1].date).getTime()).toBe(DAY);
    }
    expect(body.series.reduce((s: number, p: { orders: number }) => s + p.orders, 0)).toBe(6);
    expect(body.series.reduce((s: number, p: { revenue: number }) => s + p.revenue, 0)).toBe(28_000);
    expect(body.series.filter((p: { orders: number }) => p.orders === 0).length).toBeGreaterThanOrEqual(29);
    // Autres granularités : semaine (90 j) et mois (12 m / tout).
    expect((await agent.get("/api/admin/analytics/report").query({ period: "7d" })).body.series).toHaveLength(8);
    expect((await agent.get("/api/admin/analytics/report").query({ period: "12m" })).body.series.length).toBeGreaterThanOrEqual(12);
  });

  it("filtre les commandes selon la période", async () => {
    const { agent, ids } = await scenario();
    await prisma.order.update({ where: { id: ids[0]! }, data: { createdAt: new Date(Date.now() - 100 * DAY) } }); // livrée, 18 000
    await prisma.order.update({ where: { id: ids[2]! }, data: { createdAt: new Date(Date.now() - 20 * DAY) } }); // annulée
    const get = async (period: string) => (await agent.get("/api/admin/analytics/report").query({ period })).body;
    expect(await get("7d")).toMatchObject({ ordersCount: 4, revenue: 10_000 });
    expect(await get("30d")).toMatchObject({ ordersCount: 5, revenue: 10_000 });
    expect(await get("90d")).toMatchObject({ ordersCount: 5, revenue: 10_000 });
    expect(await get("12m")).toMatchObject({ ordersCount: 6, revenue: 28_000 });
    expect(await get("all")).toMatchObject({ ordersCount: 6, revenue: 28_000 });
  });
});

describe("analytics — tableau de bord", () => {
  it("renvoie la forme DashboardData avec les bons indicateurs", async () => {
    const { agent, product } = await scenario();
    const { status, body } = await agent.get("/api/admin/analytics/dashboard");
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["activity", "kpis", "outOfStock", "recentOrders", "revenueSeries", "statusBreakdown", "topProducts"]);
    expect(body.kpis).toEqual({ revenue: 28_000, ordersCount: 6, pendingOrders: 1, deliveredOrders: 2, productsCount: 1, outOfStockVariants: 1 });
    expect(body.revenueSeries).toHaveLength(31);
    expect(body.statusBreakdown.reduce((s: number, i: { count: number }) => s + i.count, 0)).toBe(6);
    expect(body.topProducts[0]).toMatchObject({ productId: product.id, unitsSold: 3 });
    expect(body.recentOrders).toHaveLength(6);
    expect(body.recentOrders[0].statusHistory.length).toBeGreaterThan(0); // commandes complètes (historique inclus)
    // Rupture : la variante « Rouge M » (InventoryItem complet).
    expect(body.outOfStock).toEqual([expect.objectContaining({ color: "Rouge", size: "M", stock: 0, status: "out_of_stock", productId: product.id })]);
    // Activité récente : commandes (les mouvements de vente/initiaux sont exclus).
    expect(body.activity.length).toBeGreaterThan(0);
    expect(body.activity.every((e: { type: string }) => e.type === "order" || e.type === "stock")).toBe(true);
  });

  it("les mouvements manuels apparaissent dans l'activité", async () => {
    const { agent, variant } = await scenario();
    await agent.post("/api/admin/inventory/movements").send({ variantId: variant.id, type: "in", quantity: 5, reason: "Réception fournisseur" });
    const { body } = await agent.get("/api/admin/analytics/dashboard");
    expect(body.activity.some((e: { type: string; message: string }) => e.type === "stock" && e.message.includes("Réception fournisseur"))).toBe(true);
  });
});

describe("analytics — mêmes chiffres que l'interface mock sur les mêmes données", () => {
  it("rapport et tableau de bord identiques à `buildReport` & co. appliqués aux données de démonstration", async () => {
    const demo = await loadDemoData(resolve(__dirname, "../../web/src/mocks"));
    await seedDemo(prisma, { data: demo });
    const now = new Date();
    // Mêmes données, mêmes conventions de tri que l'API : commandes les plus récentes d'abord.
    const orders = [...demo.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.orderNumber.localeCompare(a.orderNumber));

    for (const period of PERIODS) {
      const expected = buildReport({ orders, products: demo.products, categories: demo.categories, period, now });
      const actual = await getReport(period, now);
      expect(actual, period).toEqual(expected);
    }

    const dash = await getDashboard(now);
    // Égalités d’horodatage (plusieurs variantes d’un même produit) : départagées par id décroissant, comme l’API.
    const movements = [...demo.movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    expect(dash.kpis).toEqual(buildKpis(orders, demo.products));
    expect(dash.revenueSeries).toEqual(buildSeries(orders.filter((o) => new Date(o.createdAt) >= new Date(now.getTime() - 30 * DAY)), "30d", now));
    expect(dash.statusBreakdown).toEqual(buildStatusBreakdown(orders));
    expect(dash.topProducts).toEqual(buildTopProducts(orders, 5));
    expect(dash.recentOrders).toEqual(orders.slice(0, 8));
    expect(dash.activity).toEqual(buildActivity(orders, movements));

    const outOfStockTotal = demo.products.filter((p) => !p.isArchived).reduce((s, p) => s + p.variants.filter((v) => v.stock <= 0).length, 0);
    expect(dash.kpis.outOfStockVariants).toBe(outOfStockTotal);
    expect(dash.outOfStock).toHaveLength(Math.min(8, outOfStockTotal));
    expect(dash.outOfStock.every((i) => i.status === "out_of_stock" && i.stock === 0)).toBe(true);

    // Les chiffres de la démo sont non triviaux (le test ne compare pas des zéros).
    const all = await getReport("all", now);
    expect(all.revenue).toBeGreaterThan(0);
    expect(all.grossProfit).toBeGreaterThan(0);
    expect(all.grossProfit).toBeLessThan(all.revenue);
    expect(all.cancellationRate).toBeGreaterThan(0);
  });
});
