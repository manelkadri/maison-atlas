"use client";

import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { discountPercent, formatDZD } from "@fashion/shared";
import type { ProductFormValues } from "@fashion/validators";
import { Info, TriangleAlert } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { Price } from "@/components/ui/price";
import { computeMargin, getEffectivePrice, hasPromo } from "@/features/products/form-mapper";
import { cn } from "@/lib/utils";
import { FormSection } from "./form-section";
import { NumberInput } from "./number-input";

export function SectionPricing({ form, hasError }: { form: UseFormReturn<ProductFormValues>; hasError: boolean }) {
  const {
    control,
    formState: { errors },
  } = form;
  const [regularPrice, promoPrice, costPrice] = useWatch({ control, name: ["regularPrice", "promoPrice", "costPrice"] });

  const effective = getEffectivePrice(regularPrice, promoPrice);
  const pricesReady = Number.isFinite(effective) && effective > 0;
  const margin = computeMargin(effective, costPrice);
  const onPromo = hasPromo(regularPrice, promoPrice);

  return (
    <FormSection id="section-pricing" title="Prix" description="Prix de vente, promotion éventuelle et prix d'achat (pour estimer la marge)." hasError={hasError}>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Prix de vente" htmlFor="product-regular-price" error={errors.regularPrice?.message} required>
          <Controller
            control={control}
            name="regularPrice"
            render={({ field }) => (
              <NumberInput
                id="product-regular-price"
                suffix="DA"
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? Number.NaN)}
                onBlur={field.onBlur}
                ref={field.ref}
                aria-invalid={!!errors.regularPrice}
                aria-describedby={errors.regularPrice ? "product-regular-price-error" : undefined}
              />
            )}
          />
        </FormField>

        <FormField label="Prix promotionnel" htmlFor="product-promo-price" error={errors.promoPrice?.message} hint="Facultatif. Le prix de vente devient l'ancien prix barré.">
          <Controller
            control={control}
            name="promoPrice"
            render={({ field }) => (
              <NumberInput
                id="product-promo-price"
                suffix="DA"
                whenEmpty="undefined"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                aria-invalid={!!errors.promoPrice}
                aria-describedby={errors.promoPrice ? "product-promo-price-error" : undefined}
              />
            )}
          />
        </FormField>

        <FormField label="Prix d'achat (coût)" htmlFor="product-cost-price" error={errors.costPrice?.message} hint="Jamais visible côté boutique." required>
          <Controller
            control={control}
            name="costPrice"
            render={({ field }) => (
              <NumberInput
                id="product-cost-price"
                suffix="DA"
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? 0)}
                onBlur={field.onBlur}
                ref={field.ref}
                aria-invalid={!!errors.costPrice}
                aria-describedby={errors.costPrice ? "product-cost-price-error" : undefined}
              />
            )}
          />
        </FormField>
      </div>

      <div className="bg-secondary/60 grid gap-4 rounded-md border p-4 sm:grid-cols-2" aria-live="polite">
        <div>
          <p className="text-muted-foreground text-xs">Prix affiché en boutique</p>
          <p className="mt-1">
            {pricesReady ? (
              <Price price={effective} compareAtPrice={onPromo ? regularPrice : undefined} size="lg" showDiscount />
            ) : (
              <span className="text-muted-foreground text-sm">Saisissez le prix de vente.</span>
            )}
          </p>
          {onPromo && <p className="text-muted-foreground mt-1 text-xs">Remise de {discountPercent(regularPrice, effective)} % sur le prix de vente.</p>}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Marge brute estimée (par unité)</p>
          {pricesReady ? (
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", margin.isLoss ? "text-destructive" : "text-success")}>
              {formatDZD(margin.amount)}
              {margin.percent !== null && <span className="ml-2 text-sm font-normal">({margin.percent} %)</span>}
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">—</p>
          )}
          <p className="text-muted-foreground mt-1 text-xs">Prix effectif − prix d&apos;achat. N&apos;inclut ni livraison ni charges.</p>
        </div>
      </div>

      {pricesReady && margin.isLoss && (
        <p role="alert" className="border-destructive/40 bg-destructive-soft flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Attention : le prix de vente ({formatDZD(effective)}) est inférieur au prix d&apos;achat ({formatDZD(costPrice)}). Vous vendriez à perte.
          </span>
        </p>
      )}

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Le prix d&apos;achat est réservé à l&apos;administration : il n&apos;est jamais affiché aux clients.
      </p>
    </FormSection>
  );
}
