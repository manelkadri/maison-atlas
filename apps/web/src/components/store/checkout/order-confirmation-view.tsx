"use client";

import { formatDateTime, formatPhone } from "@fashion/shared";
import { Building2, CheckCircle2, Copy, Home, PackageSearch, PhoneCall, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { TrackOrderForm } from "@/components/store/account/track-order-form";
import { TotalsBreakdown } from "@/components/store/cart/totals-breakdown";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge, ToneBadge } from "@/components/ui/status-badge";
import { useTrackedOrder } from "@/features/orders/hooks";
import { OrderLines, orderItemToLine } from "./order-lines";

const NEXT_STEPS = [
  { icon: PhoneCall, title: "Appel de confirmation", text: "Notre équipe vous appelle pour valider votre commande et vos informations de livraison." },
  { icon: Truck, title: "Préparation et expédition", text: "Une fois confirmée, votre commande est préparée puis remise au transporteur." },
  { icon: Wallet, title: "Paiement à la réception", text: "Vous réglez le montant total en espèces au livreur, après avoir vérifié votre colis." },
] as const;

export function OrderConfirmationView({ orderNumber }: { orderNumber?: string }) {
  const { data: order, isPending, isError, refetch, needsPhone } = useTrackedOrder(orderNumber);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      toast.success("Numéro de commande copié");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible : sélectionnez le numéro manuellement.");
    }
  };

  if (!orderNumber) {
    return (
      <Shell>
        <EmptyState
          icon={PackageSearch}
          title="Aucun numéro de commande"
          description="Ce lien est incomplet. Si vous venez de passer commande, retrouvez-la depuis votre espace de suivi."
          action={<Actions />}
        />
      </Shell>
    );
  }

  if (needsPhone) {
    // Mode API : le téléphone n'est pas mémorisé sur cet appareil → le numéro seul ne suffit pas (aucune fuite de données).
    return (
      <Shell>
        <div className="mx-auto max-w-md space-y-4">
          <h1 className="font-display text-2xl">Retrouvez votre commande</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Pour protéger vos données, saisissez le numéro de téléphone utilisé lors de la commande {orderNumber}.
          </p>
          <TrackOrderForm initialOrderNumber={orderNumber} />
        </div>
      </Shell>
    );
  }

  if (isPending) {
    return (
      <Shell>
        <div className="space-y-6" aria-busy="true" aria-label="Chargement de votre commande">
          <div className="bg-secondary h-40 animate-pulse rounded-lg" />
          <div className="bg-secondary h-72 animate-pulse rounded-lg" />
        </div>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell>
        <div role="alert" className="border-destructive/30 bg-destructive-soft rounded-lg border px-6 py-12 text-center">
          <p className="font-medium">Impossible de charger votre commande.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <EmptyState
          icon={PackageSearch}
          title="Commande introuvable"
          description={`Nous ne trouvons aucune commande « ${orderNumber} » sur cet appareil. Vérifiez le numéro ou retrouvez vos commandes dans votre espace.`}
          action={<Actions />}
        />
      </Shell>
    );
  }

  const pickup = order.shippingAddress.deliveryMethod === "pickup_point";

  return (
    <Shell>
      <section className="reveal border-border bg-card mb-8 rounded-lg border p-6 text-center sm:p-10" aria-labelledby="confirmation-title">
        <CheckCircle2 className="text-success mx-auto mb-4 size-12" aria-hidden />
        <h1 id="confirmation-title" className="font-display text-3xl md:text-4xl">
          Merci {order.customer.firstName}, votre commande est enregistrée
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
          Nous vous appelons très bientôt pour la confirmer. Conservez votre numéro de commande pour le suivi.
        </p>

        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="eyebrow">Numéro de commande</p>
          <div className="flex items-center gap-2">
            <p className="font-mono text-2xl font-semibold tracking-wide select-all sm:text-3xl" data-testid="order-number">
              {order.orderNumber}
            </p>
            <Button type="button" variant="outline" size="icon" className="size-10" onClick={() => void copy()} aria-label="Copier le numéro de commande">
              {copied ? <CheckCircle2 className="text-success" aria-hidden /> : <Copy aria-hidden />}
            </Button>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm">
            {order.status === "pending" ? <ToneBadge tone="warning">En attente de confirmation</ToneBadge> : <OrderStatusBadge status={order.status} />}
            <span className="text-muted-foreground">Passée le {formatDateTime(order.createdAt)}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
        <div className="space-y-8">
          <section aria-labelledby="confirmation-items" className="bg-card border-border rounded-lg border p-5 sm:p-6">
            <h2 id="confirmation-items" className="font-display mb-5 text-xl">
              Votre commande
            </h2>
            <OrderLines lines={order.items.map(orderItemToLine)} />
            <TotalsBreakdown
              className="border-border mt-5 border-t pt-5"
              subtotal={order.subtotal}
              discount={order.discountTotal}
              promoCode={order.promoCode}
              shippingFee={order.shippingFee}
              total={order.total}
              totalLabel="Total à payer à la livraison"
            />
          </section>

          <section aria-labelledby="confirmation-delivery" className="bg-card border-border rounded-lg border p-5 sm:p-6">
            <h2 id="confirmation-delivery" className="font-display mb-4 text-xl">
              Livraison
            </h2>
            <div className="flex items-start gap-3 text-sm">
              {pickup ? <Building2 className="mt-0.5 size-5 shrink-0" aria-hidden /> : <Home className="mt-0.5 size-5 shrink-0" aria-hidden />}
              <address className="leading-relaxed not-italic">
                <p className="font-medium">{pickup ? "Livraison en bureau" : "Livraison à domicile"}</p>
                {pickup && order.shippingAddress.pickupPointName && <p>{order.shippingAddress.pickupPointName}</p>}
                <p className="text-muted-foreground">{order.shippingAddress.address}</p>
                <p className="text-muted-foreground">
                  {order.shippingAddress.commune}, {order.shippingAddress.wilayaName}
                </p>
                <p className="mt-2">
                  {order.customer.firstName} {order.customer.lastName} · {formatPhone(order.customer.phone)}
                </p>
              </address>
            </div>
            {order.customerNote && (
              <p className="text-muted-foreground border-border mt-4 border-t pt-4 text-sm">
                <span className="text-foreground font-medium">Votre remarque : </span>
                {order.customerNote}
              </p>
            )}
          </section>
        </div>

        <aside aria-labelledby="confirmation-steps" className="space-y-6">
          <div className="bg-card border-border rounded-lg border p-5 sm:p-6">
            <h2 id="confirmation-steps" className="font-display mb-5 text-xl">
              Et maintenant ?
            </h2>
            <ol className="space-y-5">
              {NEXT_STEPS.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="flex gap-3.5">
                  <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">
                      <span className="sr-only">Étape {index + 1} : </span>
                      {title}
                    </p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="h-12 text-base">
              <Link href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}>Suivre ma commande</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 text-base">
              <Link href="/shop">Continuer les achats</Link>
            </Button>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container-store py-8 md:py-12">{children}</div>;
}

function Actions() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button asChild className="h-11">
        <Link href="/shop">Continuer les achats</Link>
      </Button>
      <Button asChild variant="outline" className="h-11">
        <Link href="/account/orders">Suivre mes commandes</Link>
      </Button>
    </div>
  );
}
