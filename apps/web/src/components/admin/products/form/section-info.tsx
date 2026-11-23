"use client";

import { useState, type KeyboardEvent } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { slugify } from "@fashion/shared";
import type { ProductFormValues } from "@fashion/validators";
import { Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormSection } from "./form-section";

type Props = {
  form: UseFormReturn<ProductFormValues>;
  categoryOptions: Array<{ id: string; label: string; archived: boolean }>;
  categoriesLoading: boolean;
  /** Vrai tant que le slug est généré automatiquement depuis le nom. */
  slugManual: boolean;
  onSlugManualChange: (manual: boolean) => void;
  slugTaken: boolean;
  hasError: boolean;
};

function TagsInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = draft.trim().toLowerCase();
    setDraft("");
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input id="product-tags" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} placeholder="Ex. été, lin, nouveauté" maxLength={30} />
        <Button type="button" variant="outline" onClick={commit} disabled={!draft.trim()}>
          Ajouter
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags du produit">
          {value.map((tag) => (
            <li key={tag} className="bg-secondary flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-xs">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Retirer le tag ${tag}`}
                className="hover:bg-accent flex size-5 items-center justify-center rounded-full"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SectionInfo({ form, categoryOptions, categoriesLoading, slugManual, onSlugManualChange, slugTaken, hasError }: Props) {
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors, touchedFields, isSubmitted },
  } = form;
  const description = useWatch({ control, name: "description" });
  const nameReg = register("name");
  const slugReg = register("slug");

  const regenerateSlug = () => {
    setValue("slug", slugify(getValues("name")), { shouldDirty: true, shouldValidate: true });
    onSlugManualChange(false);
  };

  const slugError = errors.slug?.message ?? (slugTaken ? "Ce slug est déjà utilisé par un autre produit." : undefined);

  return (
    <FormSection id="section-info" title="Informations générales" description="Nom, référence, description et classement du produit." hasError={hasError}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nom du produit" htmlFor="product-name" error={errors.name?.message} required className="sm:col-span-2">
          <Input
            id="product-name"
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "product-name-error" : undefined}
            {...nameReg}
            onChange={(e) => {
              void nameReg.onChange(e);
              if (!slugManual) {
                setValue("slug", slugify(e.target.value), { shouldDirty: true, shouldValidate: !!touchedFields.slug || isSubmitted });
              }
            }}
          />
        </FormField>

        <FormField
          label="Slug (adresse de la page)"
          htmlFor="product-slug"
          error={slugError}
          hint={slugManual ? "Modifié manuellement." : "Généré automatiquement depuis le nom."}
          required
        >
          <div className="flex gap-2">
            <Input
              id="product-slug"
              autoComplete="off"
              aria-invalid={!!slugError}
              aria-describedby={slugError ? "product-slug-error" : undefined}
              {...slugReg}
              onChange={(e) => {
                void slugReg.onChange(e);
                onSlugManualChange(e.target.value !== "");
              }}
            />
            <Button type="button" variant="outline" size="icon" onClick={regenerateSlug} aria-label="Régénérer le slug depuis le nom" title="Régénérer depuis le nom">
              <Wand2 aria-hidden />
            </Button>
          </div>
        </FormField>

        <FormField label="Référence" htmlFor="product-reference" error={errors.reference?.message} hint="Ex. ATL-W-014. Sert de base aux SKU." required>
          <Input
            id="product-reference"
            autoComplete="off"
            aria-invalid={!!errors.reference}
            aria-describedby={errors.reference ? "product-reference-error" : undefined}
            {...register("reference")}
          />
        </FormField>

        <FormField label="Description" htmlFor="product-description" error={errors.description?.message} required className="sm:col-span-2">
          <Textarea
            id="product-description"
            rows={5}
            maxLength={2000}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? "product-description-error" : undefined}
            {...register("description")}
          />
          <p className={cn("text-right text-xs tabular-nums", (description?.length ?? 0) > 1900 ? "text-warning" : "text-muted-foreground")}>{description?.length ?? 0} / 2000</p>
        </FormField>

        <FormField label="Catégorie" htmlFor="product-category" error={errors.categoryId?.message} required>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v)} disabled={categoriesLoading}>
                <SelectTrigger id="product-category" className="w-full" aria-invalid={!!errors.categoryId} onBlur={field.onBlur}>
                  <SelectValue placeholder={categoriesLoading ? "Chargement…" : "Choisir une catégorie"} />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                      {c.archived ? " (archivée)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField label="Tags" htmlFor="product-tags" hint="Entrée ou virgule pour valider. Utilisés par la recherche." className="sm:col-span-2">
          <Controller control={control} name="tags" render={({ field }) => <TagsInput value={field.value} onChange={field.onChange} />} />
        </FormField>
      </div>
    </FormSection>
  );
}
