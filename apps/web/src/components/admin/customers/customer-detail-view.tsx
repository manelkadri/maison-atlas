"use client";

import { formatDZD, formatDate, formatDateTime, formatPhone } from "@fashion/shared";
import { Banknote, Mail, MapPin, Phone, ShoppingBag, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { PaymentBadge } from "@/components/admin/orders/payment-badge";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge, ToneBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomer } from "@/features/customers/hooks";
import { computeCustomerStats, customerName, formatPercent, getWilayaName } from "@/features/customers/logic";
import { DELIVERY_LABELS } from "@/features/orders/logic";
import { getErrorMessage } from "@/services";

export function CustomerDetailView({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useCustomer(id);
  const stats = useMemo(() => (data ? computeCustomerStats(data.orders) : null), [data]);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Chargement de la fiche client">
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[102px]" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        icon={Users}
        title="Impossible de charger le client"
        description={getErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Réessayer
          </Button>
        }
      />
    );
  }
  if (!data || !stats) {
    return (
      <EmptyState
        icon={Users}
        title="Client introuvable"
        description="Cette fiche client n'existe pas (ou plus). Elle a pu disparaître après une réinitialisation des données de démonstration."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/dashboard/customers">Retour aux clients</Link>
          </Button>
        }
      />
    );
  }

  const { customer, orders } = data;
  const phoneHref = `tel:${customer.phone.replace(/\s/g, "")}`;

  return (
    <div className="space-y-4">
      <Card className="gap-0 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{customerName(customer)}</h2>
              {customer.isGuest && <ToneBadge tone="neutral">Invité</ToneBadge>}
            </div>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="text-muted-foreground size-4" aria-hidden />
                <a href={phoneHref} className="underline-offset-2 hover:underline">
                  {formatPhone(customer.phone)}
                </a>
              </li>
              <li className="flex items-center gap-2 break-all">
                <Mail className="text-muted-foreground size-4 shrink-0" aria-hidden />
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="underline-offset-2 hover:underline">
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {customer.address ? `${customer.address}, ` : ""}
                  {customer.commune}, {getWilayaName(customer.wilayaCode)}
                </span>
              </li>
            </ul>
            <p className="text-muted-foreground text-xs">Client depuis le {formatDate(customer.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={phoneHref}>
                <Phone aria-hidden /> Appeler
              </a>
            </Button>
            {customer.email && (
              <Button asChild variant="outline">
                <a href={`mailto:${customer.email}`}>
                  <Mail aria-hidden /> Écrire
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>

      <section aria-label="Indicateurs du client" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Commandes" value={String(stats.ordersCount)} hint={`${stats.deliveredCount} livrée(s)`} icon={ShoppingBag} />
        <StatCard label="Total livré" value={formatDZD(stats.deliveredTotal)} hint="Commandes livrées, hors livraison" icon={Banknote} tone="success" />
        <StatCard label="Panier moyen" value={formatDZD(stats.averageBasket)} hint="Sur les commandes livrées" icon={ShoppingBag} />
        <StatCard
          label="Taux d'annulation"
          value={formatPercent(stats.cancellationRate)}
          hint="Annulées, refusées, échecs et retours"
          icon={XCircle}
          tone={stats.cancellationRate >= 0.4 ? "danger" : stats.cancellationRate > 0 ? "warning" : "default"}
        />
      </section>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle className="text-base">Historique des commandes ({orders.length})</CardTitle>
        </CardHeader>
        {orders.length === 0 ? (
          <CardContent className="p-4">
            <EmptyState icon={ShoppingBag} title="Aucune commande" description="Ce client n'a pas encore passé de commande." />
          </CardContent>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableCaption className="sr-only">Commandes de {customerName(customer)}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° commande</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Livraison</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/admin/dashboard/orders/${o.id}`} className="text-brand font-mono text-xs font-medium underline-offset-2 hover:underline">
                          {o.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(o.createdAt)}</TableCell>
                      <TableCell>
                        {DELIVERY_LABELS[o.deliveryMethod]} · {o.shippingAddress.wilayaName}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell>
                        <PaymentBadge order={o} />
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatDZD(o.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden" aria-label="Commandes du client">
              {orders.map((o) => (
                <li key={o.id} className="space-y-2 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/dashboard/orders/${o.id}`} className="text-brand font-mono text-xs font-medium underline-offset-2 hover:underline">
                      {o.orderNumber}
                    </Link>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">{formatDateTime(o.createdAt)}</span>
                    <span className="font-semibold tabular-nums">{formatDZD(o.total)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {DELIVERY_LABELS[o.deliveryMethod]} · {o.shippingAddress.wilayaName}
                    </span>
                    <PaymentBadge order={o} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
