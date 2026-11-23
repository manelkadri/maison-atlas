"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, PackageX, ShoppingBag } from "lucide-react";
import { formatDZD } from "@fashion/shared";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { useInventory } from "@/features/inventory/hooks";
import { useOrders } from "@/features/orders/hooks";
import { cn } from "@/lib/utils";

const MAX_ITEMS = 4;

function SectionTitle({ icon: Icon, title, count, tone }: { icon: typeof Bell; title: string; count: number; tone: "warning" | "danger" }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3 pb-1">
      <Icon className={cn("size-4", tone === "warning" ? "text-warning" : "text-destructive")} aria-hidden />
      <h3 className="text-sm font-medium">{title}</h3>
      <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 text-xs tabular-nums">{count}</span>
    </div>
  );
}

const itemClass = "hover:bg-accent focus-visible:bg-accent block rounded-md px-3 py-2 text-sm outline-none";

/** Notifications du propriétaire : commandes en attente et variantes en rupture / stock faible (données réelles). */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const pending = useOrders({ status: "pending" });
  const out = useInventory({ status: "out_of_stock" });
  const low = useInventory({ status: "low" });

  const pendingOrders = pending.data ?? [];
  const outItems = out.data ?? [];
  const lowItems = low.data ?? [];
  const total = pendingOrders.length + outItems.length + lowItems.length;
  const isLoading = pending.isPending || out.isPending || low.isPending;
  const isError = pending.isError || out.isError || low.isError;
  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={total > 0 ? `Notifications : ${total} à traiter` : "Notifications : aucune"}>
          <Bell aria-hidden />
          {total > 0 && (
            <span
              aria-hidden
              className="bg-destructive absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-4 font-semibold text-white tabular-nums"
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <p className="text-muted-foreground text-xs">{total > 0 ? `${total} élément${total > 1 ? "s" : ""} à traiter` : "Rien à signaler"}</p>
        </div>

        <div className="max-h-[min(26rem,70vh)] overflow-y-auto pb-2">
          {isLoading && (
            <div className="space-y-2 p-4" role="status" aria-label="Chargement des notifications">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!isLoading && isError && (
            <div className="space-y-3 p-4 text-center">
              <p className="text-muted-foreground text-sm">Impossible de charger les notifications.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void pending.refetch();
                  void out.refetch();
                  void low.refetch();
                }}
              >
                Réessayer
              </Button>
            </div>
          )}

          {!isLoading && !isError && total === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CheckCircle2 className="text-success size-6" aria-hidden />
              <p className="text-sm font-medium">Tout est à jour</p>
              <p className="text-muted-foreground text-xs">Aucune commande en attente, aucun stock critique.</p>
            </div>
          )}

          {!isLoading && !isError && pendingOrders.length > 0 && (
            <section aria-label="Commandes en attente">
              <SectionTitle icon={ShoppingBag} title="Commandes en attente" count={pendingOrders.length} tone="warning" />
              <ul className="px-2">
                {pendingOrders.slice(0, MAX_ITEMS).map((o) => (
                  <li key={o.id}>
                    <Link href={`${ADMIN_ROOT}/orders/${o.id}`} onClick={close} className={itemClass}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{o.orderNumber}</span>
                        <span className="text-muted-foreground tabular-nums">{formatDZD(o.total)}</span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {o.customer.firstName} {o.customer.lastName}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="px-2">
                <Link href={`${ADMIN_ROOT}/orders?status=pending`} onClick={close} className="text-brand block rounded-md px-3 py-1.5 text-xs font-medium hover:underline">
                  Voir les {pendingOrders.length} commandes en attente
                </Link>
              </div>
            </section>
          )}

          {!isLoading && !isError && outItems.length > 0 && (
            <section aria-label="Variantes en rupture">
              <SectionTitle icon={PackageX} title="Variantes en rupture" count={outItems.length} tone="danger" />
              <ul className="px-2">
                {outItems.slice(0, MAX_ITEMS).map((i) => (
                  <li key={i.variantId}>
                    <Link href={`${ADMIN_ROOT}/inventory?status=out_of_stock`} onClick={close} className={itemClass}>
                      <span className="block truncate font-medium">{i.productName}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {i.color} · {i.size} · {i.sku}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="px-2">
                <Link href={`${ADMIN_ROOT}/inventory?status=out_of_stock`} onClick={close} className="text-brand block rounded-md px-3 py-1.5 text-xs font-medium hover:underline">
                  Voir les {outItems.length} variantes en rupture
                </Link>
              </div>
            </section>
          )}

          {!isLoading && !isError && lowItems.length > 0 && (
            <section aria-label="Stock faible">
              <SectionTitle icon={AlertTriangle} title="Stock faible" count={lowItems.length} tone="warning" />
              <ul className="px-2">
                {lowItems.slice(0, MAX_ITEMS).map((i) => (
                  <li key={i.variantId}>
                    <Link href={`${ADMIN_ROOT}/inventory?status=low`} onClick={close} className={itemClass}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{i.productName}</span>
                        <span className="text-warning shrink-0 text-xs tabular-nums">
                          {i.stock} restant{i.stock > 1 ? "s" : ""}
                        </span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {i.color} · {i.size}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="px-2">
                <Link href={`${ADMIN_ROOT}/inventory?status=low`} onClick={close} className="text-brand block rounded-md px-3 py-1.5 text-xs font-medium hover:underline">
                  Voir les {lowItems.length} variantes à stock faible
                </Link>
              </div>
            </section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
