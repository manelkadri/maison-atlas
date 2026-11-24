"use client";

import { CircleCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthPanel, ChangePasswordForm } from "@/components/store/account/auth-forms";
import { useAccount } from "@/features/account/hooks";
import { useCartState } from "@/features/cart/hooks";
import { getCheckoutDefaults } from "@/features/checkout/defaults";
import { CheckoutForm } from "./checkout-form";

/**
 * Page de paiement. Il FAUT être connectée pour commander (le serveur le refuse sinon) : une visiteuse se connecte ou crée son
 * compte ICI, sans quitter la page, et son panier (conservé dans le navigateur) n'est pas perdu.
 * Le formulaire n'est monté qu'après hydratation : ses valeurs initiales (compte, estimation de livraison) en dépendent.
 */
export function CheckoutView() {
  const { hydrated, items, shipping } = useCartState();
  const account = useAccount();
  const profile = account.data ?? null;
  const [placed, setPlaced] = useState(false);

  return (
    <div className="container-store py-8 md:py-12">
      <header className="reveal mb-8 space-y-3">
        <p className="eyebrow">Commande</p>
        <h1 className="font-display text-3xl md:text-5xl">Finaliser ma commande</h1>
        <p className="text-muted-foreground text-sm">Paiement à la livraison · Compte client requis</p>
      </header>

      {!hydrated || account.isPending ? (
        <CheckoutSkeleton />
      ) : account.isError ? (
        <div role="alert" className="text-center">
          <p className="text-destructive">Impossible de vérifier votre session pour le moment.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void account.refetch()}>
            Réessayer
          </Button>
        </div>
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
      ) : !profile ? (
        <AuthPanel title="Connectez-vous pour commander" intro="Votre panier est conservé. Connectez-vous ou créez votre compte pour finaliser la commande." />
      ) : profile.mustChangePassword ? (
        <div>
          <h2 className="font-display mb-4 text-2xl">Choisissez votre mot de passe</h2>
          <ChangePasswordForm forced />
        </div>
      ) : (
        <CheckoutForm initialValues={getCheckoutDefaults(profile, shipping)} email={profile.email} onPlaced={() => setPlaced(true)} />
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
