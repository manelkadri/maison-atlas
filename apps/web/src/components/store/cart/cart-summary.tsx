"use client";

import { getWilaya } from "@fashion/shared";
import { Banknote, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { useCartTotals } from "@/features/cart/hooks";
import type { CartShippingEstimate } from "@/stores/cart.store";
import { PromoCodeForm } from "./promo-code-form";
import { ShippingEstimator } from "./shipping-estimator";
import { TotalsBreakdown } from "./totals-breakdown";

type CartSummaryProps = {
  totals: ReturnType<typeof useCartTotals>;
  shipping: CartShippingEstimate;
  onShippingChange: (patch: Partial<CartShippingEstimate>) => void;
  /** Nombre de lignes à corriger avant de commander. */
  blockedCount: number;
  isChecking: boolean;
};

export function CartSummary({ totals, shipping, onShippingChange, blockedCount, isChecking }: CartSummaryProps) {
  const wilayaName = getWilaya(shipping.wilayaCode)?.name;
  const canCheckout = totals.items.length > 0 && blockedCount === 0;

  return (
    <aside aria-labelledby="cart-summary-title" className="bg-card border-border space-y-6 rounded-lg border p-5 sm:p-6 lg:sticky lg:top-24">
      <h2 id="cart-summary-title" className="font-display text-xl">
        Récapitulatif
      </h2>

      <ShippingEstimator shipping={shipping} settings={totals.settings} subtotal={totals.subtotal} onChange={onShippingChange} />

      <PromoCodeForm promo={totals.promo} />

      <TotalsBreakdown
        subtotal={totals.subtotal}
        discount={totals.discount}
        promoCode={totals.promo.activeCode}
        shippingFee={totals.shippingFee}
        total={totals.total}
        shippingHint={wilayaName ? `${wilayaName} · ${shipping.method === "home" ? "à domicile" : "en bureau"} (estimation)` : undefined}
      />

      <p className="text-muted-foreground flex items-start gap-2.5 text-xs leading-relaxed">
        <Banknote className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="text-foreground font-medium">Paiement à la livraison (espèces).</strong> Vous ne payez rien aujourd&apos;hui : le montant est réglé au livreur à la réception.
        </span>
      </p>

      <div className="space-y-3">
        {canCheckout ? (
          <Button asChild size="lg" className="h-12 w-full text-base">
            <Link href="/checkout">
              <Lock aria-hidden />
              Passer la commande
            </Link>
          </Button>
        ) : (
          <>
            <Button type="button" size="lg" className="h-12 w-full text-base" disabled aria-describedby="checkout-blocked-hint">
              <Lock aria-hidden />
              Passer la commande
            </Button>
            <p id="checkout-blocked-hint" className="text-muted-foreground text-center text-xs">
              {isChecking
                ? "Vérification de la disponibilité de vos articles…"
                : blockedCount > 0
                  ? "Retirez les articles indisponibles pour continuer."
                  : "Votre panier est vide."}
            </p>
          </>
        )}
        <Button asChild variant="outline" size="lg" className="h-12 w-full text-base">
          <Link href="/shop">Continuer les achats</Link>
        </Button>
      </div>
    </aside>
  );
}
