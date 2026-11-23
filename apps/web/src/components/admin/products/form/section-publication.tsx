"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import type { ProductFormValues } from "@fashion/validators";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormSection } from "./form-section";

export function SectionPublication({ form, hasError }: { form: UseFormReturn<ProductFormValues>; hasError: boolean }) {
  const { control } = form;
  return (
    <FormSection id="section-publication" title="Publication" description="Contrôlez la visibilité du produit dans la boutique." hasError={hasError}>
      <div className="divide-y rounded-md border">
        <div className="flex items-start justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="product-published" className="text-sm font-medium">
              Publié
            </Label>
            <p id="product-published-desc" className="text-muted-foreground text-sm">
              Visible dans la boutique. Désactivé, le produit reste un brouillon invisible des clients.
            </p>
          </div>
          <Controller
            control={control}
            name="isPublished"
            render={({ field }) => <Switch id="product-published" checked={field.value} onCheckedChange={field.onChange} aria-describedby="product-published-desc" />}
          />
        </div>
        <div className="flex items-start justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="product-featured" className="text-sm font-medium">
              Mis en avant
            </Label>
            <p id="product-featured-desc" className="text-muted-foreground text-sm">
              Le produit peut être affiché dans les sélections de la page d&apos;accueil.
            </p>
          </div>
          <Controller
            control={control}
            name="isFeatured"
            render={({ field }) => <Switch id="product-featured" checked={field.value} onCheckedChange={field.onChange} aria-describedby="product-featured-desc" />}
          />
        </div>
      </div>
    </FormSection>
  );
}
