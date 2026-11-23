import type { CartItem } from "@/stores/cart.store";
import type { Product } from "@/types/product.types";

/**
 * Réconciliation du panier avec le catalogue courant (prix, stock, image, disponibilité).
 * Fonction pure : elle décrit les corrections ; `applyCartReconciliation` les applique au store.
 */

export type CartLineIssueKind = "unavailable" | "out_of_stock";

export type CartLineIssue = { variantId: string; kind: CartLineIssueKind; message: string };

export type CartLinePatch = {
  variantId: string;
  patch: Partial<Pick<CartItem, "unitPrice" | "maxStock" | "imageUrl" | "name">>;
};

export type CartNotice = { variantId: string; message: string };

export type CartReconciliation = {
  patches: CartLinePatch[];
  /** Lignes qui ne peuvent pas être commandées en l'état, indexées par variantId. */
  issues: Record<string, CartLineIssue>;
  /** Informations à montrer au client (prix modifié, quantité ajustée). */
  notices: CartNotice[];
};

const label = (item: CartItem) => `« ${item.name} » (${item.color}, ${item.size})`;

export function reconcileCart(items: CartItem[], products: Product[]): CartReconciliation {
  const result: CartReconciliation = { patches: [], issues: {}, notices: [] };

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId && p.isPublished && !p.isArchived);
    const variant = product?.variants.find((v) => v.id === item.variantId);

    if (!product || !variant) {
      result.issues[item.variantId] = {
        variantId: item.variantId,
        kind: "unavailable",
        message: `${label(item)} n'est plus disponible à la vente.`,
      };
      continue;
    }

    const patch: CartLinePatch["patch"] = {};
    if (variant.price !== item.unitPrice) {
      patch.unitPrice = variant.price;
      result.notices.push({ variantId: item.variantId, message: `Le prix de ${label(item)} a été mis à jour.` });
    }
    if (variant.stock !== item.maxStock || item.quantity > variant.stock) patch.maxStock = variant.stock;
    if (product.name !== item.name) patch.name = product.name;
    const image = (product.images.find((im) => im.color === item.color) ?? product.images[0])?.url;
    if (image && image !== item.imageUrl) patch.imageUrl = image;

    if (variant.stock <= 0) {
      result.issues[item.variantId] = {
        variantId: item.variantId,
        kind: "out_of_stock",
        message: `${label(item)} est en rupture de stock.`,
      };
    } else if (item.quantity > variant.stock) {
      result.notices.push({
        variantId: item.variantId,
        message: `${label(item)} : quantité ramenée à ${variant.stock} (stock disponible).`,
      });
    }

    if (Object.keys(patch).length > 0) result.patches.push({ variantId: item.variantId, patch });
  }

  return result;
}

/** Lignes à supprimer pour que le panier redevienne commandable. */
export function getInvalidVariantIds(reconciliation: CartReconciliation): string[] {
  return Object.keys(reconciliation.issues);
}
