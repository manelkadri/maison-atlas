"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { settingsService } from "@/services";
import type { StoreSettings } from "@/types/settings.types";

export function useSettings(initialData?: StoreSettings) {
  return useQuery({ queryKey: queryKeys.settings.all, queryFn: () => settingsService.getSettings(), initialData, initialDataUpdatedAt: 0 });
}

export function useUpdateSettings() {
  return useMutation({ mutationFn: (data: Partial<StoreSettings>) => settingsService.updateSettings(data) });
}

export function useResetDemoData() {
  return useMutation({ mutationFn: () => settingsService.resetDemoData() });
}
