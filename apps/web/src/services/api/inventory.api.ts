import { apiFetch } from "@/lib/api-client";
import type { InventoryItem, StockMovement } from "@/types/inventory.types";
import type { InventoryService } from "../contracts";

export const apiInventoryService: InventoryService = {
  getInventory: (filters = {}) =>
    apiFetch<InventoryItem[]>("/admin/inventory", {
      query: {
        search: filters.search?.trim(),
        productId: filters.productId,
        color: filters.color,
        size: filters.size,
        status: filters.status === "all" ? undefined : filters.status,
      },
    }),

  getMovements: (filters = {}) =>
    apiFetch<StockMovement[]>("/admin/inventory/movements", { query: { variantId: filters.variantId, productId: filters.productId } }),

  recordMovement: (input) => apiFetch<StockMovement>("/admin/inventory/movements", { method: "POST", body: input }),
};
