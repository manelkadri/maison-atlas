"use client";

import { AlertTriangle, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useCartReconciliation, useCartTotals } from "@/features/cart/hooks";
import { useCartStore, type CartItem } from "@/stores/cart.store";
import { CartLine } from "./cart-line";
import { CartSummary } from "./cart-summary";

export function CartView() {
  const totals = useCartTotals();
  const reconciliation = useCartReconciliation();
  const shipping = useCartStore((s) => s.shipping);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const addItem = useCartStore((s) => s.addItem);
  const clear = useCartStore((s) => s.clear);
  const setShipping = useCartStore((s) => s.setShipping);
  const [confirmClear, setConfirmClear] = useState(false);

  const { items, hydrated } = totals;
  const blockedIds = Object.keys(reconciliation.issues);

  const onRemove = (item: CartItem) => {
    removeItem(item.variantId);
    toast.success("Article retiré du panier", {
      description: `${item.name} · ${item.color}, ${item.size}`,
      action: {
        label: "Annuler",
        onClick: () => {
          const { quantity, ...rest } = item;
          addItem(rest, quantity);
        },
      },
    });
  };

  return (
    <div className="container-store py-8 md:py-12">
      <header className="reveal mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="eyebrow">Votre sélection</p>
          <h1 className="font-display text-3xl md:text-5xl">Mon panier</h1>
        </div>
        {hydrated && items.length > 0 && (
          <p className="text-muted-foreground text-sm" role="status">
            {totals.count} article{totals.count > 1 ? "s" : ""}
          </p>
        )}
      </header>

      {!hydrated ? (
        <CartSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Votre panier est vide"
          description="Parcourez la boutique et ajoutez vos pièces préférées. Le paiement se fait à la livraison."
          action={
            <Button asChild className="h-11">
              <Link href="/shop">Découvrir la boutique</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <section aria-label="Articles du panier">
            {blockedIds.length > 0 && (
              <div role="alert" className="border-destructive/30 bg-destructive-soft mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm">
                <p className="flex items-start gap-2.5">
                  <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {blockedIds.length === 1
                      ? "Un article de votre panier n'est plus disponible. Retirez-le pour passer commande."
                      : `${blockedIds.length} articles de votre panier ne sont plus disponibles. Retirez-les pour passer commande.`}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    blockedIds.forEach((id) => removeItem(id));
                    toast.success("Articles indisponibles retirés");
                  }}
                >
                  Retirer {blockedIds.length === 1 ? "cet article" : "ces articles"}
                </Button>
              </div>
            )}

            <ul className="divide-border divide-y">
              {items.map((item) => (
                <CartLine key={item.variantId} item={item} issue={reconciliation.issues[item.variantId]} onQuantityChange={updateQuantity} onRemove={onRemove} />
              ))}
            </ul>

            <div className="mt-6 flex justify-between">
              <Button type="button" variant="ghost" className="text-muted-foreground h-10" onClick={() => setConfirmClear(true)}>
                Vider le panier
              </Button>
            </div>
          </section>

          <CartSummary
            totals={totals}
            shipping={shipping}
            onShippingChange={setShipping}
            blockedCount={blockedIds.length}
            isChecking={reconciliation.isChecking}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Vider le panier ?"
        description="Tous les articles seront retirés de votre panier."
        confirmLabel="Vider le panier"
        variant="destructive"
        onConfirm={() => {
          clear();
          setConfirmClear(false);
          toast.success("Panier vidé");
        }}
      />
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]" aria-busy="true" aria-label="Chargement du panier">
      <div className="space-y-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="bg-secondary aspect-[4/5] w-24 animate-pulse rounded-sm sm:w-32" />
            <div className="flex-1 space-y-3">
              <div className="bg-secondary h-4 w-2/3 animate-pulse rounded" />
              <div className="bg-secondary h-3.5 w-1/3 animate-pulse rounded" />
              <div className="bg-secondary h-10 w-28 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-secondary h-80 animate-pulse rounded-lg" />
    </div>
  );
}
