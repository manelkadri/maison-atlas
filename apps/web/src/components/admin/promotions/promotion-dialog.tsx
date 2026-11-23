"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { promotionFormSchema, type PromotionFormValues } from "@fashion/validators";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreatePromotion, useUpdatePromotion } from "@/features/promotions/hooks";
import { endDateToIso, isoToDateInput, startDateToIso } from "@/features/promotions/logic";
import { ServiceError, getErrorMessage } from "@/services";
import type { Promotion } from "@/types/promotion.types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Promotion à modifier ; absente = création. */
  promotion?: Promotion | null;
};

function buildDefaults(promo?: Promotion | null): DefaultValues<PromotionFormValues> {
  if (promo) {
    return {
      code: promo.code,
      label: promo.label,
      type: promo.type,
      value: promo.value,
      startsAt: isoToDateInput(promo.startsAt),
      endsAt: isoToDateInput(promo.endsAt),
      minOrderAmount: promo.minOrderAmount,
      isActive: promo.isActive,
    };
  }
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 86_400_000);
  return {
    code: "",
    label: "",
    type: "percentage",
    value: undefined,
    startsAt: isoToDateInput(start.toISOString()),
    endsAt: isoToDateInput(end.toISOString()),
    minOrderAmount: 0,
    isActive: true,
  };
}

export function PromotionDialog({ open, onOpenChange, promotion }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{promotion ? "Modifier le code promo" : "Nouveau code promo"}</DialogTitle>
          <DialogDescription>
            La réduction s&apos;applique au sous-total des articles (hors livraison). Un code expiré ou inactif est refusé au panier.
          </DialogDescription>
        </DialogHeader>
        <PromotionForm promotion={promotion ?? null} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PromotionForm({ promotion, onDone }: { promotion: Promotion | null; onDone: () => void }) {
  const create = useCreatePromotion();
  const update = useUpdatePromotion();
  const [serverError, setServerError] = useState<string | null>(null);
  const isPending = create.isPending || update.isPending;

  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: buildDefaults(promotion),
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const { errors } = formState;
  const type = useWatch({ control, name: "type" });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const input = {
      code: values.code,
      label: values.label,
      type: values.type,
      value: values.value,
      startsAt: startDateToIso(values.startsAt),
      endsAt: endDateToIso(values.endsAt),
      minOrderAmount: values.minOrderAmount,
      isActive: values.isActive,
    };
    try {
      if (promotion) await update.mutateAsync({ id: promotion.id, data: input });
      else await create.mutateAsync(input);
      toast.success(promotion ? `Code ${values.code} mis à jour.` : `Code ${values.code} créé.`);
      onDone();
    } catch (err) {
      const message = getErrorMessage(err);
      if (err instanceof ServiceError && err.code === "CONFLICT") setError("code", { type: "server", message });
      else {
        setServerError(message);
        toast.error(message);
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Code" htmlFor="promo-code" error={errors.code?.message} required hint="Lettres, chiffres, - et _ (mis en majuscules).">
          <Input
            id="promo-code"
            autoComplete="off"
            className="font-mono uppercase"
            aria-invalid={!!errors.code}
            aria-describedby={errors.code ? "promo-code-error" : undefined}
            {...register("code", { setValueAs: (v: string) => v.toUpperCase() })}
          />
        </FormField>
        <FormField label="Libellé" htmlFor="promo-label" error={errors.label?.message} required>
          <Input
            id="promo-label"
            placeholder="Ex. 10 % pour une première commande"
            aria-invalid={!!errors.label}
            aria-describedby={errors.label ? "promo-label-error" : undefined}
            {...register("label")}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="promo-type">Type de réduction</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="promo-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                  <SelectItem value="fixed">Montant fixe (DA)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <FormField label={type === "percentage" ? "Valeur (%)" : "Valeur (DA)"} htmlFor="promo-value" error={errors.value?.message} required>
          <Input
            id="promo-value"
            type="number"
            inputMode="numeric"
            min={1}
            max={type === "percentage" ? 100 : undefined}
            aria-invalid={!!errors.value}
            aria-describedby={errors.value ? "promo-value-error" : undefined}
            {...register("value", { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Début" htmlFor="promo-start" error={errors.startsAt?.message} required>
          <Input id="promo-start" type="date" aria-invalid={!!errors.startsAt} aria-describedby={errors.startsAt ? "promo-start-error" : undefined} {...register("startsAt")} />
        </FormField>
        <FormField label="Fin (incluse)" htmlFor="promo-end" error={errors.endsAt?.message} required>
          <Input id="promo-end" type="date" aria-invalid={!!errors.endsAt} aria-describedby={errors.endsAt ? "promo-end-error" : undefined} {...register("endsAt")} />
        </FormField>
      </div>

      <FormField label="Montant minimum du panier (DA)" htmlFor="promo-min" error={errors.minOrderAmount?.message} hint="0 = aucun minimum.">
        <Input
          id="promo-min"
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          aria-invalid={!!errors.minOrderAmount}
          aria-describedby={errors.minOrderAmount ? "promo-min-error" : undefined}
          {...register("minOrderAmount", { valueAsNumber: true })}
        />
      </FormField>

      <div className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div>
          <Label htmlFor="promo-active">Code actif</Label>
          <p className="text-muted-foreground text-xs">Désactivé, le code est refusé au panier même pendant sa période de validité.</p>
        </div>
        <Controller control={control} name="isActive" render={({ field }) => <Switch id="promo-active" checked={field.value} onCheckedChange={field.onChange} />} />
      </div>

      {promotion && <p className="text-muted-foreground text-xs">Ce code a été utilisé {promotion.usageCount} fois.</p>}

      {serverError && (
        <p role="alert" className="bg-destructive-soft text-destructive rounded-md px-3 py-2 text-sm">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" aria-hidden />}
          {promotion ? "Enregistrer" : "Créer le code"}
        </Button>
      </div>
    </form>
  );
}
