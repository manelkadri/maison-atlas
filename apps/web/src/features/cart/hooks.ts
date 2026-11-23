"use client";

import { useQuery } from "@tanstack/react-query";
import { getShippingFee } from "@fashion/shared";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useHydrated } from "@/hooks/use-hydrated";
import { useProducts } from "@/features/products/hooks";
import { useValidatePromoCode } from "@/features/promotions/hooks";
import { useSettings } from "@/features/settings/hooks";
import { promotionService, getErrorMessage } from "@/services";
import { getCartCount, getCartSubtotal, useCartStore, type CartItem } from "@/stores/cart.store";
import type { DeliveryMethod } from "@/types/order.types";
import { applyCartReconciliation } from "./apply-reconciliation";
import { reconcileCart, type CartLineIssue } from "./reconcile";
import { computeCartSummary } from "./summary";

/** Contenu du panier, vide tant que le localStorage n'est pas hydraté (évite les écarts SSR/CSR). */
export function useCartState() {
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const promoCode = useCartStore((s) => s.promoCode);
  const shipping = useCartStore((s) => s.shipping);
  return {
    hydrated,
    items: hydrated ? items : EMPTY_ITEMS,
    promoCode: hydrated ? promoCode : null,
    shipping,
  };
}
const EMPTY_ITEMS: CartItem[] = [];

/**
 * Compare le panier au catalogue public : met à jour prix / stock / image (instantané du panier)
 * et expose les lignes qui ne sont plus commandables. À monter sur /cart.
 */
export function useCartReconciliation() {
  const { hydrated, items } = useCartState();
  const { data: products, isPending, isError } = useProducts({ onlyPublic: true });

  useEffect(() => {
    if (!hydrated || !products) return;
    const result = applyCartReconciliation(products);
    // Les notices ne concernent que des corrections qui viennent d'être appliquées : une seule fois.
    for (const notice of result.notices) toast.info(notice.message);
  }, [hydrated, products]);

  const issues = useMemo<Record<string, CartLineIssue>>(
    () => (products ? reconcileCart(items, products).issues : {}),
    [items, products],
  );

  return { issues, hasIssues: Object.keys(issues).length > 0, isChecking: !hydrated || isPending, isError };
}

/** Code promo du panier : revalidé à chaque changement de sous-total. */
export function useCartPromo(subtotal: number) {
  const { promoCode } = useCartState();
  const setPromoCode = useCartStore((s) => s.setPromoCode);
  const validateMutation = useValidatePromoCode();

  const query = useQuery({
    queryKey: ["promotions", "validate", promoCode, subtotal],
    queryFn: () => promotionService.validateCode(promoCode!, subtotal),
    enabled: !!promoCode && subtotal > 0,
  });

  const validation = promoCode ? query.data : undefined;
  const valid = validation?.valid ? validation : undefined;

  const apply = useCallback(
    async (raw: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
      const code = raw.trim().toUpperCase();
      if (!code) return { ok: false, reason: "Saisissez un code promotionnel." };
      try {
        const result = await validateMutation.mutateAsync({ code, subtotal });
        if (!result.valid) return { ok: false, reason: result.reason };
        setPromoCode(result.promotion.code);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: getErrorMessage(error) };
      }
    },
    [subtotal, setPromoCode, validateMutation],
  );

  const remove = useCallback(() => setPromoCode(null), [setPromoCode]);

  return {
    /** Code enregistré dans le panier (même s'il n'est plus valable). */
    storedCode: promoCode,
    /** Code réellement applicable (valide pour ce sous-total). */
    activeCode: valid?.promotion.code,
    label: valid?.promotion.label,
    discount: valid?.discount ?? 0,
    /** Raison pour laquelle le code enregistré n'est plus applicable. */
    invalidReason: validation && !validation.valid ? validation.reason : undefined,
    isChecking: !!promoCode && query.isPending,
    isApplying: validateMutation.isPending,
    apply,
    remove,
  };
}

/** Totaux du panier avec frais de livraison estimés (affichés séparément du sous-total). */
export function useCartTotals(override?: { wilayaCode?: string; method?: DeliveryMethod }) {
  const { hydrated, items, shipping } = useCartState();
  const settings = useSettings();
  const subtotal = getCartSubtotal(items);
  const promo = useCartPromo(subtotal);

  const wilayaCode = override?.wilayaCode ?? shipping.wilayaCode;
  const method = override?.method ?? shipping.method;
  const shippingFee = settings.data ? getShippingFee(settings.data, wilayaCode, method, subtotal) : undefined;
  const summary = computeCartSummary({ items, discount: promo.discount, shippingFee: shippingFee ?? 0 });

  return {
    hydrated,
    items,
    count: getCartCount(items),
    settings: settings.data,
    wilayaCode,
    method,
    promo,
    subtotal: summary.subtotal,
    discount: summary.discount,
    /** undefined tant que les paramètres de livraison ne sont pas chargés. */
    shippingFee,
    total: shippingFee === undefined ? undefined : summary.total,
  };
}
