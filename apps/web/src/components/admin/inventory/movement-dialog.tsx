"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { stockMovementSchema, type StockMovementValues } from "@fashion/validators";
import { ArrowRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRecordMovement } from "@/features/inventory/hooks";
import {
  MANUAL_MOVEMENT_TYPES,
  MOVEMENT_QUANTITY_LABELS,
  MOVEMENT_TYPE_LABELS,
  REASON_SUGGESTIONS,
  computeNewStock,
  isFutureDate,
  movementDateToIso,
  movementNeedsConfirmation,
  toLocalDateInput,
  validateMovementQuantity,
  type ManualMovementType,
} from "@/features/inventory/logic";
import { cn } from "@/lib/utils";
import { ServiceError, getErrorMessage } from "@/services";
import type { InventoryItem } from "@/types/inventory.types";
import { VariantPicker } from "./variant-picker";

type MovementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Toutes les variantes (liste de choix quand aucune n'est pré-sélectionnée). */
  items: InventoryItem[];
  /** Variante pré-sélectionnée (action depuis une ligne). */
  variantId?: string;
  defaultType?: ManualMovementType;
};

/**
 * Résolveur : schéma partagé (`stockMovementSchema`) + règles dépendant du stock courant
 * (sortie ≤ stock, ajustement ≠ stock) et de la date (jamais dans le futur).
 */
function makeResolver(items: InventoryItem[]): Resolver<StockMovementValues> {
  const base = zodResolver(stockMovementSchema) as Resolver<StockMovementValues>;
  return async (values, context, options) => {
    const result = await base(values, context, options);
    const errors: FieldErrors<StockMovementValues> = { ...result.errors };
    const current = items.find((i) => i.variantId === values.variantId)?.stock;
    if (!errors.quantity && current !== undefined) {
      const message = validateMovementQuantity(values.type as ManualMovementType, values.quantity, current);
      if (message) errors.quantity = { type: "validate", message };
    }
    if (!errors.date && values.date && isFutureDate(values.date)) {
      errors.date = { type: "validate", message: "La date ne peut pas être dans le futur." };
    }
    if (Object.keys(errors).length > 0) return { values: {}, errors };
    return result;
  };
}

