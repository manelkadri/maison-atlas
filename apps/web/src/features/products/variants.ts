import { buildSku, findDuplicateSkus, generateVariants, sortSizes, type ColorOption } from "@fashion/shared";
import type { ProductFormValues } from "@fashion/validators";

export type VariantRow = ProductFormValues["variants"][number];

const rowKey = (v: { color: string; size: string }) => `${v.color}|${v.size}`;

export type SyncResult = {
  variants: VariantRow[];
  /** Variantes retirées par ce changement de couleurs/tailles. */
  removed: VariantRow[];
  /** Parmi les retirées, celles qui avaient du stock saisi (à signaler à l'utilisateur). */
  removedWithStock: VariantRow[];
  /** Nombre de combinaisons ajoutées. */
  addedCount: number;
};

/**
 * Recalcule les variantes (produit cartésien couleurs × tailles) en conservant
 * les lignes déjà saisies (SKU, prix, stock, seuil, id) pour les combinaisons qui subsistent.
 */
export function syncVariants(params: {
  reference: string;
  price: number;
  colors: ColorOption[];
  sizes: string[];
  defaultAlertThreshold: number;
  existing: VariantRow[];
}): SyncResult {
  const { reference, price, colors, sizes, defaultAlertThreshold, existing } = params;
  const orderedSizes = sortSizes(sizes);
  const seeds = generateVariants({
    reference: reference.trim() || "SKU",
    price: Number.isFinite(price) ? price : 0,
    colors,
    sizes: orderedSizes,
    defaultAlertThreshold,
    existing,
  });
  const byKey = new Map(existing.map((v) => [rowKey(v), v]));
  const colorCode = new Map(colors.map((c) => [c.name, c.code]));
  const variants: VariantRow[] = seeds.map((seed) => {
    const prev = byKey.get(rowKey(seed));
    return prev ? { ...prev, colorCode: colorCode.get(prev.color) ?? prev.colorCode } : seed;
  });
  const kept = new Set(variants.map(rowKey));
  const removed = existing.filter((v) => !kept.has(rowKey(v)));
  return {
    variants,
    removed,
    removedWithStock: removed.filter((v) => v.stock > 0),
    addedCount: variants.filter((v) => !byKey.has(rowKey(v))).length,
  };
}

/** Réapplique le même stock à toutes les variantes. */
export function applyStockToAll(variants: VariantRow[], stock: number): VariantRow[] {
  const safe = Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
  return variants.map((v) => ({ ...v, stock: safe }));
}

/** Réapplique le même seuil d'alerte à toutes les variantes. */
export function applyThresholdToAll(variants: VariantRow[], threshold: number): VariantRow[] {
  const safe = Number.isFinite(threshold) ? Math.max(0, Math.floor(threshold)) : 0;
  return variants.map((v) => ({ ...v, alertThreshold: safe }));
}

/** Régénère tous les SKU à partir de la référence (écrase les SKU saisis à la main). */
export function rebuildSkus(variants: VariantRow[], reference: string): VariantRow[] {
  const ref = reference.trim() || "SKU";
  return variants.map((v) => ({ ...v, sku: buildSku(ref, v.color, v.size) }));
}

export function getTotalVariantStock(variants: Array<Pick<VariantRow, "stock">>): number {
  return variants.reduce((s, v) => s + (Number.isFinite(v.stock) ? Math.max(0, v.stock) : 0), 0);
}

/**
 * Problèmes de SKU ligne par ligne (index → message) :
 * vide, doublon dans le produit, ou déjà utilisé par un autre produit du catalogue.
 * `takenElsewhere` : SKU des AUTRES produits (la comparaison ignore la casse).
 */
export function findSkuIssues(variants: Array<Pick<VariantRow, "sku">>, takenElsewhere: Iterable<string>): Map<number, string> {
  const issues = new Map<number, string>();
  const taken = new Set([...takenElsewhere].map((s) => s.trim().toUpperCase()));
  const duplicates = new Set(findDuplicateSkus(variants.map((v) => v.sku)));
  variants.forEach((v, i) => {
    const key = v.sku.trim().toUpperCase();
    if (!key) issues.set(i, "SKU requis.");
    else if (duplicates.has(key)) issues.set(i, "SKU en doublon dans ce produit.");
    else if (taken.has(key)) issues.set(i, "SKU déjà utilisé par un autre produit.");
  });
  return issues;
}
