import { getProductColors, getProductSizes, isOnSale } from "@fashion/shared";
import type { ProductFormValues } from "@fashion/validators";
import type { CreateProductInput, Product } from "@/types/product.types";

/** Une promotion n'existe que si le prix promotionnel est renseigné, > 0 et inférieur au prix de vente. */
export function hasPromo(regularPrice: number, promoPrice: number | undefined): promoPrice is number {
  return promoPrice !== undefined && Number.isFinite(promoPrice) && promoPrice > 0 && Number.isFinite(regularPrice) && promoPrice < regularPrice;
}

/** Prix réellement affiché en boutique (promo si valide, sinon prix de vente). */
export function getEffectivePrice(regularPrice: number, promoPrice: number | undefined): number {
  return hasPromo(regularPrice, promoPrice) ? promoPrice : regularPrice;
}

/**
 * Marge brute unitaire estimée (prix de vente effectif − prix d'achat).
 * `percent` est exprimé en % du prix de vente (null si le prix est nul).
 */
export function computeMargin(effectivePrice: number, costPrice: number): { amount: number; percent: number | null; isLoss: boolean } {
  const price = Number.isFinite(effectivePrice) ? effectivePrice : 0;
  const cost = Number.isFinite(costPrice) ? costPrice : 0;
  const amount = price - cost;
  return { amount, percent: price > 0 ? Math.round((amount / price) * 1000) / 10 : null, isLoss: amount < 0 };
}

/**
 * Valeurs du formulaire → entrée de création/modification de produit.
 * - prix de vente + prix promo → `price` (prix affiché) + `compareAtPrice` (ancien prix barré) ;
 * - `compareAtPrice` est TOUJOURS présent (undefined sans promo) afin qu'une mise à jour efface l'ancien prix.
 */
export function formValuesToCreateInput(values: ProductFormValues): CreateProductInput {
  const promo = hasPromo(values.regularPrice, values.promoPrice);
  return {
    reference: values.reference.trim(),
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId,
    gender: values.gender,
    tags: values.tags.map((t) => t.trim()).filter(Boolean),
    price: promo ? (values.promoPrice as number) : values.regularPrice,
    costPrice: values.costPrice,
    compareAtPrice: promo ? values.regularPrice : undefined,
    images: values.images.map((img, position) => ({
      id: img.id,
      url: img.url,
      alt: img.alt.trim() || values.name.trim(),
      ...(img.color ? { color: img.color } : {}),
      position,
    })),
    variants: values.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      sku: v.sku.trim(),
      color: v.color,
      colorCode: v.colorCode,
      size: v.size,
      price: v.price,
      stock: v.stock,
      alertThreshold: v.alertThreshold,
    })),
    isFeatured: values.isFeatured,
    isPublished: values.isPublished,
  };
}

/** Produit existant → valeurs du formulaire (inverse de `formValuesToCreateInput`). */
export function productToFormValues(product: Product): ProductFormValues {
  const onSale = isOnSale(product);
  const thresholds = product.variants.map((v) => v.alertThreshold);
  return {
    name: product.name,
    slug: product.slug,
    reference: product.reference,
    description: product.description,
    categoryId: product.categoryId,
    gender: product.gender,
    tags: [...product.tags],
    regularPrice: onSale ? (product.compareAtPrice as number) : product.price,
    promoPrice: onSale ? product.price : undefined,
    costPrice: product.costPrice,
    images: [...product.images]
      .sort((a, b) => a.position - b.position)
      .map((img) => ({ id: img.id, url: img.url, alt: img.alt, ...(img.color ? { color: img.color } : {}), position: img.position })),
    colors: getProductColors(product),
    sizes: getProductSizes(product),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      color: v.color,
      colorCode: v.colorCode,
      size: v.size,
      price: v.price,
      stock: v.stock,
      alertThreshold: v.alertThreshold,
    })),
    defaultAlertThreshold: thresholds.length ? Math.min(...thresholds) : 3,
    isPublished: product.isPublished,
    isFeatured: product.isFeatured,
  };
}

/** Valeurs initiales d'un nouveau produit (brouillon). */
export function emptyProductFormValues(defaultAlertThreshold = 3): ProductFormValues {
  return {
    name: "",
    slug: "",
    reference: "",
    description: "",
    categoryId: "",
    gender: "unisex",
    tags: [],
    regularPrice: Number.NaN,
    promoPrice: undefined,
    costPrice: 0,
    images: [],
    colors: [],
    sizes: [],
    variants: [],
    defaultAlertThreshold,
    isPublished: false,
    isFeatured: false,
  };
}
