import { sortSizes } from "@fashion/shared";
import type { InventoryItem, StockMovement, StockMovementType } from "@/types/inventory.types";
import type { StockStatus } from "@/types/product.types";

export const INVENTORY_PAGE_SIZE = 15;

/* ------------------------------------------------------------------ Tri / filtres */

export type InventorySort = "stock_asc" | "stock_desc" | "name" | "sku";

export const INVENTORY_SORT_LABELS: Record<InventorySort, string> = {
  stock_asc: "Stock croissant (urgent d'abord)",
  stock_desc: "Stock décroissant",
  name: "Produit (A-Z)",
  sku: "SKU (A-Z)",
};

export function sortInventory(items: InventoryItem[], sort: InventorySort): InventoryItem[] {
  const byName = (a: InventoryItem, b: InventoryItem) => a.productName.localeCompare(b.productName, "fr") || a.sku.localeCompare(b.sku);
  const copy = [...items];
  switch (sort) {
    case "stock_asc":
      return copy.sort((a, b) => a.stock - b.stock || byName(a, b));
    case "stock_desc":
      return copy.sort((a, b) => b.stock - a.stock || byName(a, b));
    case "name":
      return copy.sort(byName);
    case "sku":
      return copy.sort((a, b) => a.sku.localeCompare(b.sku));
  }
}

export function parseStatusParam(value: string | null | undefined): StockStatus | "all" {
  return value === "low" || value === "out_of_stock" || value === "available" ? value : "all";
}

export type InventoryFilterOptions = {
  products: Array<{ id: string; name: string }>;
  colors: Array<{ name: string; code: string }>;
  sizes: string[];
};

/** Les listes déroulantes de filtres sont dérivées des données réelles. */
export function deriveFilterOptions(items: InventoryItem[]): InventoryFilterOptions {
  const products = new Map<string, string>();
  const colors = new Map<string, string>();
  const sizes = new Set<string>();
  for (const i of items) {
    products.set(i.productId, i.productName);
    if (!colors.has(i.color)) colors.set(i.color, i.colorCode);
    sizes.add(i.size);
  }
  return {
    products: [...products].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    colors: [...colors].map(([name, code]) => ({ name, code })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    sizes: sortSizes([...sizes]),
  };
}

export type InventorySummary = {
  totalVariants: number;
  lowStock: number;
  outOfStock: number;
  totalUnits: number;
  /** Valeur du stock au PRIX D'ACHAT (jamais au prix de vente). */
  stockValueAtCost: number;
};

export function summarizeInventory(items: InventoryItem[], costByProduct: ReadonlyMap<string, number>): InventorySummary {
  let lowStock = 0;
  let outOfStock = 0;
  let totalUnits = 0;
  let stockValueAtCost = 0;
  for (const i of items) {
    if (i.status === "low") lowStock += 1;
    if (i.status === "out_of_stock") outOfStock += 1;
    const units = Math.max(0, i.stock);
    totalUnits += units;
    stockValueAtCost += units * (costByProduct.get(i.productId) ?? 0);
  }
  return { totalVariants: items.length, lowStock, outOfStock, totalUnits, stockValueAtCost };
}

/* ------------------------------------------------------------------ Mouvements */

export type ManualMovementType = "in" | "out" | "adjustment" | "return";

export const MANUAL_MOVEMENT_TYPES: readonly ManualMovementType[] = ["in", "out", "adjustment", "return"];

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  in: "Entrée",
  out: "Sortie",
  adjustment: "Ajustement",
  sale: "Vente",
  return: "Retour client",
  initial: "Stock initial",
};

export const MOVEMENT_QUANTITY_LABELS: Record<ManualMovementType, string> = {
  in: "Quantité à ajouter",
  out: "Quantité à retirer",
  adjustment: "Nouveau stock (quantité comptée)",
  return: "Quantité retournée",
};

export const REASON_SUGGESTIONS: Record<ManualMovementType, readonly string[]> = {
  in: ["Réception fournisseur", "Réassort", "Production atelier"],
  out: ["Casse", "Perte / vol", "Échantillon", "Retour fournisseur"],
  adjustment: ["Inventaire", "Correction d'erreur de saisie", "Écart constaté"],
  return: ["Retour client", "Échange client"],
};

/** Stock résultant d'un mouvement manuel (même règle que le service). */
export function computeNewStock(type: ManualMovementType, quantity: number, current: number): number {
  const q = Number.isFinite(quantity) ? quantity : 0;
  switch (type) {
    case "in":
    case "return":
      return current + q;
    case "out":
      return current - q;
    case "adjustment":
      return q;
  }
}

/** Message d'erreur propre au stock courant, ou null si la quantité est acceptable. */
export function validateMovementQuantity(type: ManualMovementType, quantity: number, current: number): string | null {
  if (!Number.isFinite(quantity)) return "Quantité invalide.";
  if (!Number.isInteger(quantity)) return "Quantité entière requise.";
  if (quantity < 0) return "La quantité ne peut pas être négative.";
  if (type !== "adjustment" && quantity < 1) return "La quantité doit être d'au moins 1.";
  if (type === "out" && quantity > current) {
    return `Impossible de retirer ${quantity} pièce(s) : le stock actuel est de ${current}.`;
  }
  if (type === "adjustment" && quantity === current) return "Le nouveau stock est identique au stock actuel.";
  return null;
}

/** Confirmation requise : retrait/ajustement qui dépasse la moitié du stock ou qui met le stock à 0. */
export function movementNeedsConfirmation(type: ManualMovementType, quantity: number, current: number): boolean {
  if (type === "in" || type === "return") return false;
  const next = computeNewStock(type, quantity, current);
  const decrease = current - next;
  if (decrease <= 0) return false;
  return next === 0 || decrease > current / 2;
}

/* ------------------------------------------------------------------ Dates */

/** "YYYY-MM-DD" en heure locale (jamais via toISOString, qui est en UTC). */
export function toLocalDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isFutureDate(date: string, now: Date = new Date()): boolean {
  return date > toLocalDateInput(now);
}

/** Date saisie → ISO. Aujourd'hui : l'instant présent ; autre jour : midi (heure locale). */
export function movementDateToIso(date: string, now: Date = new Date()): string {
  if (!date || date === toLocalDateInput(now)) return now.toISOString();
  return new Date(`${date}T12:00:00`).toISOString();
}

export type MovementFilters = { type?: StockMovementType | "all"; dateFrom?: string; dateTo?: string };

export function filterMovements(movements: StockMovement[], f: MovementFilters): StockMovement[] {
  return movements.filter((m) => {
    if (f.type && f.type !== "all" && m.type !== f.type) return false;
    const day = toLocalDateInput(new Date(m.createdAt));
    if (f.dateFrom && day < f.dateFrom) return false;
    if (f.dateTo && day > f.dateTo) return false;
    return true;
  });
}

export function formatSignedQuantity(delta: number): string {
  return delta > 0 ? `+${delta}` : delta < 0 ? `-${Math.abs(delta)}` : "0";
}
