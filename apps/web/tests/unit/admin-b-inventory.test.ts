import { beforeEach, describe, expect, it } from "vitest";
import {
  computeNewStock,
  deriveFilterOptions,
  filterMovements,
  movementDateToIso,
  movementNeedsConfirmation,
  parseStatusParam,
  sortInventory,
  summarizeInventory,
  toLocalDateInput,
  validateMovementQuantity,
} from "@/features/inventory/logic";
import { ServiceError, inventoryService, productService } from "@/services";
import { resetDb } from "@/services/mock/db";

beforeEach(() => {
  resetDb();
});

async function pickVariant(minStock = 5) {
  const items = await inventoryService.getInventory();
  const item = items.find((i) => i.stock >= minStock);
  if (!item) throw new Error("Aucune variante de test");
  return item;
}

async function stockOf(variantId: string): Promise<number> {
  const items = await inventoryService.getInventory();
  return items.find((i) => i.variantId === variantId)!.stock;
}

describe("mouvements de stock (service)", () => {
  it("entrée : augmente le stock de la variante uniquement et historise avant/après", async () => {
    const item = await pickVariant();
    const siblings = (await inventoryService.getInventory({ productId: item.productId })).filter((i) => i.variantId !== item.variantId);
    const siblingStocks = siblings.map((s) => s.stock);

    const mv = await inventoryService.recordMovement({ variantId: item.variantId, type: "in", quantity: 12, reason: "Réception fournisseur" });

    expect(mv.type).toBe("in");
    expect(mv.quantityDelta).toBe(12);
    expect(mv.quantityBefore).toBe(item.stock);
    expect(mv.quantityAfter).toBe(item.stock + 12);
    expect(await stockOf(item.variantId)).toBe(item.stock + 12);
    // Les autres variantes du même produit ne bougent pas.
    const after = (await inventoryService.getInventory({ productId: item.productId })).filter((i) => i.variantId !== item.variantId);
    expect(after.map((s) => s.stock)).toEqual(siblingStocks);
  });

  it("sortie supérieure au stock : refusée (OUT_OF_STOCK), stock et historique inchangés", async () => {
    const item = await pickVariant();
    const before = (await inventoryService.getMovements({ variantId: item.variantId })).length;

    await expect(
      inventoryService.recordMovement({ variantId: item.variantId, type: "out", quantity: item.stock + 1, reason: "Casse" }),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    await expect(
      inventoryService.recordMovement({ variantId: item.variantId, type: "out", quantity: item.stock + 1, reason: "Casse" }),
    ).rejects.toBeInstanceOf(ServiceError);

    expect(await stockOf(item.variantId)).toBe(item.stock);
    expect((await inventoryService.getMovements({ variantId: item.variantId })).length).toBe(before);
  });

  it("sortie valide : diminue le stock, variation négative", async () => {
    const item = await pickVariant();
    const mv = await inventoryService.recordMovement({ variantId: item.variantId, type: "out", quantity: 2, reason: "Casse" });
    expect(mv.quantityDelta).toBe(-2);
    expect(await stockOf(item.variantId)).toBe(item.stock - 2);
  });

  it("ajustement : la quantité saisie est la NOUVELLE valeur absolue (variation calculée)", async () => {
    const item = await pickVariant();
    const target = item.stock + 3;
    const up = await inventoryService.recordMovement({ variantId: item.variantId, type: "adjustment", quantity: target, reason: "Inventaire" });
    expect(up.quantityDelta).toBe(3);
    expect(await stockOf(item.variantId)).toBe(target);

    const down = await inventoryService.recordMovement({ variantId: item.variantId, type: "adjustment", quantity: 0, reason: "Inventaire" });
    expect(down.quantityDelta).toBe(-target);
    expect(down.quantityAfter).toBe(0);
    expect(await stockOf(item.variantId)).toBe(0);
  });

  it("retour client : réintègre le stock", async () => {
    const item = await pickVariant(1);
    const mv = await inventoryService.recordMovement({ variantId: item.variantId, type: "return", quantity: 1, reason: "Retour client" });
    expect(mv.quantityAfter).toBe(item.stock + 1);
  });

  it("rejette une quantité nulle pour une entrée et une variante inconnue", async () => {
    const item = await pickVariant();
    await expect(inventoryService.recordMovement({ variantId: item.variantId, type: "in", quantity: 0, reason: "Test" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(inventoryService.recordMovement({ variantId: "inconnue", type: "in", quantity: 1, reason: "Test" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("historique cohérent : chaque mouvement enchaîne sur le précédent et le dernier « après » = stock courant", async () => {
    const item = await pickVariant(6);
    await inventoryService.recordMovement({ variantId: item.variantId, type: "in", quantity: 10, reason: "Réception fournisseur" });
    await inventoryService.recordMovement({ variantId: item.variantId, type: "out", quantity: 4, reason: "Casse" });
    await inventoryService.recordMovement({ variantId: item.variantId, type: "adjustment", quantity: 7, reason: "Inventaire" });

    const history = await inventoryService.getMovements({ variantId: item.variantId });
    const mine = history.slice(0, 3); // du plus récent au plus ancien
    for (const m of mine) expect(m.quantityBefore + m.quantityDelta).toBe(m.quantityAfter);
    expect(mine[0]!.quantityBefore).toBe(mine[1]!.quantityAfter);
    expect(mine[1]!.quantityBefore).toBe(mine[2]!.quantityAfter);
    expect(mine[2]!.quantityBefore).toBe(item.stock);
    expect(mine[0]!.quantityAfter).toBe(await stockOf(item.variantId));
  });
});

describe("logique de stock (pure)", () => {
  it("calcule le nouveau stock selon le type", () => {
    expect(computeNewStock("in", 5, 10)).toBe(15);
    expect(computeNewStock("return", 2, 10)).toBe(12);
    expect(computeNewStock("out", 4, 10)).toBe(6);
    expect(computeNewStock("adjustment", 3, 10)).toBe(3);
  });

  it("valide les quantités avec des messages clairs", () => {
    expect(validateMovementQuantity("out", 11, 10)).toBe("Impossible de retirer 11 pièce(s) : le stock actuel est de 10.");
    expect(validateMovementQuantity("out", 10, 10)).toBeNull();
    expect(validateMovementQuantity("in", 0, 10)).toMatch(/au moins 1/);
    expect(validateMovementQuantity("adjustment", 0, 10)).toBeNull();
    expect(validateMovementQuantity("adjustment", 10, 10)).toMatch(/identique/);
    expect(validateMovementQuantity("in", Number.NaN, 10)).toBe("Quantité invalide.");
    expect(validateMovementQuantity("in", 1.5, 10)).toMatch(/entière/);
  });

  it("exige une confirmation si le retrait dépasse la moitié du stock ou met le stock à 0", () => {
    expect(movementNeedsConfirmation("out", 5, 10)).toBe(false); // exactement la moitié
    expect(movementNeedsConfirmation("out", 6, 10)).toBe(true);
    expect(movementNeedsConfirmation("out", 10, 10)).toBe(true);
    expect(movementNeedsConfirmation("adjustment", 0, 4)).toBe(true);
    expect(movementNeedsConfirmation("adjustment", 9, 10)).toBe(false);
    expect(movementNeedsConfirmation("adjustment", 20, 10)).toBe(false); // augmentation
    expect(movementNeedsConfirmation("in", 100, 1)).toBe(false);
  });

  it("convertit la date saisie en ISO sans décalage de jour", () => {
    const now = new Date(2026, 5, 15, 14, 30);
    expect(toLocalDateInput(now)).toBe("2026-06-15");
    expect(movementDateToIso("2026-06-15", now)).toBe(now.toISOString());
    const other = new Date(movementDateToIso("2026-06-10", now));
    expect(toLocalDateInput(other)).toBe("2026-06-10");
  });

  it("résume le stock : variantes, faible, ruptures, valeur au prix d'achat", async () => {
    const items = await inventoryService.getInventory();
    const products = await productService.getProducts();
    const cost = new Map(products.map((p) => [p.id, p.costPrice]));
    const s = summarizeInventory(items, cost);
    expect(s.totalVariants).toBe(items.length);
    expect(s.lowStock).toBe(items.filter((i) => i.status === "low").length);
    expect(s.outOfStock).toBe(items.filter((i) => i.status === "out_of_stock").length);
    expect(s.stockValueAtCost).toBe(items.reduce((acc, i) => acc + Math.max(0, i.stock) * (cost.get(i.productId) ?? 0), 0));
    expect(s.stockValueAtCost).toBeGreaterThan(0);
  });

  it("trie par stock croissant par défaut et dérive les filtres des données", async () => {
    const items = await inventoryService.getInventory();
    const sorted = sortInventory(items, "stock_asc");
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.stock).toBeGreaterThanOrEqual(sorted[i - 1]!.stock);
    const opts = deriveFilterOptions(items);
    expect(opts.products.length).toBeGreaterThan(1);
    expect(new Set(opts.colors.map((c) => c.name)).size).toBe(opts.colors.length);
    expect(new Set(opts.sizes).size).toBe(opts.sizes.length);
  });

  it("préfiltre d'URL : seuls les statuts connus sont acceptés", () => {
    expect(parseStatusParam("out_of_stock")).toBe("out_of_stock");
    expect(parseStatusParam("low")).toBe("low");
    expect(parseStatusParam("n'importe quoi")).toBe("all");
    expect(parseStatusParam(null)).toBe("all");
  });

  it("filtre l'historique par type et par plage de dates", async () => {
    const item = await pickVariant();
    await inventoryService.recordMovement({ variantId: item.variantId, type: "in", quantity: 1, reason: "Réception fournisseur" });
    await inventoryService.recordMovement({ variantId: item.variantId, type: "out", quantity: 1, reason: "Casse" });
    const all = await inventoryService.getMovements({ variantId: item.variantId });
    const today = toLocalDateInput(new Date());
    expect(filterMovements(all, { type: "out" }).every((m) => m.type === "out")).toBe(true);
    expect(filterMovements(all, { dateFrom: today, dateTo: today }).length).toBeGreaterThanOrEqual(2);
    expect(filterMovements(all, { dateTo: "2000-01-01" })).toHaveLength(0);
  });
});
