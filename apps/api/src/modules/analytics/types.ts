import type {
  ActivityEvent,
  DashboardKpis,
  InventoryItem,
  Order,
  StatusBreakdownItem,
  TimeSeriesPoint,
  TopProduct,
} from "@fashion/types";

/** Réponse de GET /api/admin/analytics/dashboard (copie de `DashboardData` de apps/web/src/services/contracts.ts). */
export type DashboardData = {
  kpis: DashboardKpis;
  revenueSeries: TimeSeriesPoint[];
  statusBreakdown: StatusBreakdownItem[];
  topProducts: TopProduct[];
  recentOrders: Order[];
  outOfStock: InventoryItem[];
  activity: ActivityEvent[];
};
