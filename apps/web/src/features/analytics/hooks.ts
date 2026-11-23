"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { analyticsService } from "@/services";
import type { AnalyticsPeriod } from "@/types/analytics.types";

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.analytics.dashboard(), queryFn: () => analyticsService.getDashboard() });
}

export function useAnalyticsReport(period: AnalyticsPeriod) {
  return useQuery({ queryKey: queryKeys.analytics.report(period), queryFn: () => analyticsService.getReport(period) });
}
