import { useCartStore } from "@/stores/cart.store";
import { getInvalidVariantIds, reconcileCart, type CartReconciliation } from "./reconcile";
import type { Product } from "@/types/product.types";

/**
 * Applique la réconciliation au panier (hors React : lit l'état courant du store, donc idempotent).
 * Retourne le résultat calculé AVANT application, pour afficher des messages.
 */
export function applyCartReconciliation(products: Product[], options: { removeInvalid?: boolean } = {}): CartReconciliation {
  const store = useCartStore.getState();
  const result = reconcileCart(store.items, products);
  for (const { variantId, patch } of result.patches) store.syncItem(variantId, patch);
  if (options.removeInvalid) {
    for (const variantId of getInvalidVariantIds(result)) useCartStore.getState().removeItem(variantId);
  }
  return result;
}
