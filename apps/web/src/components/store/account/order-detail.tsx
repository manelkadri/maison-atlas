"use client";

import { formatDateTime, formatDZD } from "@fashion/shared";
import { ArrowLeft, Check, CircleAlert, PackageSearch, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { useTrackedOrder } from "@/features/orders/hooks";
import { isApiMode } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { useCustomerSessionStore } from "@/stores/customer-session.store";
import type { Order } from "@/types/order.types";
import { TrackOrderForm } from "./track-order-form";
import { buildTimeline, countPieces, describePayment, isOwnOrder, type TimelineStep } from "./order-utils";

function BackLink() {
  return (
    <Link href="/account/orders" className="text-muted-foreground hover:text-foreground mb-6 inline-flex min-h-10 items-center gap-2 text-sm hover:underline">
      <ArrowLeft className="size-4" aria-hidden />
      Mes commandes
    </Link>
  );
}

function TimelineMarker({ state }: { state: TimelineStep["state"] }) {
  const base = "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2";
  if (state === "done") {
    return (
      <span className={cn(base, "bg-success border-success text-primary-foreground")} aria-hidden>
        <Check className="size-4" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className={cn(base, "bg-destructive border-destructive text-primary-foreground")} aria-hidden>
        <X className="size-4" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className={cn(base, "border-brand bg-background")} aria-hidden>
        <span className="bg-brand size-2.5 rounded-full" />
      </span>
    );
  }
  return <span className={cn(base, "bg-background border-border")} aria-hidden />;
}

const STATE_TEXT: Record<TimelineStep["state"], string> = {
  done: "Terminé",
  current: "En cours",
  upcoming: "À venir",
  failed: "Clôturée",
};

/** Suivi de commande : timeline verticale issue de `statusHistory`, avec les étapes à venir. */
export function OrderTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol aria-label="Suivi de la commande">
      {steps.map((step, index) => (
        <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0" aria-current={step.state === "current" ? "step" : undefined}>
          {index < steps.length - 1 && (
            <span
              className={cn("absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-0.5", steps[index + 1]?.state === "upcoming" ? "bg-border" : "bg-success/50")}
              aria-hidden
            />
          )}
          <TimelineMarker state={step.state} />
          <div className={cn("-mt-0.5 min-w-0 flex-1", step.state === "upcoming" && "text-muted-foreground")}>
            <p className="font-medium">
              {step.label}
              <span className="sr-only"> — {STATE_TEXT[step.state]}</span>
            </p>
            {step.at && <p className="text-muted-foreground text-sm">{formatDateTime(step.at)}</p>}
            {step.note && <p className="text-muted-foreground mt-1 text-sm">{step.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function SummaryRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", strong ? "pt-3 text-base font-semibold" : "text-sm")}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className={cn("tabular-nums", tone === "success" && "text-success")}>{value}</dd>
    </div>
  );
}

function Delivery({ order }: { order: Order }) {
  const a = order.shippingAddress;
  return (
    <address className="text-sm leading-relaxed not-italic">
      <p className="font-medium">
        {order.customer.firstName} {order.customer.lastName}
      </p>
      {a.deliveryMethod === "pickup_point" ? (
        <>
          <p>Retrait en bureau de livraison</p>
          <p>{a.pickupPointName ?? "Bureau de livraison"}</p>
          <p className="text-muted-foreground">
            {a.commune}, {a.wilayaName}
          </p>
        </>
      ) : (
        <>
          <p>Livraison à domicile</p>
          <p>{a.address}</p>
          <p className="text-muted-foreground">
            {a.commune}, {a.wilayaName}
          </p>
        </>
      )}
    </address>
  );
}

/** Mode API : le téléphone de cette commande n'est pas mémorisé sur l'appareil → saisie du couple numéro + téléphone. */
function NeedsPhone({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="max-w-xl">
      <BackLink />
      <h1 className="font-display text-2xl">Retrouvez votre commande</h1>
      <p className="text-muted-foreground mt-2 mb-6 text-sm leading-relaxed">
        Pour protéger vos données, saisissez le numéro de téléphone utilisé lors de la commande {orderNumber}.
      </p>
      <TrackOrderForm initialOrderNumber={orderNumber} />
    </div>
  );
}

function NotFound() {
  return (
    <div>
      <BackLink />
      <EmptyState
        icon={PackageSearch}
        title="Commande introuvable"
        description="Cette commande n'existe pas ou n'est pas associée à votre numéro de téléphone."
        action={
          <Link href="/account/orders" className="text-sm font-medium underline underline-offset-4">
            Retour à mes commandes
          </Link>
        }
      />
    </div>
  );
}

/**
 * Détail d'une commande.
 * Mode mock : visible uniquement si son téléphone correspond à la session simulée.
 * Mode API : lu avec le couple (numéro, téléphone) mémorisé sur l'appareil — le serveur ne répond que si les deux correspondent.
 */
export function OrderDetail({ orderNumber }: { orderNumber: string }) {
  const apiMode = isApiMode();
  const profile = useCustomerSessionStore((s) => s.profile);
  const { data: order, isLoading, isError, needsPhone } = useTrackedOrder(orderNumber);

  if (!apiMode && !profile) return null;
  if (needsPhone) return <NeedsPhone orderNumber={orderNumber} />;

  if (isLoading) {
    return (
      <div className="space-y-4" role="status">
        <span className="sr-only">Chargement de la commande…</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <BackLink />
        <p className="text-destructive" role="alert">
          Impossible de charger cette commande pour le moment. Veuillez réessayer.
        </p>
      </div>
    );
  }

  if (!order || (!apiMode && !isOwnOrder(order, profile?.phone))) return <NotFound />;

  const timeline = buildTimeline(order);
  const payment = describePayment(order);
  const pieces = countPieces(order);

  return (
    <div>
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Commande</p>
          <h1 className="font-display mt-2 text-3xl sm:text-4xl">{order.orderNumber}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Passée le {formatDateTime(order.createdAt)} · {pieces} article{pieces > 1 ? "s" : ""}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div className="space-y-10">
          <section aria-labelledby="order-items">
            <h2 id="order-items" className="font-display mb-4 text-xl">
              Articles
            </h2>
            <ul className="divide-y rounded-md border">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 p-4">
                  <Link href={`/product/${item.productSlug}`} className="bg-secondary relative block h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-sm">
                    <Image src={item.imageUrl} alt={item.productName} fill sizes="72px" className="object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${item.productSlug}`} className="font-medium hover:underline">
                      {item.productName}
                    </Link>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                      <span className="border-foreground/20 size-3 rounded-full border" style={{ backgroundColor: item.colorCode }} aria-hidden />
                      {item.color} · Taille {item.size}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm tabular-nums">
                      {item.quantity} × {formatDZD(item.unitPrice)}
                    </p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatDZD(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="order-tracking">
            <h2 id="order-tracking" className="font-display mb-5 text-xl">
              Suivi de la commande
            </h2>
            <OrderTimeline steps={timeline} />
          </section>
        </div>

        <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
          <section aria-labelledby="order-summary" className="bg-card rounded-md border p-5">
            <h2 id="order-summary" className="font-display mb-4 text-xl">
              Récapitulatif
            </h2>
            <dl className="space-y-2.5">
              <SummaryRow label="Sous-total" value={formatDZD(order.subtotal)} />
              {order.discountTotal > 0 && (
                <SummaryRow label={order.promoCode ? `Remise (${order.promoCode})` : "Remise"} value={`- ${formatDZD(order.discountTotal)}`} tone="success" />
              )}
              <SummaryRow label="Livraison" value={order.shippingFee > 0 ? formatDZD(order.shippingFee) : "Offerte"} />
              <div className="border-t" />
              <SummaryRow label="Total à payer à la livraison" value={formatDZD(order.total)} strong />
            </dl>
          </section>

          <section aria-labelledby="order-payment" className="space-y-2">
            <h2 id="order-payment" className="font-display text-xl">
              Paiement
            </h2>
            <p className="text-sm font-medium">{payment.title}</p>
            <p className="text-muted-foreground flex gap-2 text-sm leading-relaxed">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{payment.detail}</span>
            </p>
          </section>

          <section aria-labelledby="order-delivery" className="space-y-2">
            <h2 id="order-delivery" className="font-display text-xl">
              Livraison
            </h2>
            <Delivery order={order} />
          </section>

          {order.customerNote && (
            <section aria-labelledby="order-note" className="space-y-2">
              <h2 id="order-note" className="font-display text-xl">
                Votre remarque
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{order.customerNote}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
