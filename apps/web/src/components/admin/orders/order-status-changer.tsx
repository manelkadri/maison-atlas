"use client";

import { ORDER_STATUS_LABELS } from "@fashion/shared";
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FINAL_STATUS_MESSAGES, getAllowedTransitions, requiresConfirmation } from "@/features/orders/logic";
import { useOrderStatusChange } from "@/features/orders/use-order-status-change";
import type { Order, OrderStatus } from "@/types/order.types";
import { StatusConfirmDialog } from "./status-confirm-dialog";

/** Modification du statut : uniquement les transitions autorisées, note optionnelle, confirmation si sensible. */
export function OrderStatusChanger({ order }: { order: Order }) {
  const { change, isPending } = useOrderStatusChange();
  const [target, setTarget] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const allowed = getAllowedTransitions(order.status);

  const apply = async () => {
    if (!target) return;
    const ok = await change(order, target, note);
    setConfirming(false);
    if (ok) {
      setTarget("");
      setNote("");
    }
  };

  const submit = () => {
    if (!target) return;
    if (requiresConfirmation(target)) setConfirming(true);
    else void apply();
  };

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Modifier le statut</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {allowed.length === 0 ? (
          <div className="bg-muted/60 flex items-start gap-3 rounded-md p-3 text-sm" role="note">
            <Lock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{FINAL_STATUS_MESSAGES[order.status] ?? "Ce statut est définitif : aucune modification n'est possible."}</p>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Statut actuel : <strong className="text-foreground">{ORDER_STATUS_LABELS[order.status]}</strong>. Seules les transitions autorisées sont proposées.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="order-next-status">Nouveau statut</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as OrderStatus)}>
                <SelectTrigger id="order-next-status" className="w-full">
                  <SelectValue placeholder="Choisir un statut" />
                </SelectTrigger>
                <SelectContent>
                  {allowed.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-status-note">Note (facultative)</Label>
              <Textarea
                id="order-status-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Ex. Client injoignable, rappel prévu demain"
              />
            </div>
            <Button type="button" onClick={submit} disabled={!target || isPending} className="w-full sm:w-auto">
              {isPending && <Loader2 className="animate-spin" aria-hidden />}
              Mettre à jour le statut
            </Button>
          </>
        )}
      </CardContent>
      <StatusConfirmDialog
        order={order}
        target={confirming && target ? target : null}
        note={note}
        isPending={isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={apply}
      />
    </Card>
  );
}
