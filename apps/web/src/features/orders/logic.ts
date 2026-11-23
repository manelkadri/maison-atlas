import { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS } from "@fashion/shared";
import type { DeliveryMethod, Order, OrderStatus, PaymentStatus } from "@/types/order.types";

export const ORDERS_PAGE_SIZE = 15;

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = { home: "Domicile", pickup_point: "Bureau" };

/* ------------------------------------------------------------------ Paiement COD */

export type PaymentTone = "warning" | "success" | "danger" | "neutral";

/**
 * Libellé du paiement à la livraison, déduit du statut de la commande (et non du seul `paymentStatus`) :
 * « Encaissé » une fois livrée ; « Sans objet » si annulée / refusée (rien à encaisser) ; « Échec » en cas
 * d'échec de livraison ou de retour ; « À encaisser » sinon (y compris une expédition relancée après un échec).
 */
export function getPaymentDisplay(order: Pick<Order, "paymentStatus" | "status">): { label: string; tone: PaymentTone } {
  const status: PaymentStatus = order.paymentStatus;
  if (status === "paid" && order.status === "delivered") return { label: "Encaissé", tone: "success" };
  if (order.status === "cancelled" || order.status === "rejected") return { label: "Sans objet", tone: "neutral" };
  if (order.status === "delivery_failed" || order.status === "returned") return { label: "Échec", tone: "danger" };
  return { label: "À encaisser", tone: "warning" };
}

/* ------------------------------------------------------------------ Transitions */

export const FINAL_STATUSES: readonly OrderStatus[] = ["cancelled", "rejected", "returned"];

export function getAllowedTransitions(status: OrderStatus): OrderStatus[] {
  return [...ORDER_STATUS_TRANSITIONS[status]];
}

export function isFinalStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

export const FINAL_STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  cancelled: "Cette commande est annulée : le statut est définitif et le stock a été restitué. Aucune modification n'est possible.",
  rejected: "Cette commande a été refusée : le statut est définitif et le stock a été restitué. Aucune modification n'est possible.",
  returned: "Cette commande est retournée : le statut est définitif et le stock a été restitué. Aucune modification n'est possible.",
};

export type StatusConfirmation = {
  title: string;
  confirmLabel: string;
  destructive: boolean;
  /** Conséquences affichées avant validation. */
  consequences: string[];
};

/** Changements de statut sensibles : confirmation obligatoire, conséquences explicitées. */
export const STATUS_CONFIRMATIONS: Partial<Record<OrderStatus, StatusConfirmation>> = {
  cancelled: {
    title: "Annuler la commande ?",
    confirmLabel: "Annuler la commande",
    destructive: true,
    consequences: ["Le stock des articles est restitué.", "Le statut « Annulée » est définitif."],
  },
  rejected: {
    title: "Marquer la commande comme refusée ?",
    confirmLabel: "Refuser la commande",
    destructive: true,
    consequences: ["Le stock des articles est restitué.", "Le statut « Refusée » est définitif."],
  },
  delivery_failed: {
    title: "Déclarer un échec de livraison ?",
    confirmLabel: "Confirmer l'échec",
    destructive: true,
    consequences: [
      "Le paiement passe à « Échec ».",
      "Le stock n'est pas restitué tant que la commande n'est pas retournée ou annulée.",
      "Vous pourrez ensuite relancer l'expédition, retourner ou annuler la commande.",
    ],
  },
  returned: {
    title: "Marquer la commande comme retournée ?",
    confirmLabel: "Confirmer le retour",
    destructive: true,
    consequences: ["Le stock des articles est restitué.", "Le paiement passe à « Échec ».", "Le statut « Retournée » est définitif."],
  },
  delivered: {
    title: "Confirmer la livraison ?",
    confirmLabel: "Confirmer la livraison",
    destructive: false,
    consequences: [
      "Le paiement à la livraison passe à « Encaissé ».",
      "La commande entre dans le chiffre d'affaires.",
      "Seul un retour pourra ensuite modifier ce statut.",
    ],
  },
};

export function requiresConfirmation(status: OrderStatus): boolean {
  return status in STATUS_CONFIRMATIONS;
}

/* ------------------------------------------------------------------ Compteurs / tri */

export type StatusCounts = Record<OrderStatus | "all", number>;

export function countByStatus(orders: Pick<Order, "status">[]): StatusCounts {
  const counts = { all: orders.length } as StatusCounts;
  for (const s of ORDER_STATUSES) counts[s] = 0;
  for (const o of orders) counts[o.status] += 1;
  return counts;
}

export type OrderSort = "date_desc" | "date_asc" | "total_desc" | "total_asc";

export const ORDER_SORT_LABELS: Record<OrderSort, string> = {
  date_desc: "Plus récentes",
  date_asc: "Plus anciennes",
  total_desc: "Montant décroissant",
  total_asc: "Montant croissant",
};

export function sortOrders(orders: Order[], sort: OrderSort): Order[] {
  const copy = [...orders];
  switch (sort) {
    case "date_desc":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "date_asc":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "total_desc":
      return copy.sort((a, b) => b.total - a.total);
    case "total_asc":
      return copy.sort((a, b) => a.total - b.total);
  }
}

export function parseOrderStatusParam(value: string | null | undefined): OrderStatus | "all" {
  return (ORDER_STATUSES as readonly string[]).includes(value ?? "") ? (value as OrderStatus) : "all";
}

/** Saisie numérique d'un filtre de montant : vide ou invalide → undefined. */
export function parseAmount(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function customerFullName(c: { firstName: string; lastName: string }): string {
  return `${c.firstName} ${c.lastName}`.trim();
}
