"use client";

import { formatDZD, formatDateTime, formatPhone } from "@fashion/shared";
import { ClipboardList, Eye } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TablePagination } from "@/components/admin/table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlParams } from "@/features/inventory/use-url-params";
import { useLatest } from "@/features/inventory/use-latest";
import { useOrders } from "@/features/orders/hooks";
import {
  DELIVERY_LABELS,
  ORDERS_PAGE_SIZE,
  countByStatus,
  customerFullName,
  parseAmount,
  parseOrderStatusParam,
  sortOrders,
} from "@/features/orders/logic";
import { getErrorMessage } from "@/services";
import type { Order, OrderFilters, OrderStatus } from "@/types/order.types";
import { DEFAULT_ORDER_FILTERS, OrdersFilters, type OrderFilterState } from "./orders-filters";
import { OrderStatusMenu } from "./order-status-menu";
import { PaymentBadge } from "./payment-badge";

const detailHref = (o: Pick<Order, "id">) => `/admin/dashboard/orders/${o.id}`;

export function OrdersView() {
  const { searchParams, setParams } = useUrlParams();
  const status = parseOrderStatusParam(searchParams.get("status"));
  const [filters, setFilters] = useState<OrderFilterState>(() => ({ ...DEFAULT_ORDER_FILTERS, search: searchParams.get("search") ?? "" }));
  const [page, setPage] = useState(1);

  // Les compteurs par statut tiennent compte des autres filtres : on charge sans le statut, puis on filtre localement.
  const query: OrderFilters = {
    search: filters.search.trim() || undefined,
    deliveryMethod: filters.delivery,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    minTotal: parseAmount(filters.minTotal),
    maxTotal: parseAmount(filters.maxTotal),
  };
  const { data: fetched, isLoading, isError, error, refetch } = useOrders(query);
  const data = useLatest(fetched);

  const counts = useMemo(() => countByStatus(data ?? []), [data]);
  const visible = useMemo(() => {
    const byStatus = (data ?? []).filter((o) => status === "all" || o.status === status);
    return sortOrders(byStatus, filters.sort);
  }, [data, status, filters.sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / ORDERS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice((currentPage - 1) * ORDERS_PAGE_SIZE, currentPage * ORDERS_PAGE_SIZE);

  const onChange = (patch: Partial<OrderFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };
  const onStatusChange = (s: OrderStatus | "all") => {
    setParams({ status: s === "all" ? null : s });
    setPage(1);
  };
  const reset = () => {
    setFilters({ ...DEFAULT_ORDER_FILTERS, sort: filters.sort });
    setParams({ status: null, search: null });
    setPage(1);
  };
  const isFiltered = status !== "all" || filters.search.trim() !== "" || filters.delivery !== "all" || !!filters.dateFrom || !!filters.dateTo || !!filters.minTotal || !!filters.maxTotal;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <OrdersFilters value={filters} status={status} counts={counts} onChange={onChange} onStatusChange={onStatusChange} onReset={reset} />
      <div className="border-t">
        {!data && isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Chargement des commandes">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              icon={ClipboardList}
              title="Impossible de charger les commandes"
              description={getErrorMessage(error)}
              action={
                <Button variant="outline" onClick={() => void refetch()}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ClipboardList}
              title="Aucune commande"
              description={isFiltered ? "Aucune commande ne correspond à ces filtres." : "Les commandes passées sur la boutique apparaîtront ici."}
              action={
                isFiltered ? (
                  <Button variant="outline" onClick={reset}>
                    Réinitialiser les filtres
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <OrdersTable orders={pageItems} />
            <TablePagination page={currentPage} pageSize={ORDERS_PAGE_SIZE} total={visible.length} onPageChange={setPage} />
          </>
        )}
      </div>
    </Card>
  );
}

function CustomerCell({ order }: { order: Order }) {
  return (
    <>
      <p className="font-medium">{customerFullName(order.customer)}</p>
      <a href={`tel:${order.customer.phone.replace(/\s/g, "")}`} className="text-muted-foreground text-xs underline-offset-2 hover:underline">
        {formatPhone(order.customer.phone)}
      </a>
    </>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <Table>
          <TableCaption className="sr-only">Liste des commandes</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>N° commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Livraison</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Paiement (COD)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link href={detailHref(o)} className="text-brand font-mono text-xs font-medium underline-offset-2 hover:underline">
                    {o.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <CustomerCell order={o} />
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(o.createdAt)}</TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatDZD(o.total)}</TableCell>
                <TableCell>
                  <p>{DELIVERY_LABELS[o.deliveryMethod]}</p>
                  <p className="text-muted-foreground text-xs">{o.shippingAddress.wilayaName}</p>
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={o.status} />
                </TableCell>
                <TableCell>
                  <PaymentBadge order={o} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link href={detailHref(o)} aria-label={`Voir la commande ${o.orderNumber}`} title="Voir le détail">
                        <Eye aria-hidden />
                      </Link>
                    </Button>
                    <OrderStatusMenu order={o} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:hidden" aria-label="Commandes">
        {orders.map((o) => (
          <li key={o.id} className="bg-card rounded-lg border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Link href={detailHref(o)} className="text-brand font-mono text-xs font-medium underline-offset-2 hover:underline">
                {o.orderNumber}
              </Link>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="mt-2">
              <CustomerCell order={o} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatDateTime(o.createdAt)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-muted-foreground">Total à encaisser</dt>
                <dd className="text-sm font-semibold tabular-nums">{formatDZD(o.total)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Livraison</dt>
                <dd>
                  {DELIVERY_LABELS[o.deliveryMethod]} · {o.shippingAddress.wilayaName}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-muted-foreground mb-0.5">Paiement</dt>
                <dd>
                  <PaymentBadge order={o} />
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={detailHref(o)}>
                  <Eye aria-hidden /> Détail
                </Link>
              </Button>
              <OrderStatusMenu order={o} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
