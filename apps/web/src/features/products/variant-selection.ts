import { findVariant, getProductColors, getProductSizes, sortSizes } from "@fashion/shared";
import type { CartItem } from "@/stores/cart.store";
import type { Product, ProductImage, ProductVariant } from "@/types/product.types";

/**
 * Logique pure de sélection de variante (couleur + taille) de la fiche produit.
 * Règle de stock : la disponibilité d'une combinaison se lit UNIQUEMENT sur sa variante,
 * jamais sur la somme des stocks du produit.
 */

export type ColorOption = { name: string; code: string; soldOut: boolean };

/** Couleurs du produit ; `soldOut` = toutes les variantes de cette couleur sont en rupture. */
export function getColorOptions(product: Pick<Product, "variants">): ColorOption[] {
  return getProductColors(product).map((c) => ({
    ...c,
    soldOut: !product.variants.some((v) => v.color === c.name && v.stock > 0),
  }));
}

/** Couleur sélectionnée par défaut : la première qui a du stock, sinon la première. */
export function pickInitialColor(product: Pick<Product, "variants">): string | undefined {
  const options = getColorOptions(product);
  return (options.find((o) => !o.soldOut) ?? options[0])?.name;
}

export type SizeOption = { size: string; variant: ProductVariant; soldOut: boolean };

/**
 * Tailles réellement proposées pour une couleur : une taille sans variante pour cette couleur
 * n'apparaît pas (impossible de sélectionner une variante inexistante).
 */
export function getSizeOptionsForColor(product: Pick<Product, "variants">, color: string | undefined): SizeOption[] {
  if (!color) return [];
  const variants = product.variants.filter((v) => v.color === color);
  return sortSizes(variants.map((v) => v.size)).map((size) => {
    const variant = variants.find((v) => v.size === size)!;
    return { size, variant, soldOut: variant.stock <= 0 };
  });
}

/**
 * Au changement de couleur : conserve la taille si la combinaison existe ET est en stock,
 * sinon la désélectionne.
 */
export function resolveSizeOnColorChange(
  product: Pick<Product, "variants">,
  newColor: string,
  currentSize: string | undefined,
): string | undefined {
  const variant = findVariant(product, newColor, currentSize);
  return variant && variant.stock > 0 ? currentSize : undefined;
}

/** Variante réellement sélectionnée (undefined si la combinaison n'existe pas). */
export function resolveSelectedVariant(
  product: Pick<Product, "variants">,
  color: string | undefined,
  size: string | undefined,
): ProductVariant | undefined {
  return findVariant(product, color, size);
}

export type AvailabilityKind = "no_size" | "available" | "low" | "out_of_stock";

export type VariantAvailability = {
  kind: AvailabilityKind;
  label: string;
  /** Quantité maximale commandable pour cette variante (0 si indisponible). */
  maxQuantity: number;
  canAdd: boolean;
};

export function getVariantAvailability(variant: ProductVariant | undefined): VariantAvailability {
  if (!variant) return { kind: "no_size", label: "Choisissez une taille", maxQuantity: 0, canAdd: false };
  if (variant.stock <= 0) return { kind: "out_of_stock", label: "Rupture de stock", maxQuantity: 0, canAdd: false };
  if (variant.stock <= variant.alertThreshold) {
    return { kind: "low", label: `Plus que ${variant.stock} en stock`, maxQuantity: variant.stock, canAdd: true };
  }
  return { kind: "available", label: "En stock", maxQuantity: variant.stock, canAdd: true };
}

/** Ramène une quantité dans [1, stock de la variante] (1 si aucune variante n'est choisie). */
export function clampQuantity(quantity: number, variant: Pick<ProductVariant, "stock"> | undefined): number {
  const max = Math.max(1, variant?.stock ?? 1);
  const q = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
  return Math.min(Math.max(1, q), max);
}

/** Images associées à la couleur (+ images génériques) ; repli sur toutes les images. */
export function getImagesForColor(product: Pick<Product, "images">, color: string | undefined): ProductImage[] {
  const sorted = [...product.images].sort((a, b) => a.position - b.position);
  if (!color) return sorted;
  const forColor = sorted.filter((im) => im.color === color);
  if (forColor.length === 0) return sorted;
  return sorted.filter((im) => im.color === color || !im.color);
}

/** Ligne de panier (sans quantité) pour une variante donnée. */
export function buildCartItem(product: Product, variant: ProductVariant): Omit<CartItem, "quantity"> {
  const image = getImagesForColor(product, variant.color)[0] ?? product.images[0];
  return {
    variantId: variant.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: image?.url ?? "",
    color: variant.color,
    colorCode: variant.colorCode,
    size: variant.size,
    sku: variant.sku,
    unitPrice: variant.price,
    maxStock: variant.stock,
  };
}

export type SizeChoiceState = "available" | "sold_out" | "unavailable";
export type SizeChoice = { size: string; state: SizeChoiceState; variant?: ProductVariant };

/**
 * Toutes les tailles du produit pour une couleur donnée, avec leur état :
 * - `available`   : la variante existe et a du stock ;
 * - `sold_out`    : la variante existe mais stock = 0 (épuisée) ;
 * - `unavailable` : cette taille n'existe pas dans cette couleur (non sélectionnable).
 */
export function getSizeChoices(product: Pick<Product, "variants">, color: string | undefined): SizeChoice[] {
  const sizes = getProductSizes(product);
  return sizes.map((size) => {
    const variant = findVariant(product, color, size);
    if (!variant) return { size, state: "unavailable" as const };
    return { size, variant, state: variant.stock > 0 ? ("available" as const) : ("sold_out" as const) };
  });
}
