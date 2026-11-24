import type { InventoryFilters } from "@/types/inventory.types";
import type { OrderFilters } from "@/types/order.types";
import type { AnalyticsPeriod } from "@/types/analytics.types";
import type { ProductFilters } from "@/types/product.types";

/** Clés de cache TanStack Query, centralisées pour éviter les fautes de frappe. */
export const queryKeys = {
  products: {
    all: ["products"] as const,
    list: (options?: { onlyPublic?: boolean }) => ["products", "list", options ?? {}] as const,
    search: (filters: ProductFilters, page: number, pageSize: number) => ["products", "search", filters, page, pageSize] as const,
    bySlug: (slug: string) => ["products", "slug", slug] as const,
    byId: (id: string) => ["products", "id", id] as const,
    related: (id: string, limit: number) => ["products", "related", id, limit] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: (includeArchived = false) => ["categories", "list", includeArchived] as const,
    deletionImpact: (id: string) => ["categories", "deletion-impact", id] as const,
  },
  orders: {
    all: ["orders"] as const,
    list: (filters?: OrderFilters) => ["orders", "list", filters ?? {}] as const,
    byId: (id: string) => ["orders", "id", id] as const,
    byNumber: (n: string) => ["orders", "number", n] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    items: (filters?: InventoryFilters) => ["inventory", "items", filters ?? {}] as const,
    movements: (filters?: { variantId?: string; productId?: string }) => ["inventory", "movements", filters ?? {}] as const,
  },
  customers: {
    all: ["customers"] as const,
    list: () => ["customers", "list"] as const,
    byId: (id: string) => ["customers", "id", id] as const,
  },
  auth: { me: ["auth", "me"] as const },
  account: {
    me: ["account", "me"] as const,
    orders: ["account", "orders"] as const,
    order: (number: string) => ["account", "orders", number] as const,
  },
  tracking: (number: string) => ["tracking", number] as const,
  promotions: { all: ["promotions"] as const },
  settings: { all: ["settings"] as const },
  analytics: {
    all: ["analytics"] as const,
    dashboard: () => ["analytics", "dashboard"] as const,
    report: (period: AnalyticsPeriod) => ["analytics", "report", period] as const,
  },
};
