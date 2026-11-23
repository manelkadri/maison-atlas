"use client";

import { ORDER_STATUS_LABELS } from "@fashion/shared";
import { ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getAllowedTransitions, requiresConfirmation } from "@/features/orders/logic";
import { useOrderStatusChange } from "@/features/orders/use-order-status-change";
import type { Order, OrderStatus } from "@/types/order.types";
import { StatusConfirmDialog } from "./status-confirm-dialog";

/** Changement rapide de statut depuis la liste : uniquement les transitions autorisées. */
export function OrderStatusMenu({ order, labeled = false }: { order: Order; labeled?: boolean }) {
  const { change, isPending } = useOrderStatusChange();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const allowed = getAllowedTransitions(order.status);

  if (allowed.length === 0) {
    return <span className="text-muted-foreground text-xs">Statut final</span>;
  }

  const select = (status: OrderStatus) => {
    if (requiresConfirmation(status)) setTarget(status);
    else void change(order, status);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending} aria-label={`Changer le statut de la commande ${order.orderNumber}`}>
            {isPending && <Loader2 className="animate-spin" aria-hidden />}
            {labeled ? "Changer le statut" : "Statut"}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Passer à</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allowed.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => select(s)}>
              {ORDER_STATUS_LABELS[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <StatusConfirmDialog
        order={order}
        target={target}
        isPending={isPending}
        onCancel={() => setTarget(null)}
        onConfirm={async () => {
          if (!target) return;
          await change(order, target);
          setTarget(null);
        }}
      />
    </>
  );
}
