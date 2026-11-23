import type { Product, ProductVariant, StockStatus } from "@fashion/types";
import { slugify } from "./slug";

/** Statut d'une variante, jamais agrégé sur plusieurs variantes. */
export function getStockStatus(stock: number, alertThreshold: number): StockStatus {
  if (stock <= 0) return "out_of_stock";
  if (stock <= alertThreshold) return "low";
  return "available";
}

export function getVariantStatus(v: Pick<ProductVariant, "stock" | "alertThreshold">): StockStatus {
  return getStockStatus(v.stock, v.alertThreshold);
}

/** Règle n°3 : le stock total d'un produit est la somme de ses variantes. */
export function getTotalStock(product: Pick<Product, "variants">): number {
  return product.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
}

/** Trouve la variante exacte pour une couleur + taille (jamais d'agrégation). */
export function findVariant(
  product: Pick<Product, "variants">,
  color: string | undefined,
  size: string | undefined,
): ProductVariant | undefined {
  if (!color || !size) return undefined;
  return product.variants.find((v) => v.color === color && v.size === size);
}

export type ColorOption = { name: string; code: string };

export function getProductColors(product: Pick<Product, "variants">): ColorOption[] {
  const seen = new Map<string, string>();
  for (const v of product.variants) if (!seen.has(v.color)) seen.set(v.color, v.colorCode);
  return [...seen].map(([name, code]) => ({ name, code }));
}

export const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "Unique"];

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

export function getProductSizes(product: Pick<Product, "variants">): string[] {
  return sortSizes([...new Set(product.variants.map((v) => v.size))]);
}

/** Tailles disponibles (stock > 0) pour une couleur donnée. */
export function getAvailableSizesForColor(product: Pick<Product, "variants">, color: string): string[] {
  return sortSizes(product.variants.filter((v) => v.color === color && v.stock > 0).map((v) => v.size));
}

export function isProductInStock(product: Pick<Product, "variants">): boolean {
  return product.variants.some((v) => v.stock > 0);
}

export function isOnSale(product: Pick<Product, "price" | "compareAtPrice">): boolean {
  return product.compareAtPrice !== undefined && product.compareAtPrice > product.price;
}

/** Produit "nouveau" = créé il y a moins de `days` jours. */
export function isNewProduct(product: Pick<Product, "createdAt">, now: Date = new Date(), days = 30): boolean {
  const ageMs = now.getTime() - new Date(product.createdAt).getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 3600 * 1000;
}

/** Code court (3 lettres max) pour fabriquer un SKU lisible. */
function code(value: string, len = 3): string {
  return slugify(value).replace(/-/g, "").toUpperCase().slice(0, len).padEnd(len, "X");
}

export function buildSku(reference: string, color: string, size: string): string {
  return `${reference}-${code(color)}-${size.toUpperCase().replace(/\s+/g, "")}`;
}

export type VariantSeed = Omit<ProductVariant, "id" | "productId">;

/**
 * Génère le produit cartésien couleurs × tailles.
 * Conserve le stock / seuil / SKU des combinaisons déjà présentes (`existing`),
 * pour que l'ajout d'une taille ne réinitialise pas les stocks saisis.
 */
export function generateVariants(params: {
  reference: string;
  price: number;
  colors: ColorOption[];
  sizes: string[];
  defaultAlertThreshold?: number;
  existing?: VariantSeed[];
}): VariantSeed[] {
  const { reference, price, colors, sizes, defaultAlertThreshold = 3, existing = [] } = params;
  const result: VariantSeed[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      const prev = existing.find((v) => v.color === color.name && v.size === size);
      result.push(
        prev ?? {
          sku: buildSku(reference, color.name, size),
          color: color.name,
          colorCode: color.code,
          size,
          price,
          stock: 0,
          alertThreshold: defaultAlertThreshold,
        },
      );
    }
  }
  return result;
}

/** Retourne les SKU en doublon (règle n°2 : SKU unique). */
export function findDuplicateSkus(skus: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const s of skus) {
    const k = s.trim().toUpperCase();
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return [...dup];
}
