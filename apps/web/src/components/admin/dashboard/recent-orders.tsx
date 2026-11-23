import Link from "next/link";
import { formatDate, formatDZD } from "@fashion/shared";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_ROOT } from "@/config/admin-nav";
import type { Order } from "@/types/order.types";

/** Dernières commandes : tableau dès `sm`, cartes en dessous. Les numéros mènent à la fiche commande. */
export function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">Dernières commandes</h2>
        <Link href={`${ADMIN_ROOT}/orders`} className="text-brand inline-flex items-center gap-1 text-xs font-medium hover:underline">
          Tout voir <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Aucune commande" description="Les nouvelles commandes de la boutique apparaîtront ici." className="m-4 border-0" />
      ) : (
        <>
          <div className="hidden sm:block">
            <Table>
              <TableCaption className="sr-only">Les {orders.length} dernières commandes</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-5 text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-5 font-medium">
                      <Link href={`${ADMIN_ROOT}/orders/${o.id}`} className="hover:text-brand underline-offset-4 hover:underline">
                        {o.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate">
                      {o.customer.firstName} {o.customer.lastName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatDZD(o.total)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground pr-5 text-right whitespace-nowrap">{formatDate(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y sm:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`${ADMIN_ROOT}/orders/${o.id}`} className="hover:bg-accent/50 flex flex-col gap-1.5 px-4 py-3">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{o.orderNumber}</span>
                    <OrderStatusBadge status={o.status} />
                  </span>
                  <span className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {o.customer.firstName} {o.customer.lastName}
                    </span>
                    <span className="text-foreground tabular-nums">{formatDZD(o.total)}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">{formatDate(o.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
