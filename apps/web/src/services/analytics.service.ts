import { buildActivity, buildKpis, buildReport, buildSeries, buildStatusBreakdown, buildTopProducts } from "@/features/analytics/compute";
import type { AnalyticsService } from "./contracts";
import { getDb } from "./mock/db";
import { inventoryService } from "./inventory.service";

export const analyticsService: AnalyticsService = {
  async getDashboard() {
    const db = getDb();
    const orders = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const outOfStock = await inventoryService.getInventory({ status: "out_of_stock" });
    return structuredClone({
      kpis: buildKpis(orders, db.products),
      revenueSeries: buildSeries(orders.filter((o) => new Date(o.createdAt) >= new Date(Date.now() - 30 * 86400000)), "30d", new Date()),
      statusBreakdown: buildStatusBreakdown(orders),
      topProducts: buildTopProducts(orders, 5),
      recentOrders: orders.slice(0, 8),
      outOfStock: outOfStock.slice(0, 8),
      activity: buildActivity(orders, db.movements),
    });
  },

  async getReport(period) {
    const db = getDb();
    return structuredClone(buildReport({ orders: db.orders, products: db.products, categories: db.categories, period }));
  },
};
