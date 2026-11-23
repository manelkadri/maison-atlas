import type { InventoryFilters, InventoryItem, StockMovement } from "@fashion/types";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { notFound, outOfStock, validation } from "../../utils/errors";
import { inventoryVariantInclude, movementInclude, toInventoryItem, toStockMovement } from "./mappers";
import type { ParsedMovement } from "./schemas";

/** Stock par variante (produits archivés exclus), statut calculé par `getVariantStatus`. */
export async function listInventory(filters: InventoryFilters = {}): Promise<InventoryItem[]> {
  const where: Prisma.ProductVariantWhereInput = { product: { isArchived: false } };
  if (filters.productId) where.productId = filters.productId;
  if (filters.color) where.color = filters.color;
  if (filters.size) where.size = filters.size;
  const rows = await prisma.productVariant.findMany({
    where,
    include: inventoryVariantInclude,
    orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
  });
  const q = filters.search?.trim().toLowerCase();
  return rows
    .map(toInventoryItem)
    .filter(
      (i) =>
        (!filters.status || filters.status === "all" || i.status === filters.status) &&
        (!q || `${i.productName} ${i.sku}`.toLowerCase().includes(q)),
    );
}

/** Historique, du plus récent au plus ancien. */
export async function listMovements(filters: { variantId?: string; productId?: string } = {}): Promise<StockMovement[]> {
  const rows = await prisma.stockMovement.findMany({
    where: {
      ...(filters.variantId ? { variantId: filters.variantId } : {}),
      ...(filters.productId ? { variant: { productId: filters.productId } } : {}),
    },
    include: movementInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toStockMovement);
}

/**
 * Enregistre UN mouvement = une ligne `StockMovement` avec le stock avant/après exact. La ligne de la variante est
 * verrouillée (SELECT … FOR UPDATE) : aucune autre commande/mouvement ne peut modifier le stock entre la lecture
 * et l'écriture. Une sortie jamais au-delà du stock (OUT_OF_STOCK) ; un ajustement fixe une quantité ABSOLUE.
 */
export async function recordMovement(input: ParsedMovement): Promise<StockMovement> {
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<Array<{ stock: number; productId: string }>>`
        SELECT "stock"::int AS "stock", "productId" FROM "ProductVariant" WHERE "id" = ${input.variantId} FOR UPDATE`;
      const variant = locked[0];
      if (!variant) throw notFound("Variante introuvable.");

      const before = variant.stock;
      let delta: number;
      switch (input.type) {
        case "in":
        case "return":
          delta = input.quantity;
          break;
        case "out":
          if (input.quantity > before) throw outOfStock(`Impossible de retirer ${input.quantity} pièce(s) : le stock actuel est de ${before}.`);
          delta = -input.quantity;
          break;
        case "adjustment":
          delta = input.quantity - before; // quantity = nouvelle valeur absolue
          if (delta === 0) throw validation("L'ajustement ne change pas le stock actuel.");
          break;
      }

      await tx.productVariant.update({ where: { id: input.variantId }, data: { stock: before + delta } });
      await tx.product.update({ where: { id: variant.productId }, data: { updatedAt: new Date() } });
      const movement = await tx.stockMovement.create({
        data: {
          variantId: input.variantId,
          type: input.type,
          quantityDelta: delta,
          quantityBefore: before,
          quantityAfter: before + delta,
          reason: input.reason,
          createdAt: input.date ?? new Date(),
        },
        include: movementInclude,
      });
      return toStockMovement(movement);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}
