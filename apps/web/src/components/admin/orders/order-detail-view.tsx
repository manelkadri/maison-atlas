"use client";

import { formatDZD, formatDateTime, formatPhone } from "@fashion/shared";
import { ClipboardList, Mail, MapPin, Phone, Printer, User } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductImage } from "@/components/ui/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrder } from "@/features/orders/hooks";
import { DELIVERY_LABELS, customerFullName } from "@/features/orders/logic";
import { useSettings } from "@/features/settings/hooks";
import { getErrorMessage } from "@/services";
import type { Order } from "@/types/order.types";
import { OrderSlip } from "./order-slip";
import { OrderStatusChanger } from "./order-status-changer";
import { OrderTimeline } from "./order-timeline";
import { PaymentBadge } from "./payment-badge";

function InfoCard({ title, icon: Icon, children }: { title: string; icon: typeof User; children: ReactNode }) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="text-muted-foreground size-4" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-5 text-sm">{children}</CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement de la commande">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function OrderDetailView({ id }: { id: string }) {
  const { data: order, isLoading, isError, error, refetch } = useOrder(id);
  const { data: settings } = useSettings();

  if (isLoading) return <DetailSkeleton />;
  if (isError) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Impossible de charger la commande"
        description={getErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Réessayer
          </Button>
        }
      />
    );
  }
  if (!order) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Commande introuvable"
        description="Cette commande n'existe pas ou a été supprimée (par exemple après une réinitialisation des données de démonstration)."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/dashboard/orders">Retour aux commandes</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="no-print space-y-4">
        <OrderHeader order={order} />
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <OrderItemsCard order={order} />
            <Card className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-base">Historique des statuts</CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                <OrderTimeline history={order.statusHistory} />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <OrderStatusChanger order={order} />
            <CustomerCard order={order} />
            <DeliveryCard order={order} />
          </div>
        </div>
      </div>
      <OrderSlip order={order} settings={settings} />
    </>
  );
}

function OrderHeader({ order }: { order: Order }) {
  return (
    <Card className="gap-0 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 className="font-mono text-lg font-semibold">{order.orderNumber}</h2>
          <p className="text-muted-foreground text-sm">Passée le {formatDateTime(order.createdAt)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentBadge order={order} />
            <span className="text-muted-foreground text-xs">Paiement à la livraison</span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="sm:text-right">
            <p className="text-muted-foreground text-xs">Total à encaisser à la livraison</p>
            <p className="text-2xl font-semibold tabular-nums">{formatDZD(order.total)}</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden /> Imprimer le bon de commande
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OrderItemsCard({ order }: { order: Order }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="text-base">Articles ({order.items.reduce((s, i) => s + i.quantity, 0)})</CardTitle>
      </CardHeader>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableCaption className="sr-only">Articles de la commande {order.orderNumber}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead className="text-right">Prix unitaire</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ProductImage src={it.imageUrl} alt="" ratio="1/1" className="size-11 shrink-0 rounded-md" sizes="44px" />
                    <Link href={`/admin/dashboard/products/${it.productId}/edit`} className="hover:text-brand font-medium underline-offset-2 hover:underline">
                      {it.productName}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{it.sku}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <ColorSwatch color={it.colorCode} /> {it.color} · {it.size}
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{formatDZD(it.unitPrice)}</TableCell>
                <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatDZD(it.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y md:hidden" aria-label="Articles">
        {order.items.map((it) => (
          <li key={it.id} className="flex gap-3 p-4 text-sm">
            <ProductImage src={it.imageUrl} alt="" ratio="1/1" className="size-14 shrink-0 rounded-md" sizes="56px" />
            <div className="min-w-0 flex-1">
              <Link href={`/admin/dashboard/products/${it.productId}/edit`} className="font-medium underline-offset-2 hover:underline">
                {it.productName}
              </Link>
              <p className="text-muted-foreground font-mono text-xs">{it.sku}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                <ColorSwatch color={it.colorCode} className="size-3" /> {it.color} · {it.size}
              </p>
              <p className="mt-1 flex items-center justify-between tabular-nums">
                <span className="text-muted-foreground text-xs">
                  {it.quantity} × {formatDZD(it.unitPrice)}
                </span>
                <span className="font-medium">{formatDZD(it.lineTotal)}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="bg-muted/40 space-y-1.5 border-t px-5 py-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Sous-total</dt>
          <dd className="tabular-nums">{formatDZD(order.subtotal)}</dd>
        </div>
        {order.discountTotal > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Remise{order.promoCode ? ` (code ${order.promoCode})` : ""}</dt>
            <dd className="text-success tabular-nums">−{formatDZD(order.discountTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Livraison (facturée à part)</dt>
          <dd className="tabular-nums">{order.shippingFee === 0 ? "Offerte" : formatDZD(order.shippingFee)}</dd>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <dt>Total à encaisser à la livraison</dt>
          <dd className="tabular-nums">{formatDZD(order.total)}</dd>
        </div>
      </dl>
    </Card>
  );
}

function CustomerCard({ order }: { order: Order }) {
  const c = order.customer;
  return (
    <InfoCard title="Client" icon={User}>
      <p className="font-medium">{customerFullName(c)}</p>
      <p className="flex items-center gap-2">
        <Phone className="text-muted-foreground size-3.5" aria-hidden />
        <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="underline-offset-2 hover:underline">
          {formatPhone(c.phone)}
        </a>
      </p>
      {c.email && (
        <p className="flex items-center gap-2 break-all">
          <Mail className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <a href={`mailto:${c.email}`} className="underline-offset-2 hover:underline">
            {c.email}
          </a>
        </p>
      )}
      {c.customerId && (
        <p className="pt-2">
          <Link href={`/admin/dashboard/customers/${c.customerId}`} className="text-brand text-sm underline-offset-2 hover:underline">
            Voir la fiche client
          </Link>
        </p>
      )}
    </InfoCard>
  );
}

function DeliveryCard({ order }: { order: Order }) {
  const a = order.shippingAddress;
  return (
    <InfoCard title={`Livraison — ${DELIVERY_LABELS[order.deliveryMethod]}`} icon={MapPin}>
      {order.deliveryMethod === "pickup_point" ? (
        <p className="font-medium">{a.pickupPointName ?? "Bureau de livraison"}</p>
      ) : (
        <p className="font-medium">{a.address || "Adresse non renseignée"}</p>
      )}
      <p>
        {a.commune}, {a.wilayaName}
      </p>
      {order.customerNote && (
        <div className="bg-muted/60 mt-3 rounded-md p-3">
          <p className="text-muted-foreground text-xs font-medium">Remarque du client</p>
          <p className="mt-0.5">{order.customerNote}</p>
        </div>
      )}
    </InfoCard>
  );
}
