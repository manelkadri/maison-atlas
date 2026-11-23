import { getVariantStatus } from "@fashion/shared";
import type { InventoryItem } from "@/types/inventory.types";
import type { InventoryService } from "./contracts";
import { ServiceError } from "./errors";
import { commit, getDb } from "./mock/db";
import { pushMovement } from "./mock/movements";

export const inventoryService: InventoryService = {
  async getInventory(filters = {}) {
    const items: InventoryItem[] = [];
    for (const product of getDb().products) {
      if (product.isArchived) continue;
      for (const v of product.variants) {
        items.push({
          variantId: v.id,
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          imageUrl: (product.images.find((im) => im.color === v.color) ?? product.images[0])?.url ?? "",
          sku: v.sku,
          color: v.color,
          colorCode: v.colorCode,
          size: v.size,
          stock: v.stock,
          alertThreshold: v.alertThreshold,
          status: getVariantStatus(v),
        });
      }
    }
    const q = filters.search?.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!filters.productId || i.productId === filters.productId) &&
        (!filters.color || i.color === filters.color) &&
        (!filters.size || i.size === filters.size) &&
        (!filters.status || filters.status === "all" || i.status === filters.status) &&
        (!q || `${i.productName} ${i.sku}`.toLowerCase().includes(q)),
    );
  },

  async getMovements(filters = {}) {
    return structuredClone(
      getDb()
        .movements.filter((m) => (!filters.variantId || m.variantId === filters.variantId) && (!filters.productId || m.productId === filters.productId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },

  async recordMovement(input) {
    const db = getDb();
    const product = db.products.find((p) => p.variants.some((v) => v.id === input.variantId));
    const variant = product?.variants.find((v) => v.id === input.variantId);
    if (!product || !variant) throw new ServiceError("NOT_FOUND", "Variante introuvable.");
    if (!Number.isInteger(input.quantity) || input.quantity < 0) throw new ServiceError("VALIDATION", "Quantité invalide.");

    if (input.date && new Date(input.date).getTime() > Date.now() + 60_000) {
      throw new ServiceError("VALIDATION", "La date d'un mouvement ne peut pas être dans le futur.");
    }

    const before = variant.stock;
    let delta: number;
    switch (input.type) {
      case "in":
      case "return":
        if (input.quantity < 1) throw new ServiceError("VALIDATION", "La quantité doit être d'au moins 1.");
        delta = input.quantity;
        break;
      case "out":
        if (input.quantity < 1) throw new ServiceError("VALIDATION", "La quantité doit être d'au moins 1.");
        if (input.quantity > before) {
          throw new ServiceError("OUT_OF_STOCK", `Impossible de retirer ${input.quantity} pièce(s) : le stock actuel est de ${before}.`);
        }
        delta = -input.quantity;
        break;
      case "adjustment":
        delta = input.quantity - before; // quantity = nouvelle valeur absolue
        if (delta === 0) throw new ServiceError("VALIDATION", "L'ajustement ne change pas le stock actuel.");
        break;
    }

    variant.stock = before + delta;
    const movement = pushMovement({
      product, variant, type: input.type, delta, before, reason: input.reason,
      at: input.date ? new Date(input.date).toISOString() : undefined,
    });
    product.updatedAt = new Date().toISOString();
    commit();
    return structuredClone(movement);
  },
};
