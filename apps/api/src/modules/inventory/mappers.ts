import { getVariantStatus } from "@fashion/shared";
import type { InventoryItem, StockMovement } from "@fashion/types";
import type { Prisma } from "@prisma/client";

export const movementInclude = {
  variant: { select: { productId: true, sku: true, color: true, size: true, product: { select: { name: true } } } },
} satisfies Prisma.StockMovementInclude;

export type MovementRow = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;

export function toStockMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    variantId: row.variantId,
    productId: row.variant.productId,
    productName: row.variant.product.name,
    sku: row.variant.sku,
    color: row.variant.color,
    size: row.variant.size,
    type: row.type,
    quantityDelta: row.quantityDelta,
    quantityBefore: row.quantityBefore,
    quantityAfter: row.quantityAfter,
    reason: row.reason,
    ...(row.reference ? { reference: row.reference } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

export const inventoryVariantInclude = {
  product: { select: { id: true, name: true, slug: true, images: { orderBy: { position: "asc" }, select: { url: true, color: true } } } },
} satisfies Prisma.ProductVariantInclude;

export type InventoryVariantRow = Prisma.ProductVariantGetPayload<{ include: typeof inventoryVariantInclude }>;

export function toInventoryItem(v: InventoryVariantRow): InventoryItem {
  const image = v.product.images.find((im) => im.color === v.color) ?? v.product.images[0];
  return {
    variantId: v.id,
    productId: v.product.id,
    productName: v.product.name,
    productSlug: v.product.slug,
    imageUrl: image?.url ?? "",
    sku: v.sku,
    color: v.color,
    colorCode: v.colorCode,
    size: v.size,
    stock: v.stock,
    alertThreshold: v.alertThreshold,
    status: getVariantStatus(v),
  };
}
