"use client";

import { CircleCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useCartState } from "@/features/cart/hooks";
import { getCheckoutDefaults } from "@/features/checkout/defaults";
import { useCustomerSessionStore } from "@/stores/customer-session.store";
import { CheckoutForm } from "./checkout-form";

/**
 * Page de paiement. Le formulaire n'est monté qu'après hydratation : ses valeurs initiales
 * (session client simulée, estimation de livraison du panier) viennent du localStorage.
 */
export function CheckoutView() {
  const { hydrated, items, shipping } = useCartState();
  const profile = useCustomerSessionStore((s) => s.profile);
  const [placed, setPlaced] = useState(false);

  return (
    <div className="container-store py-8 md:py-12">
      <header className="reveal mb-8 space-y-3">
        <p className="eyebrow">Commande</p>
        <h1 className="font-display text-3xl md:text-5xl">Finaliser ma commande</h1>
        <p className="text-muted-foreground text-sm">Commande sans création de compte · Paiement à la livraison</p>
      </header>

      {!hydrated ? (
        <CheckoutSkeleton />
      ) : placed ? (
        <div role="status" className="flex flex-col items-center py-16 text-center">
          <CircleCheck className="text-success mb-4 size-10" aria-hidden />
          <p className="font-medium">Commande enregistrée</p>
          <p className="text-muted-foreground mt-1 text-sm">Redirection vers votre confirmation…</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Votre panier est vide"
          description="Ajoutez des articles à votre panier avant de passer commande."
          action={
            <Button asChild className="h-11">
              <Link href="/shop">Découvrir la boutique</Link>
            </Button>
          }
        />
      ) : (
        <CheckoutForm initialValues={getCheckoutDefaults(profile, shipping)} onPlaced={() => setPlaced(true)} />
      )}
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem]" aria-busy="true" aria-label="Chargement du formulaire">
      <div className="space-y-6">
        <div className="bg-secondary h-56 animate-pulse rounded-lg" />
        <div className="bg-secondary h-80 animate-pulse rounded-lg" />
      </div>
      <div className="bg-secondary h-80 animate-pulse rounded-lg" />
    </div>
  );
}