export function MovementDialog({ open, onOpenChange, items, variantId, defaultType = "in" }: MovementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mouvement de stock</DialogTitle>
          <DialogDescription>Le stock est géré par variante (taille × couleur). Chaque mouvement est historisé.</DialogDescription>
        </DialogHeader>
        <MovementForm items={items} variantId={variantId} defaultType={defaultType} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MovementForm({
  items,
  variantId,
  defaultType,
  onDone,
}: {
  items: InventoryItem[];
  variantId?: string;
  defaultType: ManualMovementType;
  onDone: () => void;
}) {
  const [today] = useState(() => toLocalDateInput(new Date()));
  const [pendingValues, setPendingValues] = useState<StockMovementValues | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const record = useRecordMovement();
  const resolver = useMemo(() => makeResolver(items), [items]);

  const form = useForm<StockMovementValues>({
    resolver,
    defaultValues: { variantId: variantId ?? "", type: defaultType, quantity: undefined, reason: "", date: today },
  });
  const { control, register, handleSubmit, setValue, setError, trigger, formState } = form;
  const { errors } = formState;

  const [watchedVariant, watchedType, watchedQuantity] = useWatch({ control, name: ["variantId", "type", "quantity"] });
  const type = watchedType as ManualMovementType;
  const selected = items.find((i) => i.variantId === watchedVariant);
  const current = selected?.stock ?? 0;
  const hasQuantity = typeof watchedQuantity === "number" && Number.isFinite(watchedQuantity);
  const nextStock = selected && hasQuantity ? computeNewStock(type, watchedQuantity, current) : null;

  const submit = async (values: StockMovementValues) => {
    setServerError(null);
    try {
      await record.mutateAsync({
        variantId: values.variantId,
        type: values.type,
        quantity: values.quantity,
        reason: values.reason.trim(),
        date: movementDateToIso(values.date),
      });
      toast.success(`Stock mis à jour : ${MOVEMENT_TYPE_LABELS[values.type].toLowerCase()} enregistré(e).`);
      setPendingValues(null);
      onDone();
    } catch (err) {
      setPendingValues(null);
      const message = getErrorMessage(err);
      if (err instanceof ServiceError && err.code === "OUT_OF_STOCK") setError("quantity", { type: "server", message });
      else setServerError(message);
      toast.error(message);
    }
  };

  const onValid = (values: StockMovementValues) => {
    const stock = items.find((i) => i.variantId === values.variantId)?.stock ?? 0;
    if (movementNeedsConfirmation(values.type as ManualMovementType, values.quantity, stock)) {
      setPendingValues(values);
      return;
    }
    void submit(values);
  };

  const pendingStock = pendingValues ? items.find((i) => i.variantId === pendingValues.variantId)?.stock ?? 0 : 0;
  const pendingNext = pendingValues ? computeNewStock(pendingValues.type as ManualMovementType, pendingValues.quantity, pendingStock) : 0;

  return (
    <>
      <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-4">
        <FormField label="Variante" htmlFor="mv-variant" error={errors.variantId?.message} required>
          <Controller
            control={control}
            name="variantId"
            render={({ field }) => (
              <VariantPicker id="mv-variant" items={items} value={field.value} onChange={field.onChange} invalid={!!errors.variantId} />
            )}
          />
        </FormField>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Type de mouvement</legend>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  if (formState.isSubmitted) void trigger("quantity");
                }}
                className="grid grid-cols-2 gap-2"
                aria-label="Type de mouvement"
              >
                {MANUAL_MOVEMENT_TYPES.map((t) => (
                  <Label
                    key={t}
                    htmlFor={`mv-type-${t}`}
                    className={cn(
                      "hover:bg-accent min-h-10 cursor-pointer rounded-md border px-3 py-2 font-normal",
                      field.value === t && "border-primary bg-accent font-medium",
                    )}
                  >
                    <RadioGroupItem id={`mv-type-${t}`} value={t} />
                    {MOVEMENT_TYPE_LABELS[t]}
                  </Label>
                ))}
              </RadioGroup>
            )}
          />
        </fieldset>

        <FormField
          label={MOVEMENT_QUANTITY_LABELS[type]}
          htmlFor="mv-quantity"
          error={errors.quantity?.message}
          hint={type === "adjustment" ? "Saisissez la quantité réellement comptée : elle remplace le stock actuel." : undefined}
          required
        >
          <Input
            id="mv-quantity"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            aria-invalid={!!errors.quantity}
            aria-describedby={errors.quantity ? "mv-quantity-error" : undefined}
            {...register("quantity", { valueAsNumber: true })}
          />
        </FormField>

        <div
          aria-live="polite"
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2.5 text-sm",
            selected ? "bg-muted/60" : "text-muted-foreground border-dashed",
          )}
        >
          {selected ? (
            <>
              <span className="text-muted-foreground">Stock actuel</span>
              <span className="font-semibold tabular-nums">{current}</span>
              <ArrowRight className="text-muted-foreground size-4" aria-hidden />
              <span className="text-muted-foreground">Nouveau stock</span>
              <span className={cn("font-semibold tabular-nums", nextStock !== null && nextStock < 0 && "text-destructive")}>
                {nextStock === null ? "—" : nextStock}
              </span>
              {nextStock !== null && nextStock !== current && (
                <span className="text-muted-foreground text-xs tabular-nums">({nextStock - current > 0 ? "+" : "−"}{Math.abs(nextStock - current)})</span>
              )}
            </>
          ) : (
            "Choisissez une variante pour voir l'effet sur le stock."
          )}
        </div>

        <FormField label="Motif" htmlFor="mv-reason" error={errors.reason?.message} required>
          <Input
            id="mv-reason"
            maxLength={160}
            placeholder="Ex. Réception fournisseur"
            aria-invalid={!!errors.reason}
            aria-describedby={errors.reason ? "mv-reason-error" : undefined}
            {...register("reason")}
          />
          <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Motifs suggérés">
            {REASON_SUGGESTIONS[type].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue("reason", s, { shouldValidate: true, shouldDirty: true })}
                className="bg-secondary hover:bg-accent focus-visible:ring-ring/50 min-h-8 rounded-full border px-3 text-xs transition-colors focus-visible:ring-[3px]"
              >
                {s}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Date du mouvement" htmlFor="mv-date" error={errors.date?.message} required>
          <Input
            id="mv-date"
            type="date"
            max={today}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? "mv-date-error" : undefined}
            {...register("date")}
          />
        </FormField>

        {serverError && (
          <p role="alert" className="bg-destructive-soft text-destructive rounded-md px-3 py-2 text-sm">
            {serverError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onDone} disabled={record.isPending}>
            Annuler
          </Button>
          <Button type="submit" disabled={record.isPending}>
            {record.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer le mouvement
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingValues !== null}
        onOpenChange={(o) => !o && setPendingValues(null)}
        title="Confirmer ce mouvement de stock ?"
        variant="destructive"
        confirmLabel="Confirmer"
        isPending={record.isPending}
        description={
          pendingValues && (
            <div className="space-y-2">
              <p>
                {pendingNext === 0
                  ? "Cette opération met le stock de la variante à 0 : elle deviendra indisponible à la vente."
                  : "Cette opération réduit le stock de plus de la moitié."}
              </p>
              <p className="font-medium tabular-nums">
                Stock : {pendingStock} → {pendingNext}
              </p>
            </div>
          )
        }
        onConfirm={() => (pendingValues ? submit(pendingValues) : undefined)}
      />
    </>
  );
}
