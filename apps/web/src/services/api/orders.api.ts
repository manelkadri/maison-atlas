import { apiFetch, apiFetchOrNull, type ApiQuery } from "@/lib/api-client";
import type { Order, OrderFilters } from "@/types/order.types";
import type { OrderService } from "../contracts";

const seg = encodeURIComponent;

export function orderFiltersToQuery(filters: OrderFilters): ApiQuery {
  return {
    search: filters.search?.trim(),
    status: filters.status === "all" ? undefined : filters.status,
    deliveryMethod: filters.deliveryMethod === "all" ? undefined : filters.deliveryMethod,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    minTotal: filters.minTotal,
    maxTotal: filters.maxTotal,
    customerId: filters.customerId,
    phone: filters.phone,
  };
}

export const apiOrderService: OrderService = {
  getOrders: (filters = {}) => apiFetch<Order[]>("/admin/orders", { query: orderFiltersToQuery(filters) }),

  getOrderById: (id) => apiFetchOrNull<Order>(`/admin/orders/${seg(id)}`),

  getOrderByNumber(orderNumber, phone) {
    // Avec téléphone : route publique de suivi (numéro ET téléphone). Sans : route administrateur.
    if (phone !== undefined) return apiFetchOrNull<Order>("/orders/track", { query: { number: orderNumber, phone } });
    return apiFetchOrNull<Order>(`/admin/orders/by-number/${seg(orderNumber)}`);
  },

  createOrder: (input) => apiFetch<Order>("/orders", { method: "POST", body: input }),

  updateOrderStatus: (id, status, note) =>
    apiFetch<Order>(`/admin/orders/${seg(id)}/status`, {
      method: "PATCH",
      body: { status, ...(note?.trim() ? { note: note.trim() } : {}) },
    }),
};
