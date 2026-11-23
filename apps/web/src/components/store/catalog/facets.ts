import { sortSizes } from "@fashion/shared";
import type { Category, Product } from "@/types/product.types";

/** Facettes du catalogue (tailles, couleurs, bornes de prix, arbre de catégories), calculées côté client. */

export type CatalogFacets = {
  sizes: string[];
  colors: Array<{ name: string; code: string }>;
  priceBounds: { min: number; max: number };
};

const PRICE_STEP = 100;

export function buildFacets(products: Product[]): CatalogFacets {
  const sizes = new Set<string>();
  const colors = new Map<string, string>();
  let min = Infinity;
  let max = 0;
  for (const p of products) {
    min = Math.min(min, p.price);
    max = Math.max(max, p.price);
    for (const v of p.variants) {
      sizes.add(v.size);
      if (!colors.has(v.color)) colors.set(v.color, v.colorCode);
    }
  }
  if (!Number.isFinite(min)) min = 0;
  return {
    sizes: sortSizes([...sizes]),
    colors: [...colors].map(([name, code]) => ({ name, code })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    priceBounds: {
      min: Math.floor(min / PRICE_STEP) * PRICE_STEP,
      max: Math.max(Math.ceil(max / PRICE_STEP) * PRICE_STEP, Math.floor(min / PRICE_STEP) * PRICE_STEP + PRICE_STEP),
    },
  };
}

export type CategoryNode = { category: Category; children: Category[] };

/** Catégories racines (hors collections) avec leurs sous-catégories, dans l'ordre d'affichage. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const active = categories.filter((c) => !c.isArchived && c.kind === "category");
  return active
    .filter((c) => !c.parentId)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((category) => ({
      category,
      children: active.filter((c) => c.parentId === category.id).sort((a, b) => a.displayOrder - b.displayOrder),
    }));
}
