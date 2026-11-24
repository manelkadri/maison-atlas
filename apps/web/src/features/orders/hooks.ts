"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { orderService } from "@/services";
import type { CreateOrderInput, OrderFilters, OrderStatus } from "@/types/order.types";

export function useOrders(filters?: OrderFilters, enabled = true) {
  return useQuery({ queryKey: queryKeys.orders.list(filters), queryFn: () => orderService.getOrders(filters), enabled });
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.orders.byId(id ?? ""), queryFn: () => orderService.getOrderById(id!), enabled: !!id });
}

/** Commande par numéro — recherche ADMINISTRATEUR (le suivi public est `useTrackOrder`, l'espace cliente `useMyOrder`). */
export function useOrderByNumber(orderNumber: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.byNumber(orderNumber ?? ""),
    queryFn: () => orderService.getOrderByNumber(orderNumber!),
    enabled: !!orderNumber && enabled,
  });
}

export function useCreateOrder() {
  return useMutation({ mutationFn: (input: CreateOrderInput) => orderService.createOrder(input) });
}

export function useUpdateOrderStatus() {
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) => orderService.updateOrderStatus(id, status, note),
  });
}
