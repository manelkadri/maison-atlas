import { FAILED_STATUSES, ORDER_STATUS_LABELS, normalizePhone } from "@fashion/shared";
import type { Order, OrderStatus } from "@/types/order.types";

/** Normalisation unique du téléphone (« +213 555… » et « 0555… » désignent le même numéro) : voir `@fashion/shared`. */
export { normalizePhone };

/** Une commande n'appartient au client connecté que si le téléphone de la commande correspond à sa session. */
export function isOwnOrder(order: Pick<Order, "customer">, sessionPhone: string | null | undefined): boolean {
  if (!sessionPhone) return false;
  return normalizePhone(order.customer.phone) === normalizePhone(sessionPhone);
}

export function countPieces(order: Pick<Order, "items">): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

const FLOW: readonly OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

export type TimelineStep = {
  key: string;
  status: OrderStatus;
  label: string;
  at?: string;
  note?: string;
  /** done = étape franchie, current = étape en cours, upcoming = à venir, failed = clôture négative. */
  state: "done" | "current" | "upcoming" | "failed";
};

/** Construit la chronologie de suivi à partir de l'historique de statuts, plus les étapes à venir du parcours normal. */
export function buildTimeline(order: Pick<Order, "status" | "statusHistory" | "createdAt">): TimelineStep[] {
  const history = [...order.statusHistory].sort((a, b) => a.at.localeCompare(b.at));
  const events: Array<{ status: OrderStatus; at: string; note?: string }> =
    history.length > 0 ? history : [{ status: order.status, at: order.createdAt }];

  const steps: TimelineStep[] = events.map((event, index) => {
    const isLast = index === events.length - 1;
    const failed = FAILED_STATUSES.includes(event.status);
    return {
      key: `${event.status}-${event.at}-${index}`,
      status: event.status,
      label: ORDER_STATUS_LABELS[event.status],
      at: event.at,
      note: event.note,
      state: failed ? "failed" : isLast && event.status !== "delivered" ? "current" : "done",
    };
  });

  const lastStatus = events[events.length - 1]?.status;
  const flowIndex = lastStatus ? FLOW.indexOf(lastStatus) : -1;
  if (flowIndex >= 0 && lastStatus !== "delivered") {
    for (const status of FLOW.slice(flowIndex + 1)) {
      steps.push({ key: `upcoming-${status}`, status, label: ORDER_STATUS_LABELS[status], state: "upcoming" });
    }
  }
  return steps;
}

/** Libellé de paiement : paiement à la livraison, non encaissé tant que la commande n'est pas livrée. */
export function describePayment(order: Pick<Order, "paymentStatus" | "status">): { title: string; detail: string } {
  const title = "Paiement à la livraison";
  if (order.paymentStatus === "paid") return { title, detail: "Payée : le montant a été encaissé à la livraison." };
  if (order.paymentStatus === "failed") return { title, detail: "Le paiement n'a pas abouti." };
  if (FAILED_STATUSES.includes(order.status)) return { title, detail: "Commande clôturée : aucun montant n'a été encaissé." };
  return { title, detail: "Non encaissé tant que la commande n'est pas livrée. Vous réglez en espèces à la réception." };
}

/** Mention courte sous le total d'une commande (null si rien à indiquer). */
export function paymentCaption(order: Pick<Order, "paymentStatus" | "status">): string | null {
  if (order.paymentStatus === "paid") return "payée à la livraison";
  if (order.paymentStatus === "pending" && !FAILED_STATUSES.includes(order.status)) return "à payer à la livraison";
  return null;
}
