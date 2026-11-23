import { buildActivity, buildKpis, buildReport, buildSeries, buildStatusBreakdown, buildTopProducts, periodStart } from "@fashion/shared";
import type { AnalyticsPeriod, AnalyticsReport } from "@fashion/types";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { movementInclude, toStockMovement } from "../inventory/mappers";
import { listInventory } from "../inventory/service";
import { orderInclude, toOrder } from "../orders/mappers";
import { toAnalyticsProduct, toCategory } from "./mappers";
import type { DashboardData } from "./types";
import { parseQuery } from "../../utils/validate";

/** Module « analytics » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

const DAY = 24 * 3600 * 1000;
const PERIODS = ["7d", "30d", "90d", "12m", "all"] as const satisfies readonly AnalyticsPeriod[];
const reportQuery = z.object({ period: z.enum(PERIODS).default("30d") });

/** Commandes SANS l'historique de statuts (inutile aux calculs), plus récentes d'abord. */
async function loadOrders(since: Date | null) {
  const rows = await prisma.order.findMany({
    where: since ? { createdAt: { gte: since } } : {},
    include: { items: true },
    orderBy: [{ createdAt: "desc" }, { sequence: "desc" }],
  });
  return rows.map(toOrder);
}

/**
 * Tableau de bord. Les chiffres viennent des MÊMES fonctions que l'interface mock (`@fashion/shared/analytics`),
 * appliquées à des données lues en base : CA = commandes livrées, remises déduites, hors livraison.
 */
export async function getDashboard(now: Date = new Date()): Promise<DashboardData> {
  const [orders, products, recentRows, movementRows, outOfStock] = await Promise.all([
    loadOrders(null),
    prisma.product.findMany({ include: { variants: true } }),
    prisma.order.findMany({ include: orderInclude, orderBy: [{ createdAt: "desc" }, { sequence: "desc" }], take: 8 }),
    prisma.stockMovement.findMany({
      where: { type: { notIn: ["initial", "sale"] } },
      include: movementInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
    }),
    listInventory({ status: "out_of_stock" }),
  ]);
  const last30Days = new Date(now.getTime() - 30 * DAY);
  return {
    kpis: buildKpis(orders, products.map(toAnalyticsProduct)),
    revenueSeries: buildSeries(orders.filter((o) => new Date(o.createdAt) >= last30Days), "30d", now),
    statusBreakdown: buildStatusBreakdown(orders),
    topProducts: buildTopProducts(orders, 5),
    recentOrders: recentRows.map(toOrder),
    outOfStock: outOfStock.slice(0, 8),
    activity: buildActivity(orders, movementRows.map(toStockMovement)),
  };
}

export async function getReport(period: AnalyticsPeriod, now: Date = new Date()): Promise<AnalyticsReport> {
  // `buildReport` filtre lui-même sur la période : on ne charge que les commandes utiles (même borne, même résultat).
  const [orders, products, categories] = await Promise.all([
    loadOrders(periodStart(period, now)),
    prisma.product.findMany(),
    prisma.category.findMany(),
  ]);
  return buildReport({ orders, products: products.map(toAnalyticsProduct), categories: categories.map(toCategory), period, now });
}

adminRoutes.get("/dashboard", async (_req, res) => {
  res.json(await getDashboard());
});

adminRoutes.get("/report", async (req, res) => {
  const { period } = parseQuery(reportQuery, req);
  res.json(await getReport(period));
});
