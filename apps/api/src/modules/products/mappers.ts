import type { Prisma } from "@prisma/client";
import type { Product } from "@fashion/types";

/** Relations chargées avec chaque produit. Images triées par `position`. */
export const productInclude = {
  images: { orderBy: [{ position: "asc" }, { id: "asc" }] },
  // Les identifiants cuid sont croissants : l'ordre des variantes est celui de leur création.
  variants: { orderBy: { id: "asc" } },
} satisfies Prisma.ProductInclude;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * Ligne Prisma → `Product` de @fashion/types.
 * `audience: "public"` met `costPrice` à 0 : le prix d'achat n'est jamais divulgué par les routes publiques.
 */
export function toProduct(row: ProductRow, audience: "public" | "admin"): Product {
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
    costPrice: audience === "admin" ? row.costPrice : 0,
    ...(row.compareAtPrice !== null ? { compareAtPrice: row.compareAtPrice } : {}),
    images: row.images.map((img) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      ...(img.color !== null ? { color: img.color } : {}),
      position: img.position,
    })),
    variants: row.variants.map((v) => ({
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      color: v.color,
      colorCode: v.colorCode,
      size: v.size,
      price: v.price,
      stock: v.stock,
      alertThreshold: v.alertThreshold,
    })),
    soldCount: row.soldCount,
    isFeatured: row.isFeatured,
    isPublished: row.isPublished,
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
