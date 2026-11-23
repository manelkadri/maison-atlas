"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { inventoryService } from "@/services";
import type { CreateStockMovementInput, InventoryFilters } from "@/types/inventory.types";

export function useInventory(filters?: InventoryFilters) {
  return useQuery({ queryKey: queryKeys.inventory.items(filters), queryFn: () => inventoryService.getInventory(filters) });
}

export function useStockMovements(filters?: { variantId?: string; productId?: string }) {
  return useQuery({ queryKey: queryKeys.inventory.movements(filters), queryFn: () => inventoryService.getMovements(filters) });
}

export function useRecordMovement() {
  return useMutation({ mutationFn: (input: CreateStockMovementInput) => inventoryService.recordMovement(input) });
}
