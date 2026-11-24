"use client";

import { formatDate, formatDZD } from "@fashion/shared";
import { ChevronRight, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { useAccount, useMyOrders } from "@/features/account/hooks";
import { countPieces, paymentCaption } from "./order-utils";

/** Historique des commandes de la cliente connectée, plus récentes d'abord (le serveur filtre par la session). */
export function OrdersList() {
  const { data: profile } = useAccount();
  const { data, isLoading, isError, refetch } = useMyOrders(!!profile);
  if (!profile) return null;

  const orders = [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">Mon espace</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">Mes commandes</h1>
      </header>

      {isLoading ? (
        <div className="space-y-4" role="status">
          <span className="sr-only">Chargement de vos commandes…</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md border p-6 text-center" role="alert">
          <p className="text-destructive">Impossible de charger vos commandes.</p>
          <button type="button" onClick={() => refetch()} className="mt-3 min-h-10 text-sm font-medium underline underline-offset-4">
            Réessayer
          </button>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Vous n'avez pas encore de commande"
          description="Dès que vous aurez passé une commande, vous pourrez la suivre ici."
          action={
            <Link href="/shop" className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-6 text-sm font-medium">
              Découvrir la boutique
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const pieces = countPieces(order);
            const thumbs = order.items.slice(0, 3);
            return (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="bg-card hover:bg-accent/40 group flex flex-col gap-4 rounded-md border p-4 transition-colors sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="flex -space-x-3" aria-hidden>
                    {thumbs.map((item) => (
                      <span key={item.id} className="bg-secondary border-card relative block h-16 w-12 overflow-hidden rounded-sm border-2">
                        <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-medium">{order.orderNumber}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-sm">
                      {formatDate(order.createdAt)} · {pieces} article{pieces > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="sm:text-right">
                      <p className="font-medium tabular-nums">{formatDZD(order.total)}</p>
                      {paymentCaption(order) && <p className="text-muted-foreground text-xs">{paymentCaption(order)}</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium group-hover:underline">
                      Détail <ChevronRight className="size-4" aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
