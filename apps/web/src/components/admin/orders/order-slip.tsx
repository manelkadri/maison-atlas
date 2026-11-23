"use client";

import { formatDZD, formatDate, formatDateTime, formatPhone } from "@fashion/shared";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { isRenderableLogo } from "@/components/ui/store-logo";
import { siteConfig } from "@/config/site";
import { DELIVERY_LABELS, customerFullName } from "@/features/orders/logic";
import type { Order } from "@/types/order.types";
import type { StoreSettings } from "@/types/settings.types";

const subscribe = () => () => undefined;
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * Règles d'impression : seul le bon est visible. Le bon est rendu dans un portail directement sous <body> ;
 * on masque tous les autres enfants de <body> (le layout admin, les toasts…) pour éviter pages blanches
 * et défilement parasites, et on remet le bon dans le flux normal.
 */
const PRINT_RULES = `@page { margin: 14mm; }
@media print {
  body > *:not([data-order-slip]) { display: none !important; }
  [data-order-slip] { position: static !important; padding: 0 !important; }
}`;

/** Bon de commande imprimable (A4). Invisible à l'écran, seul élément affiché à l'impression. */
export function OrderSlip({ order, settings }: { order: Order; settings?: StoreSettings }) {
  const isClient = useIsClient();
  if (!isClient) return null;

  const a = order.shippingAddress;
  const storeName = settings?.storeName ?? siteConfig.name;

  return createPortal(
    <div className="print-area hidden text-sm leading-relaxed print:block" data-order-slip aria-hidden="true">
      <style>{PRINT_RULES}</style>

      <header className="flex items-start justify-between gap-6 border-b pb-4">
        <div>
          {isRenderableLogo(settings?.logoUrl) && (
            // eslint-disable-next-line @next/next/no-img-element -- impression : <img> simple, sans optimisation ni chargement différé
            <img src={settings.logoUrl} alt="" className="mb-2 h-12 w-auto max-w-48 object-contain" />
          )}
          <p className="text-xl font-semibold">{storeName}</p>
          {settings?.address && <p>{settings.address}</p>}
          {settings && (
            <p>
              {settings.phone} · {settings.email}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tracking-wide uppercase">Bon de commande</p>
          <p className="font-mono">{order.orderNumber}</p>
          <p>Passée le {formatDateTime(order.createdAt)}</p>
          <p>Imprimé le {formatDate(new Date().toISOString())}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-4">
        <div>
          <p className="font-semibold uppercase">Client</p>
          <p>{customerFullName(order.customer)}</p>
          <p>{formatPhone(order.customer.phone)}</p>
          {order.customer.email && <p>{order.customer.email}</p>}
        </div>
        <div>
          <p className="font-semibold uppercase">Livraison — {DELIVERY_LABELS[order.deliveryMethod]}</p>
          {order.deliveryMethod === "pickup_point" && a.pickupPointName && <p>{a.pickupPointName}</p>}
          {order.deliveryMethod === "home" && a.address && <p>{a.address}</p>}
          <p>
            {a.commune}, {a.wilayaName}
          </p>
        </div>
      </section>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-y">
            <th className="py-2 pr-2">Article</th>
            <th className="py-2 pr-2">SKU</th>
            <th className="py-2 pr-2">Couleur</th>
            <th className="py-2 pr-2">Taille</th>
            <th className="py-2 pr-2 text-right">Qté</th>
            <th className="py-2 pr-2 text-right">Prix unit.</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id} className="border-b align-top">
              <td className="py-2 pr-2">{it.productName}</td>
              <td className="py-2 pr-2 font-mono text-xs">{it.sku}</td>
              <td className="py-2 pr-2">{it.color}</td>
              <td className="py-2 pr-2">{it.size}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{it.quantity}</td>
              <td className="py-2 pr-2 text-right whitespace-nowrap tabular-nums">{formatDZD(it.unitPrice)}</td>
              <td className="py-2 text-right whitespace-nowrap tabular-nums">{formatDZD(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 ml-auto w-72 space-y-1">
        <p className="flex justify-between">
          <span>Sous-total</span> <span className="tabular-nums">{formatDZD(order.subtotal)}</span>
        </p>
        {order.discountTotal > 0 && (
          <p className="flex justify-between">
            <span>Remise{order.promoCode ? ` (${order.promoCode})` : ""}</span>
            <span className="tabular-nums">-{formatDZD(order.discountTotal)}</span>
          </p>
        )}
        <p className="flex justify-between">
          <span>Livraison</span> <span className="tabular-nums">{formatDZD(order.shippingFee)}</span>
        </p>
        <p className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>Montant à encaisser</span> <span className="tabular-nums">{formatDZD(order.total)}</span>
        </p>
        <p className="text-xs">Paiement à la livraison (espèces).</p>
      </section>

      {order.customerNote && (
        <p className="mt-4 border p-3">
          <span className="font-semibold">Remarque du client : </span>
          {order.customerNote}
        </p>
      )}

      <section className="mt-10 grid grid-cols-2 gap-10">
        <div>
          <p className="font-semibold">Signature du client</p>
          <div className="mt-2 h-20 border" />
        </div>
        <div>
          <p className="font-semibold">Signature du livreur</p>
          <div className="mt-2 h-20 border" />
        </div>
      </section>
    </div>,
    document.body,
  );
}
