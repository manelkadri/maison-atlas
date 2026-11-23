import type { Category, Product, ProductVariant } from "@fashion/types";
import type { Category as CategoryRow, Product as ProductRow, ProductVariant as VariantRow } from "@prisma/client";

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    kind: row.kind,
    parentId: row.parentId,
    displayOrder: row.displayOrder,
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
  };
}

const toVariant = (v: VariantRow): ProductVariant => ({
  id: v.id,
  productId: v.productId,
  sku: v.sku,
  color: v.color,
  colorCode: v.colorCode,
  size: v.size,
  price: v.price,
  stock: v.stock,
  alertThreshold: v.alertThreshold,
});

/**
 * Produit « statistiques » : tous les champs scalaires et les variantes (stock), SANS les images
 * (inutiles aux calculs de `@fashion/shared/analytics`, qui n'utilisent que catégorie, archivage et stock).
 */
export function toAnalyticsProduct(row: ProductRow & { variants?: VariantRow[] }): Product {
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.categoryId,
    gender: row.gender,
    tags: row.tags,
    price: row.price,
    costPrice: row.costPrice,
    ...(row.compareAtPrice !== null ? { compareAtPrice: row.compareAtPrice } : {}),
    images: [],
    variants: (row.variants ?? []).map(toVariant),
    soldCount: row.soldCount,
    isFeatured: row.isFeatured,
    isPublished: row.isPublished,
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
