"use client";

import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useHydrated } from "@/hooks/use-hydrated";
import { isApiMode } from "@/lib/api-config";
import { queryKeys } from "@/lib/query-keys";
import { orderService } from "@/services";
import { usePlacedOrdersStore } from "@/stores/placed-orders.store";
import type { CreateOrderInput, Order, OrderFilters, OrderStatus } from "@/types/order.types";

export function useOrders(filters?: OrderFilters, enabled = true) {
  return useQuery({ queryKey: queryKeys.orders.list(filters), queryFn: () => orderService.getOrders(filters), enabled });
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.orders.byId(id ?? ""), queryFn: () => orderService.getOrderById(id!), enabled: !!id });
}

/**
 * Commande par numéro. Avec `phone` : suivi public (numéro ET téléphone) ; sans : recherche administrateur.
 * Dans la boutique, utiliser `useTrackedOrder` (qui n'appelle jamais la route admin en mode API).
 */
export function useOrderByNumber(orderNumber: string | undefined, phone?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.byNumber(orderNumber ?? "", phone),
    queryFn: () => orderService.getOrderByNumber(orderNumber!, phone),
    enabled: !!orderNumber && enabled,
  });
}

/**
 * Commande d'un client de la boutique (confirmation, détail de suivi).
 * Mode mock : lecture directe par numéro. Mode API : le téléphone mémorisé sur l'appareil au moment de la commande
 * est joint à la requête ; sans téléphone connu, `needsPhone` vaut `true` (l'interface propose le formulaire de suivi).
 */
export function useTrackedOrder(orderNumber: string | undefined) {
  const api = isApiMode();
  const hydrated = useHydrated();
  const phone = usePlacedOrdersStore((s) => (orderNumber ? s.orders.find((o) => o.orderNumber === orderNumber)?.phone : undefined));
  const enabled = api ? hydrated && !!phone : true;
  const query = useOrderByNumber(orderNumber, api ? phone : undefined, enabled);
  return { ...query, needsPhone: api && hydrated && !!orderNumber && !phone };
}

export type MyOrders = {
  orders: Order[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * « Mes commandes ».
 * Mode mock : commandes du téléphone du profil simulé.
 * Mode API : uniquement les commandes mémorisées sur l'appareil, relues une à une avec leur couple (numéro, téléphone)
 * — jamais de liste par téléphone seul.
 */
export function useMyOrders(profilePhone: string | null | undefined): MyOrders {
  const api = isApiMode();
  const hydrated = useHydrated();
  const stored = usePlacedOrdersStore((s) => s.orders);

  const mock = useOrders({ phone: profilePhone ?? undefined }, !api && !!profilePhone);
  const tracked = useQueries({
    queries: (api && hydrated ? stored : []).map((entry) => ({
      queryKey: queryKeys.orders.byNumber(entry.orderNumber, entry.phone),
      queryFn: () => orderService.getOrderByNumber(entry.orderNumber, entry.phone),
    })),
  });

  if (!api) {
    return { orders: mock.data ?? [], isLoading: mock.isLoading, isError: mock.isError, refetch: () => void mock.refetch() };
  }

  const found = tracked.flatMap((q) => (q.data ? [q.data] : []));
  const failed = tracked.filter((q) => q.isError);
  return {
    orders: found.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    isLoading: !hydrated || tracked.some((q) => q.isPending),
    // Erreur affichée seulement si RIEN n'a pu être chargé (serveur injoignable).
    isError: tracked.length > 0 && failed.length === tracked.length,
    refetch: () => {
      for (const q of failed) void q.refetch();
    },
  };
}

export function useCreateOrder() {
  return useMutation({ mutationFn: (input: CreateOrderInput) => orderService.createOrder(input) });
}

export function useUpdateOrderStatus() {
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) => orderService.updateOrderStatus(id, status, note),
  });
}
