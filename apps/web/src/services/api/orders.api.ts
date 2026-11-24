import { apiFetch, apiFetchOrNull, type ApiQuery } from "@/lib/api-client";
import type { CustomerOrder, Order, OrderFilters, PublicTrackedOrder } from "@/types/order.types";
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

  getOrderByNumber: (orderNumber) => apiFetchOrNull<Order>(`/admin/orders/by-number/${seg(orderNumber)}`),

  /** Route publique de suivi (numéro ET téléphone) : 404 ⇒ `null`, sans distinguer numéro inconnu et mauvais téléphone. */
  trackOrder: (orderNumber, phone) => apiFetchOrNull<PublicTrackedOrder>("/orders/track", { query: { number: orderNumber, phone } }),

  createOrder: (input) => apiFetch<CustomerOrder>("/orders", { method: "POST", body: input }),

  updateOrderStatus: (id, status, note) =>
    apiFetch<Order>(`/admin/orders/${seg(id)}/status`, {
      method: "PATCH",
      body: { status, ...(note?.trim() ? { note: note.trim() } : {}) },
    }),
};
