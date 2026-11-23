import type { StockStatus } from "./product";

/**
 * in          : réception de marchandise (+)
 * out         : retrait manuel (casse, perte, usage interne) (-)
 * adjustment  : correction d'inventaire — fixe la quantité à une valeur absolue
 * sale        : sortie liée à une commande
 * return      : retour client réintégré au stock
 * initial     : stock initial lors de la création de la variante
 */
export type StockMovementType =
  | "in"
  | "out"
  | "adjustment"
  | "sale"
  | "return"
  | "initial";

export type StockMovement = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  type: StockMovementType;
  /** Variation signée appliquée au stock (ex. +20, -3). */
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  /** Référence libre (ex. numéro de commande). */
  reference?: string;
  createdAt: string;
};

export type CreateStockMovementInput = {
  variantId: string;
  type: Exclude<StockMovementType, "sale" | "initial">;
  /**
   * in/out/return : quantité positive à ajouter/retirer.
   * adjustment    : nouvelle quantité absolue.
   */
  quantity: number;
  reason: string;
  /** ISO date. Défaut : maintenant. */
  date?: string;
};

/** Ligne de la vue "stock" (variante + contexte produit). */
export type InventoryItem = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string;
  sku: string;
  color: string;
  colorCode: string;
  size: string;
  stock: number;
  alertThreshold: number;
  status: StockStatus;
};

export type InventoryFilters = {
  search?: string;
  productId?: string;
  color?: string;
  size?: string;
  status?: StockStatus | "all";
};
