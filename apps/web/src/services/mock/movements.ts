import type { Product, ProductVariant } from "@/types/product.types";
import type { StockMovement, StockMovementType } from "@/types/inventory.types";
import { getDb, nextId } from "./db";

/**
 * Enregistre un mouvement de stock dans l'historique.
 * Chaque mouvement est structuré comme une future ligne de table PostgreSQL
 * (stock_movements) : variante, type, delta, avant/après, motif, référence, date.
 */
export function pushMovement(args: {
  product: Pick<Product, "id" | "name">;
  variant: Pick<ProductVariant, "id" | "sku" | "color" | "size">;
  type: StockMovementType;
  delta: number;
  before: number;
  reason: string;
  reference?: string;
  at?: string;
}): StockMovement {
  const movement: StockMovement = {
    id: nextId("mv"),
    variantId: args.variant.id,
    productId: args.product.id,
    productName: args.product.name,
    sku: args.variant.sku,
    color: args.variant.color,
    size: args.variant.size,
    type: args.type,
    quantityDelta: args.delta,
    quantityBefore: args.before,
    quantityAfter: args.before + args.delta,
    reason: args.reason,
    reference: args.reference,
    createdAt: args.at ?? new Date().toISOString(),
  };
  getDb().movements.unshift(movement);
  return movement;
}
