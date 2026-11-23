import { getPickupPoint, getWilaya } from "@fashion/shared";
import type { CheckoutFormValues } from "@fashion/validators";
import { ServiceError } from "@/services/errors";
import type { CartItem } from "@/stores/cart.store";
import type { CreateOrderInput } from "@/types/order.types";

/**
 * Passage de commande : construit l'entrée du service `createOrder` à partir du formulaire et du panier.
 * Fonction pure — c'est le SEUL endroit qui connaît la forme de `CreateOrderInput` côté UI :
 * remplacer le service mock par une API ne demande aucun changement dans les composants.
 *
 * Les prix ne sont PAS transmis : le service les relit (et revérifie le stock par variante).
 */
export function buildCreateOrderInput(params: {
  values: CheckoutFormValues;
  items: Array<Pick<CartItem, "variantId" | "quantity">>;
  /** Code promo déjà validé (undefined si absent ou plus valable). */
  promoCode?: string | null;
  /** E-mail éventuel de la session client simulée. */
  email?: string;
}): CreateOrderInput {
  const { values, items, promoCode, email } = params;
  const wilaya = getWilaya(values.wilayaCode);
  if (!wilaya) throw new Error("Wilaya invalide.");

  const isPickup = values.deliveryMethod === "pickup_point";
  const pickupPoint = isPickup && values.pickupPointId ? getPickupPoint(values.pickupPointId) : undefined;
  if (isPickup && (!pickupPoint || pickupPoint.wilayaCode !== values.wilayaCode)) {
    throw new Error("Le bureau de livraison choisi ne correspond pas à la wilaya.");
  }

  return {
    customer: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      ...(email?.trim() ? { email: email.trim() } : {}),
    },
    shippingAddress: {
      wilayaCode: wilaya.code,
      wilayaName: wilaya.name,
      commune: values.commune.trim(),
      address: pickupPoint ? pickupPoint.address : values.address.trim(),
      deliveryMethod: values.deliveryMethod,
      ...(pickupPoint ? { pickupPointId: pickupPoint.id, pickupPointName: pickupPoint.name } : {}),
    },
    items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    ...(promoCode?.trim() ? { promoCode: promoCode.trim() } : {}),
    ...(values.note?.trim() ? { customerNote: values.note.trim() } : {}),
  };
}

/** Erreurs qui signifient « le panier ne correspond plus au catalogue » (stock, produit retiré). */
export function isCartConflictError(error: unknown): error is ServiceError {
  return error instanceof ServiceError && (error.code === "OUT_OF_STOCK" || error.code === "NOT_FOUND");
}
