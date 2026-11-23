import type { DeliveryMethod, OrderStatus, Promotion, PromotionValidation, StoreSettings } from "@fashion/types";
import { formatDZD } from "./format";
import { getWilaya } from "./wilayas";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending", "confirmed", "processing", "shipped", "delivered",
  "cancelled", "rejected", "delivery_failed", "returned",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  rejected: "Refusée",
  delivery_failed: "Échec de livraison",
  returned: "Retournée",
};

/**
 * Transitions autorisées (machine à états).
 * Évite de repasser une commande livrée en "en attente", par exemple.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled", "rejected"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "delivery_failed"],
  delivered: ["returned"],
  cancelled: [],
  rejected: [],
  delivery_failed: ["shipped", "returned", "cancelled"],
  returned: [],
};

/** Statuts qui libèrent le stock réservé à la commande. */
export const STOCK_RELEASING_STATUSES: readonly OrderStatus[] = ["cancelled", "rejected", "returned"];

/** Statuts considérés comme "clôturés négativement" (taux d'annulation). */
export const FAILED_STATUSES: readonly OrderStatus[] = ["cancelled", "rejected", "delivery_failed", "returned"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function getShippingFee(
  settings: Pick<StoreSettings, "shippingFees" | "freeShippingThreshold">,
  wilayaCode: string | undefined,
  method: DeliveryMethod,
  subtotal: number,
): number {
  if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) return 0;
  const zone = (wilayaCode && getWilaya(wilayaCode)?.zone) || "2";
  const fees = settings.shippingFees[zone];
  return method === "home" ? fees.home : fees.pickupPoint;
}

export function computePromoDiscount(promo: Promotion, subtotal: number): number {
  const raw = promo.type === "percentage" ? Math.round((subtotal * promo.value) / 100) : promo.value;
  return Math.max(0, Math.min(raw, subtotal));
}

export function validatePromotion(
  promo: Promotion | undefined,
  subtotal: number,
  now: Date = new Date(),
): PromotionValidation {
  if (!promo) return { valid: false, reason: "Ce code promotionnel n'existe pas." };
  if (!promo.isActive) return { valid: false, reason: "Ce code promotionnel n'est plus actif." };
  if (now < new Date(promo.startsAt)) return { valid: false, reason: "Ce code n'est pas encore valable." };
  if (now > new Date(promo.endsAt)) return { valid: false, reason: "Ce code promotionnel a expiré." };
  if (subtotal < promo.minOrderAmount)
    return { valid: false, reason: `Montant minimum requis : ${formatDZD(promo.minOrderAmount)}.` };
  return { valid: true, promotion: promo, discount: computePromoDiscount(promo, subtotal) };
}

export function computeOrderTotals(input: { subtotal: number; discount?: number; shippingFee: number }) {
  const discountTotal = Math.min(input.discount ?? 0, input.subtotal);
  return {
    subtotal: input.subtotal,
    discountTotal,
    shippingFee: input.shippingFee,
    total: input.subtotal - discountTotal + input.shippingFee,
  };
}

/** Numéro de commande lisible : CMD-2026-000123 */
export function buildOrderNumber(sequence: number, date: Date = new Date()): string {
  return `CMD-${date.getFullYear()}-${String(sequence).padStart(6, "0")}`;
}
