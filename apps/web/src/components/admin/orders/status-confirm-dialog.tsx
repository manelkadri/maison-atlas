"use client";

import { ORDER_STATUS_LABELS } from "@fashion/shared";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { STATUS_CONFIRMATIONS } from "@/features/orders/logic";
import type { Order, OrderStatus } from "@/types/order.types";

type Props = {
  order: Pick<Order, "orderNumber" | "status">;
  target: OrderStatus | null;
  note?: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

/** Confirmation obligatoire des changements de statut sensibles, avec leurs conséquences. */
export function StatusConfirmDialog({ order, target, note, isPending, onCancel, onConfirm }: Props) {
  const config = target ? STATUS_CONFIRMATIONS[target] : undefined;
  return (
    <ConfirmDialog
      open={target !== null && config !== undefined}
      onOpenChange={(o) => !o && onCancel()}
      title={config?.title ?? "Confirmer le changement de statut"}
      confirmLabel={config?.confirmLabel}
      variant={config?.destructive ? "destructive" : "default"}
      isPending={isPending}
      onConfirm={onConfirm}
      description={
        target && (
          <div className="space-y-3">
            <p>
              Commande <strong className="font-mono">{order.orderNumber}</strong> : {ORDER_STATUS_LABELS[order.status]} →{" "}
              <strong>{ORDER_STATUS_LABELS[target]}</strong>
            </p>
            {config && (
              <ul className="list-disc space-y-1 pl-5">
                {config.consequences.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            {note?.trim() && <p className="text-muted-foreground">Note : {note.trim()}</p>}
          </div>
        )
      }
    />
  );
}
