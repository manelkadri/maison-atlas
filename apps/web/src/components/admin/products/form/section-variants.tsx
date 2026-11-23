"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { sortSizes, type ColorOption } from "@fashion/shared";
import type { ProductFormValues } from "@fashion/validators";
import { Check, Info, Plus, RefreshCw, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { PRESET_COLORS, STANDARD_SIZES } from "@/config/site";
import { getEffectivePrice } from "@/features/products/form-mapper";
import {
  applyStockToAll,
  applyThresholdToAll,
  findSkuIssues,
  getTotalVariantStock,
  rebuildSkus,
  syncVariants,
  type SyncResult,
  type VariantRow,
} from "@/features/products/variants";
import { cn } from "@/lib/utils";
import { FormSection } from "./form-section";
import { NumberInput } from "./number-input";

type Props = {
  form: UseFormReturn<ProductFormValues>;
  /** SKU des AUTRES produits du catalogue (unicité globale). */
  otherSkus: string[];
  isEdit: boolean;
  hasError: boolean;
};

const SIZE_SETS = [
  { key: "clothing", label: "Vêtements (XS à XXL)", sizes: STANDARD_SIZES.clothing },
  { key: "numeric", label: "Numériques (36 à 46)", sizes: STANDARD_SIZES.numeric },
  { key: "accessories", label: "Taille unique", sizes: STANDARD_SIZES.accessories },
] as const;

const ALL_PRESET_SIZES: string[] = [...STANDARD_SIZES.clothing, ...STANDARD_SIZES.numeric, ...STANDARD_SIZES.accessories];
const HEX = /^#[0-9a-fA-F]{6}$/;

type PendingChange = { colors: ColorOption[]; sizes: string[]; result: SyncResult };

export function SectionVariants({ form, otherSkus, isEdit, hasError }: Props) {
  const {
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitted },
  } = form;
  const colors = useWatch({ control, name: "colors" });
  const sizes = useWatch({ control, name: "sizes" });
  const variants = useWatch({ control, name: "variants" });
  const reference = useWatch({ control, name: "reference" });
  const regularPrice = useWatch({ control, name: "regularPrice" });
  const promoPrice = useWatch({ control, name: "promoPrice" });

  const [customName, setCustomName] = useState("");
  const [customCode, setCustomCode] = useState("#8a6f4e");
  const [customSize, setCustomSize] = useState("");
  const [bulkStock, setBulkStock] = useState<number | undefined>(0);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [confirmSkus, setConfirmSkus] = useState(false);

  const validate = isSubmitted;
  const effectivePrice = getEffectivePrice(regularPrice, promoPrice);

  /* Les variantes qui suivaient le prix du produit continuent de le suivre quand il change. */
  const prevPrice = useRef(effectivePrice);
  useEffect(() => {
    const prev = prevPrice.current;
    prevPrice.current = effectivePrice;
    if (!Number.isFinite(effectivePrice) || prev === effectivePrice) return;
    const current = getValues("variants");
    const follows = (price: number) => price === prev || (!Number.isFinite(prev) && price === 0);
    if (!current.some((v) => follows(v.price))) return;
    setValue(
      "variants",
      current.map((v) => (follows(v.price) ? { ...v, price: effectivePrice } : v)),
      { shouldDirty: true },
    );
  }, [effectivePrice, getValues, setValue]);

  const skuIssues = useMemo(() => findSkuIssues(variants, otherSkus), [variants, otherSkus]);

  /* ---------- Couleurs / tailles → variantes ---------- */

  const compute = (nextColors: ColorOption[], nextSizes: string[]): SyncResult =>
    syncVariants({
      reference: getValues("reference"),
      price: getEffectivePrice(getValues("regularPrice"), getValues("promoPrice")),
      colors: nextColors,
      sizes: nextSizes,
      defaultAlertThreshold: getValues("defaultAlertThreshold"),
      existing: getValues("variants"),
    });

  const commit = (nextColors: ColorOption[], nextSizes: string[], result: SyncResult) => {
    const opts = { shouldDirty: true, shouldValidate: validate } as const;
    const sorted = sortSizes(nextSizes);
    setValue("colors", nextColors, opts);
    setValue("sizes", sorted, opts);
    setValue("variants", result.variants, opts);
    // Une image associée à une couleur retirée redevient « toutes couleurs ».
    const names = new Set(nextColors.map((c) => c.name));
    const imgs = getValues("images");
    if (imgs.some((img) => img.color && !names.has(img.color))) {
      setValue(
        "images",
        imgs.map((img) => {
          if (!img.color || names.has(img.color)) return img;
          const { color: _removed, ...rest } = img;
          return rest;
        }),
        { shouldDirty: true },
      );
    }
  };

  const requestChange = (nextColors: ColorOption[], nextSizes: string[]) => {
    const result = compute(nextColors, nextSizes);
    if (result.removedWithStock.length > 0) setPending({ colors: nextColors, sizes: nextSizes, result });
    else commit(nextColors, nextSizes, result);
  };

  const hasColor = (name: string) => colors.some((c) => c.name.toLowerCase() === name.toLowerCase());
  const toggleColor = (color: ColorOption) =>
    requestChange(hasColor(color.name) ? colors.filter((c) => c.name.toLowerCase() !== color.name.toLowerCase()) : [...colors, color], sizes);

  const addCustomColor = () => {
    const name = customName.trim();
    if (!name) return toast.error("Donnez un nom à la couleur personnalisée.");
    if (!HEX.test(customCode)) return toast.error("Code couleur invalide.");
    if (hasColor(name)) return toast.error(`La couleur « ${name} » est déjà sélectionnée.`);
    requestChange([...colors, { name, code: customCode.toLowerCase() }], sizes);
    setCustomName("");
  };

  const toggleSize = (size: string) => requestChange(colors, sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size]);
  const setSizeSet = (set: readonly string[]) => requestChange(colors, [...set]);
  const addCustomSize = () => {
    const size = customSize.trim().toUpperCase();
    if (!size) return;
    if (sizes.includes(size)) return toast.error(`La taille « ${size} » est déjà sélectionnée.`);
    requestChange(colors, [...sizes, size]);
    setCustomSize("");
  };

  const generate = () => {
    if (colors.length === 0 || sizes.length === 0) return toast.error("Choisissez au moins une couleur et une taille.");
    const result = compute(colors, sizes);
    commit(colors, sizes, result);
    toast.success(result.addedCount > 0 ? `${result.addedCount} variante${result.addedCount > 1 ? "s" : ""} ajoutée${result.addedCount > 1 ? "s" : ""}.` : "Les variantes sont à jour.");
  };

  /* ---------- Édition des lignes ---------- */

  const updateVariant = (index: number, patch: Partial<VariantRow>) =>
    setValue(
      "variants",
      variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
      { shouldDirty: true, shouldValidate: validate },
    );

  const applyBulkStock = () => {
    setValue("variants", applyStockToAll(variants, bulkStock ?? 0), { shouldDirty: true, shouldValidate: validate });
    toast.success(`Stock de ${bulkStock ?? 0} appliqué aux ${variants.length} variantes.`);
  };
  const applyDefaultThreshold = () => {
    const t = getValues("defaultAlertThreshold");
    setValue("variants", applyThresholdToAll(variants, t), { shouldDirty: true, shouldValidate: validate });
    toast.success(`Seuil d'alerte de ${t} appliqué à toutes les variantes.`);
  };

  const listError = (errors.variants as { message?: string; root?: { message?: string } } | undefined)?.message ?? (errors.variants as { root?: { message?: string } } | undefined)?.root?.message;
  const rowError = (index: number, field: keyof VariantRow): string | undefined => {
    const rowErrors = errors.variants as unknown as Array<Partial<Record<keyof VariantRow, { message?: string }>> | undefined> | undefined;
    return Array.isArray(rowErrors) ? rowErrors[index]?.[field]?.message : undefined;
  };

  const customSizes = sizes.filter((s) => !ALL_PRESET_SIZES.includes(s));
  const presetColorNames = new Set<string>(PRESET_COLORS.map((c) => c.name.toLowerCase()));
  const customColors = colors.filter((c) => !presetColorNames.has(c.name.toLowerCase()));
  const totalStock = getTotalVariantStock(variants);
  const colorsError = errors.colors?.message;
  const sizesError = errors.sizes?.message;

  return (
    <FormSection
      id="section-variants"
      title="Couleurs, tailles et variantes"
      description="Choisissez les couleurs et tailles : une variante est créée pour chaque combinaison, avec son propre SKU et son propre stock."
      hasError={hasError}
    >
      {/* ---- Couleurs ---- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Couleurs <span aria-hidden className="text-destructive">*</span>
          </Label>
          <span className="text-muted-foreground text-xs">{colors.length} sélectionnée{colors.length > 1 ? "s" : ""}</span>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Couleurs disponibles">
          {PRESET_COLORS.map((c) => {
            const selected = hasColor(c.name);
            return (
              <li key={c.name}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleColor({ name: c.name, code: c.code })}
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                    selected ? "border-foreground bg-accent font-medium" : "hover:bg-accent/60",
                  )}
                >
                  <ColorSwatch color={c.code} />
                  {c.name}
                  {selected && <Check className="size-3.5" aria-hidden />}
                </button>
              </li>
            );
          })}
          {customColors.map((c) => (
            <li key={c.name}>
              <button
                type="button"
                aria-pressed
                onClick={() => toggleColor(c)}
                aria-label={`Retirer la couleur personnalisée ${c.name}`}
                className="border-foreground bg-accent flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
              >
                <ColorSwatch color={c.code} />
                {c.name}
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1 space-y-1">
            <Label htmlFor="custom-color-name" className="text-xs font-normal">
              Couleur personnalisée
            </Label>
            <Input
              id="custom-color-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomColor();
                }
              }}
              placeholder="Nom (ex. Lavande)"
              maxLength={30}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-color-code" className="text-xs font-normal">
              Teinte
            </Label>
            <input
              id="custom-color-code"
              type="color"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              className="border-input bg-background h-9 w-14 cursor-pointer rounded-md border p-1"
              aria-label="Choisir la teinte de la couleur personnalisée"
            />
          </div>
          <Button type="button" variant="outline" onClick={addCustomColor}>
            <Plus aria-hidden /> Ajouter
          </Button>
        </div>
        {colorsError && (
          <p role="alert" className="text-destructive text-sm">
            {colorsError}
          </p>
        )}
      </div>

      {/* ---- Tailles ---- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Tailles <span aria-hidden className="text-destructive">*</span>
          </Label>
          <span className="text-muted-foreground text-xs">{sizes.length} sélectionnée{sizes.length > 1 ? "s" : ""}</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Jeux de tailles prédéfinis">
          {SIZE_SETS.map((set) => {
            const active = set.sizes.length === sizes.length && set.sizes.every((s) => sizes.includes(s));
            return (
              <Button key={set.key} type="button" size="sm" variant={active ? "default" : "outline"} aria-pressed={active} onClick={() => setSizeSet(set.sizes)}>
                {set.label}
              </Button>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Tailles disponibles">
          {[...ALL_PRESET_SIZES, ...customSizes].map((size) => {
            const selected = sizes.includes(size);
            return (
              <li key={size}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSize(size)}
                  className={cn(
                    "min-h-9 min-w-11 rounded-md border px-3 py-1 text-sm transition-colors",
                    selected ? "border-foreground bg-primary text-primary-foreground font-medium" : "hover:bg-accent/60",
                  )}
                >
                  {size}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1 space-y-1">
            <Label htmlFor="custom-size" className="text-xs font-normal">
              Taille personnalisée
            </Label>
            <Input
              id="custom-size"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSize();
                }
              }}
              placeholder="Ex. 3XL, 48, 7-8 ans"
              maxLength={12}
            />
          </div>
          <Button type="button" variant="outline" onClick={addCustomSize}>
            <Plus aria-hidden /> Ajouter
          </Button>
        </div>
        {sizesError && (
          <p role="alert" className="text-destructive text-sm">
            {sizesError}
          </p>
        )}
      </div>

      {/* ---- Variantes ---- */}
      <div className="space-y-3 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              Variantes <span className="text-muted-foreground font-normal tabular-nums">({variants.length})</span>
            </h3>
            <p className="text-muted-foreground text-xs">
              {colors.length} couleur{colors.length > 1 ? "s" : ""} × {sizes.length} taille{sizes.length > 1 ? "s" : ""} · stock total{" "}
              <span className="text-foreground font-medium tabular-nums">{totalStock}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={generate}>
              <RefreshCw aria-hidden /> Générer les variantes
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmSkus(true)} disabled={variants.length === 0}>
              Régénérer les SKU
            </Button>
          </div>
        </div>

        {variants.length === 0 ? (
          <p className="text-muted-foreground bg-secondary/60 rounded-md border border-dashed px-4 py-6 text-center text-sm">
            Sélectionnez au moins une couleur et une taille : les variantes apparaissent ici automatiquement.
          </p>
        ) : (
          <>
            <div className="bg-secondary/50 grid gap-3 rounded-md border p-3 md:grid-cols-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-32 flex-1 space-y-1">
                  <Label htmlFor="bulk-stock" className="text-xs font-normal">
                    Même stock pour toutes les variantes
                  </Label>
                  <NumberInput id="bulk-stock" whenEmpty="zero" value={bulkStock} onValueChange={setBulkStock} />
                </div>
                <Button type="button" variant="secondary" onClick={applyBulkStock}>
                  Appliquer
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-32 flex-1 space-y-1">
                  <Label htmlFor="default-threshold" className="text-xs font-normal">
                    Seuil d&apos;alerte par défaut
                  </Label>
                  <Controller
                    control={control}
                    name="defaultAlertThreshold"
                    render={({ field }) => <NumberInput id="default-threshold" whenEmpty="zero" value={field.value} onValueChange={(v) => field.onChange(v ?? 0)} onBlur={field.onBlur} />}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={applyDefaultThreshold}>
                  Appliquer à toutes
                </Button>
              </div>
            </div>

            <div role="group" aria-label="Tableau des variantes" className="overflow-hidden rounded-md border">
              <div aria-hidden className="bg-muted text-muted-foreground hidden grid-cols-[1.1fr_0.6fr_1.6fr_1fr_0.8fr_0.8fr] gap-3 px-3 py-2 text-xs font-medium md:grid">
                <span>Couleur</span>
                <span>Taille</span>
                <span>SKU</span>
                <span>Prix (DA)</span>
                <span>Stock</span>
                <span>Seuil</span>
              </div>
              <ul className="divide-y">
                {variants.map((v, i) => {
                  const label = `${v.color} / ${v.size}`;
                  const skuError = skuIssues.get(i) ?? rowError(i, "sku");
                  const priceError = rowError(i, "price");
                  const stockError = rowError(i, "stock");
                  const thresholdError = rowError(i, "alertThreshold");
                  const rowHasError = !!(skuError || priceError || stockError || thresholdError);
                  return (
                    <li
                      key={`${v.color}|${v.size}`}
                      className={cn("grid grid-cols-2 items-start gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[1.1fr_0.6fr_1.6fr_1fr_0.8fr_0.8fr] md:py-2", rowHasError && "bg-destructive-soft/40")}
                    >
                      <div className="col-span-2 flex items-center gap-2 text-sm font-medium md:col-span-1 md:pt-2">
                        <ColorSwatch color={v.colorCode} />
                        <span className="truncate">{v.color}</span>
                        <span className="text-muted-foreground md:hidden">· {v.size}</span>
                      </div>
                      <div className="hidden text-sm md:block md:pt-2">{v.size}</div>

                      <div className="col-span-2 space-y-1 md:col-span-1">
                        <Label htmlFor={`sku-${i}`} className="text-muted-foreground text-xs font-normal md:sr-only">
                          SKU
                        </Label>
                        <Input
                          id={`sku-${i}`}
                          value={v.sku}
                          onChange={(e) => updateVariant(i, { sku: e.target.value.toUpperCase() })}
                          aria-label={`SKU — ${label}`}
                          aria-invalid={!!skuError}
                          aria-describedby={skuError ? `sku-${i}-error` : undefined}
                          className="font-mono text-xs uppercase"
                          autoComplete="off"
                        />
                        {skuError && (
                          <p id={`sku-${i}-error`} role="alert" className="text-destructive text-xs">
                            {skuError}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`price-${i}`} className="text-muted-foreground text-xs font-normal md:sr-only">
                          Prix
                        </Label>
                        <NumberInput
                          id={`price-${i}`}
                          whenEmpty="zero"
                          value={v.price}
                          onValueChange={(n) => updateVariant(i, { price: n ?? 0 })}
                          aria-label={`Prix — ${label}`}
                          aria-invalid={!!priceError}
                        />
                        {priceError && <p role="alert" className="text-destructive text-xs">{priceError}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`stock-${i}`} className="text-muted-foreground text-xs font-normal md:sr-only">
                          Stock
                        </Label>
                        <NumberInput
                          id={`stock-${i}`}
                          whenEmpty="zero"
                          value={v.stock}
                          onValueChange={(n) => updateVariant(i, { stock: n ?? 0 })}
                          aria-label={`Stock — ${label}`}
                          aria-invalid={!!stockError}
                        />
                        {stockError && <p role="alert" className="text-destructive text-xs">{stockError}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`threshold-${i}`} className="text-muted-foreground text-xs font-normal md:sr-only">
                          Seuil d&apos;alerte
                        </Label>
                        <NumberInput
                          id={`threshold-${i}`}
                          whenEmpty="zero"
                          value={v.alertThreshold}
                          onValueChange={(n) => updateVariant(i, { alertThreshold: n ?? 0 })}
                          aria-label={`Seuil d'alerte — ${label}`}
                          aria-invalid={!!thresholdError}
                        />
                        {thresholdError && <p role="alert" className="text-destructive text-xs">{thresholdError}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {listError && (
          <p role="alert" className="text-destructive flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {listError}
          </p>
        )}

        <p className="text-muted-foreground flex items-start gap-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Le prix d&apos;une variante suit le prix du produit tant que vous ne le modifiez pas.{" "}
            {isEdit ? (
              <>
                Modifier un stock ici enregistre un mouvement d&apos;<strong>ajustement</strong> (« Correction depuis la fiche produit »). Pour des mouvements motivés (réception, casse, retour…), utilisez la{" "}
                <Link href={`${ADMIN_ROOT}/inventory`} className="text-brand underline underline-offset-2">
                  gestion des stocks
                </Link>
                .
              </>
            ) : (
              <>Le stock saisi ici devient le stock initial (mouvement « Stock initial »). Les mouvements suivants se gèrent dans la gestion des stocks.</>
            )}
          </span>
        </p>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Retirer des variantes avec du stock ?"
        variant="destructive"
        confirmLabel="Retirer ces variantes"
        description={
          <div className="space-y-2">
            <p>
              Ce changement supprime {pending?.result.removed.length} variante{(pending?.result.removed.length ?? 0) > 1 ? "s" : ""}, dont{" "}
              {pending?.result.removedWithStock.length} avec du stock saisi (
              {getTotalVariantStock(pending?.result.removedWithStock ?? [])} unité{getTotalVariantStock(pending?.result.removedWithStock ?? []) > 1 ? "s" : ""}).
            </p>
            <ul className="max-h-32 list-disc overflow-y-auto pl-5 text-sm">
              {pending?.result.removedWithStock.map((v) => (
                <li key={`${v.color}|${v.size}`}>
                  {v.color} / {v.size} : {v.stock} en stock
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">La suppression ne sera effective qu&apos;à l&apos;enregistrement du produit.</p>
          </div>
        }
        onConfirm={() => {
          if (pending) commit(pending.colors, pending.sizes, pending.result);
          setPending(null);
        }}
      />

      <ConfirmDialog
        open={confirmSkus}
        onOpenChange={setConfirmSkus}
        title="Régénérer tous les SKU ?"
        confirmLabel="Régénérer"
        description={<p>Les SKU de toutes les variantes seront recalculés à partir de la référence « {reference || "SKU"} », en écrasant ceux que vous avez saisis à la main.</p>}
        onConfirm={() => {
          setValue("variants", rebuildSkus(variants, getValues("reference")), { shouldDirty: true, shouldValidate: validate });
          setConfirmSkus(false);
          toast.success("SKU régénérés.");
        }}
      />
    </FormSection>
  );
}
