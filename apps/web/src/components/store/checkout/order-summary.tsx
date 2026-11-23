"use client";

import { Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { TotalsBreakdown } from "@/components/store/cart/totals-breakdown";
import type { useCartTotals } from "@/features/cart/hooks";
import { formatDZD } from "@fashion/shared";
import { cartItemToLine, OrderLines } from "./order-lines";

type OrderSummaryProps = {
  totals: ReturnType<typeof useCartTotals>;
  shippingHint?: string;
  isSubmitting: boolean;
  /** Id du formulaire : le bouton de la colonne de droite soumet le formulaire de gauche. */
  formId: string;
};

function SummaryBody({ totals, shippingHint }: Pick<OrderSummaryProps, "totals" | "shippingHint">) {
  return (
    <div className="space-y-5">
      <OrderLines lines={totals.items.map(cartItemToLine)} />
      <TotalsBreakdown
        subtotal={totals.subtotal}
        discount={totals.discount}
        promoCode={totals.promo.activeCode}
        shippingFee={totals.shippingFee}
        total={totals.total}
        totalLabel="Total à payer à la livraison"
        shippingHint={shippingHint}
      />
      {totals.promo.storedCode && !totals.promo.activeCode && !totals.promo.isChecking && (
        <p role="alert" className="text-warning text-xs">
          Le code {totals.promo.storedCode} n&apos;est plus applicable{totals.promo.invalidReason ? ` : ${totals.promo.invalidReason}` : "."} Il ne sera pas pris en compte.
        </p>
      )}
    </div>
  );
}

/** Récapitulatif : bloc repliable en haut sur mobile, colonne sticky à droite sur desktop. */
export function OrderSummary({ totals, shippingHint, isSubmitting, formId }: OrderSummaryProps) {
  return (
    <>
      {/* Mobile */}
      <Accordion type="single" collapsible className="bg-card border-border mb-6 rounded-lg border px-4 lg:hidden">
        <AccordionItem value="summary" className="border-b-0">
          <AccordionTrigger className="items-center">
            <span className="flex flex-1 items-center justify-between gap-3 pr-2">
              <span>Récapitulatif ({totals.count} article{totals.count > 1 ? "s" : ""})</span>
              <span className="tabular-nums">{totals.total === undefined ? "—" : formatDZD(totals.total)}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <SummaryBody totals={totals} shippingHint={shippingHint} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Desktop */}
      <aside aria-labelledby="checkout-summary-title" className="bg-card border-border sticky top-24 hidden space-y-5 rounded-lg border p-6 lg:block">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="checkout-summary-title" className="font-display text-xl">
            Votre commande
          </h2>
          <Link href="/cart" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4">
            Modifier
          </Link>
        </div>
        <SummaryBody totals={totals} shippingHint={shippingHint} />
        <Button type="submit" form={formId} size="lg" className="h-12 w-full text-base" disabled={isSubmitting || totals.shippingFee === undefined}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
          {isSubmitting ? "Enregistrement…" : "Confirmer la commande"}
        </Button>
        <p className="text-muted-foreground text-center text-xs">Vous réglez en espèces à la réception de votre colis.</p>
      </aside>
    </>
  );
}
