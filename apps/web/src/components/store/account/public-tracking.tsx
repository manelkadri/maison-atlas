"use client";

import { formatDateTime, formatDZD } from "@fashion/shared";
import { useState } from "react";
import { TotalsBreakdown } from "@/components/store/cart/totals-breakdown";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import type { PublicTrackedOrder } from "@/types/order.types";
import { buildTimeline, describePayment } from "./order-utils";
import { TrackOrderForm } from "./track-order-form";

/**
 * Résultat du suivi public : uniquement ce que le serveur renvoie (`PublicTrackedOrder`) : prénom, lieu de livraison
 * (commune + wilaya, ou bureau), articles, totaux et étapes. Ni adresse, ni téléphone, ni note.
 */
export function PublicTrackedOrderView({ order, onReset }: { order: PublicTrackedOrder; onReset: () => void }) {
  const timeline = buildTimeline(order);
  const payment = describePayment(order);
  const pickup = order.shippingAddress.deliveryMethod === "pickup_point";

  return (
    <div className="space-y-8" data-testid="public-tracking">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Commande</p>
          <h2 className="font-display mt-2 text-3xl">{order.orderNumber}</h2>
          <p className="text-muted-foreground mt-2 text-sm">Passée le {formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </header>

      <section aria-labelledby="tracking-steps">
        <h3 id="tracking-steps" className="font-display mb-4 text-xl">
          Suivi
        </h3>
        <ol className="space-y-3">
          {timeline.map((step) => (
            <li key={step.key} className="flex items-baseline justify-between gap-4 text-sm" aria-current={step.state === "current" ? "step" : undefined}>
              <span className={step.state === "upcoming" ? "text-muted-foreground" : "font-medium"}>{step.label}</span>
              {step.at && <span className="text-muted-foreground tabular-nums">{formatDateTime(step.at)}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="tracking-items">
        <h3 id="tracking-items" className="font-display mb-4 text-xl">
          Articles
        </h3>
        <ul className="divide-y rounded-md border">
          {order.items.map((item, index) => (
            <li key={`${item.productSlug}-${item.color}-${item.size}-${index}`} className="flex items-start justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-muted-foreground">
                  {item.color} · {item.size} · Qté {item.quantity}
                </p>
              </div>
              <p className="tabular-nums">{formatDZD(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <TotalsBreakdown
          className="mt-4"
          subtotal={order.subtotal}
          discount={order.discountTotal}
          promoCode={order.promoCode}
          shippingFee={order.shippingFee}
          total={order.total}
          totalLabel="Total à payer à la livraison"
        />
      </section>

      <section aria-labelledby="tracking-delivery" className="space-y-1 text-sm">
        <h3 id="tracking-delivery" className="font-display mb-2 text-xl">
          Livraison
        </h3>
        <p className="font-medium">{pickup ? "Livraison en bureau" : "Livraison à domicile"}</p>
        {pickup && order.shippingAddress.pickupPointName && <p>{order.shippingAddress.pickupPointName}</p>}
        <p className="text-muted-foreground">
          {order.shippingAddress.commune}, {order.shippingAddress.wilayaName}
        </p>
        <p className="text-muted-foreground pt-2">
          {payment.title} · {payment.detail}
        </p>
      </section>

      <button type="button" onClick={onReset} className="min-h-10 text-sm font-medium underline underline-offset-4">
        Suivre une autre commande
      </button>
    </div>
  );
}

/** Page publique « Suivre une commande » (sans compte). */
export function PublicTracking({ initialOrderNumber }: { initialOrderNumber?: string }) {
  const [order, setOrder] = useState<PublicTrackedOrder | null>(null);
  return (
    <div className="container-store max-w-2xl py-10 lg:py-14">
      <header className="mb-8">
        <p className="eyebrow">Suivi</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">Suivre une commande</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Saisissez le numéro de commande et le téléphone utilisé lors de la commande. Pour votre sécurité, seules les informations de suivi sont
          affichées. Connectée ? Retrouvez le détail complet dans « Mon espace ».
        </p>
      </header>
      {order ? (
        <PublicTrackedOrderView order={order} onReset={() => setOrder(null)} />
      ) : (
        <div className="bg-card rounded-md border p-5 sm:p-6">
          <TrackOrderForm initialOrderNumber={initialOrderNumber} onFound={setOrder} />
        </div>
      )}
    </div>
  );
}
