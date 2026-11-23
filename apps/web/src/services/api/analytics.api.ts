import { apiFetch } from "@/lib/api-client";
import type { AnalyticsReport } from "@/types/analytics.types";
import type { AnalyticsService, DashboardData } from "../contracts";

export const apiAnalyticsService: AnalyticsService = {
  getDashboard: () => apiFetch<DashboardData>("/admin/analytics/dashboard"),

  getReport: (period) => apiFetch<AnalyticsReport>("/admin/analytics/report", { query: { period } }),
};
