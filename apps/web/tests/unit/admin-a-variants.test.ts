import { describe, expect, it } from "vitest";
import {
  applyStockToAll,
  findSkuIssues,
  getTotalVariantStock,
  rebuildSkus,
  syncVariants,
  type VariantRow,
} from "@/features/products/variants";

const noir = { name: "Noir", code: "#1a1a1a" };
const beige = { name: "Beige", code: "#d8c3a5" };

function sync(colors: Array<{ name: string; code: string }>, sizes: string[], existing: VariantRow[] = []) {
  return syncVariants({ reference: "ATL-T-001", price: 5000, colors, sizes, defaultAlertThreshold: 3, existing });
}

describe("génération de variantes dans le formulaire", () => {
  it("2 couleurs × 3 tailles = 6 variantes avec SKU uniques", () => {
    const { variants, addedCount } = sync([noir, beige], ["S", "M", "L"]);
    expect(variants).toHaveLength(6);
    expect(addedCount).toBe(6);
    expect(new Set(variants.map((v) => v.sku)).size).toBe(6);
    expect(variants.every((v) => v.price === 5000 && v.stock === 0 && v.alertThreshold === 3)).toBe(true);
    expect(variants[0]).toMatchObject({ color: "Noir", size: "S", sku: "ATL-T-001-NOI-S" });
  });

  it("ordonne les tailles de façon logique", () => {
    const { variants } = sync([noir], ["XL", "S", "M"]);
    expect(variants.map((v) => v.size)).toEqual(["S", "M", "XL"]);
  });

  it("conserve stock, SKU modifié et seuil saisis quand on ajoute une taille", () => {
    const first = sync([noir, beige], ["S", "M"]).variants.map((v) => ({ ...v }));
    first[0] = { ...first[0]!, stock: 12, sku: "MON-SKU", alertThreshold: 7 };
    const next = sync([noir, beige], ["S", "M", "L"], first);
    expect(next.variants).toHaveLength(6);
    expect(next.addedCount).toBe(2);
    const kept = next.variants.find((v) => v.color === "Noir" && v.size === "S");
    expect(kept).toMatchObject({ stock: 12, sku: "MON-SKU", alertThreshold: 7 });
    expect(next.removed).toHaveLength(0);
  });

  it("retirer une couleur signale les variantes retirées ayant du stock", () => {
    const base = applyStockToAll(sync([noir, beige], ["S", "M"]).variants, 5);
    const result = sync([noir], ["S", "M"], base);
    expect(result.variants).toHaveLength(2);
    expect(result.removed).toHaveLength(2);
    expect(result.removedWithStock).toHaveLength(2);
    expect(getTotalVariantStock(result.removedWithStock)).toBe(10);
  });

  it("retirer une variante sans stock ne déclenche pas d'avertissement", () => {
    const result = sync([noir], ["S"], sync([noir], ["S", "M"]).variants);
    expect(result.removed).toHaveLength(1);
    expect(result.removedWithStock).toHaveLength(0);
  });

  it("conserve id et prix des variantes existantes et met à jour le code couleur", () => {
    const existing: VariantRow[] = [{ id: "var_9", sku: "X-1", color: "Noir", colorCode: "#000000", size: "M", price: 4200, stock: 3, alertThreshold: 2 }];
    const { variants } = sync([{ name: "Noir", code: "#111111" }], ["M"], existing);
    expect(variants[0]).toMatchObject({ id: "var_9", price: 4200, stock: 3, colorCode: "#111111" });
  });

  it("applique le même stock à toutes les variantes (jamais négatif)", () => {
    const rows = sync([noir, beige], ["S", "M"]).variants;
    expect(applyStockToAll(rows, 8).every((v) => v.stock === 8)).toBe(true);
    expect(applyStockToAll(rows, -4).every((v) => v.stock === 0)).toBe(true);
  });

  it("régénère les SKU depuis la référence", () => {
    const rows = sync([noir], ["M"]).variants.map((v) => ({ ...v, sku: "A-MANO" }));
    expect(rebuildSkus(rows, "NEW-REF")[0]?.sku).toBe("NEW-REF-NOI-M");
  });
});

describe("unicité des SKU", () => {
  it("détecte les doublons internes (insensible à la casse) et les SKU vides", () => {
    const issues = findSkuIssues([{ sku: "abc-1" }, { sku: "ABC-1" }, { sku: "  " }, { sku: "OK-1" }], []);
    expect(issues.get(0)).toMatch(/doublon/i);
    expect(issues.get(1)).toMatch(/doublon/i);
    expect(issues.get(2)).toMatch(/requis/i);
    expect(issues.has(3)).toBe(false);
  });

  it("détecte un SKU déjà utilisé par un autre produit", () => {
    const issues = findSkuIssues([{ sku: "ATL-W-001-NOI-M" }, { sku: "NEW-1" }], ["atl-w-001-noi-m", "OTHER"]);
    expect(issues.get(0)).toMatch(/autre produit/i);
    expect(issues.has(1)).toBe(false);
  });

  it("aucun problème quand tout est unique", () => {
    expect(findSkuIssues([{ sku: "A" }, { sku: "B" }], ["C"]).size).toBe(0);
  });
});
