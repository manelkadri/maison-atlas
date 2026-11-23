import { computeOrderTotals } from "@fashion/shared";
import { getCartCount, getCartSubtotal, type CartItem } from "@/stores/cart.store";

export type CartSummary = {
  itemCount: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  /** subtotal - remise + livraison (frais toujours séparés du sous-total). */
  total: number;
};

/** Totaux du panier : sous-total, remise (code promo), livraison, total à payer à la livraison. */
export function computeCartSummary(input: { items: CartItem[]; discount?: number; shippingFee: number }): CartSummary {
  const subtotal = getCartSubtotal(input.items);
  const totals = computeOrderTotals({ subtotal, discount: input.discount, shippingFee: input.shippingFee });
  return {
    itemCount: getCartCount(input.items),
    subtotal,
    discount: totals.discountTotal,
    shippingFee: totals.shippingFee,
    total: totals.total,
  };
}
