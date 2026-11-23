"use client";

import { ORDER_STATUS_LABELS } from "@fashion/shared";
import { toast } from "sonner";
import { getErrorMessage } from "@/services";
import type { Order, OrderStatus } from "@/types/order.types";
import { useUpdateOrderStatus } from "./hooks";

/**
 * Changement de statut avec toast de succès / d'échec (erreur INVALID_TRANSITION incluse).
 * Renvoie true si le changement a réussi.
 */
export function useOrderStatusChange() {
  const mutation = useUpdateOrderStatus();

  const change = async (order: Pick<Order, "id" | "orderNumber">, status: OrderStatus, note?: string): Promise<boolean> => {
    try {
      await mutation.mutateAsync({ id: order.id, status, note: note?.trim() || undefined });
      toast.success(`Commande ${order.orderNumber} : ${ORDER_STATUS_LABELS[status].toLowerCase()}.`);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    }
  };

  return { change, isPending: mutation.isPending };
}
