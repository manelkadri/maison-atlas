import { describe, expect, it } from "vitest";
import {
  applyProductFilters,
  buildSku,
  canTransition,
  computeOrderTotals,
  findDuplicateSkus,
  findVariant,
  formatDZD,
  generateVariants,
  getShippingFee,
  getStockStatus,
  getTotalStock,
  validatePromotion,
} from "@fashion/shared";
import { categoriesMock } from "@/mocks/categories.mock";
import { productsMock } from "@/mocks/products.mock";
import { promotionsMock } from "@/mocks/promotions.mock";
import { settingsMock } from "@/mocks/settings.mock";

describe("stock par variante", () => {
  it("calcule le statut d'une variante isolément", () => {
    expect(getStockStatus(0, 3)).toBe("out_of_stock");
    expect(getStockStatus(2, 3)).toBe("low");
    expect(getStockStatus(3, 3)).toBe("low");
    expect(getStockStatus(4, 3)).toBe("available");
  });

  it("le stock total est la somme des variantes, mais la disponibilité d'une combinaison ne l'utilise jamais", () => {
    const robe = productsMock.find((p) => p.slug === "robe-midi-satinee")!;
    const total = robe.variants.reduce((s, v) => s + v.stock, 0);
    expect(getTotalStock(robe)).toBe(total);
    const outOfStock = robe.variants.find((v) => v.stock === 0);
    if (outOfStock) {
      // Le produit a du stock au global, pourtant cette combinaison est indisponible.
      expect(total).toBeGreaterThan(0);
      expect(findVariant(robe, outOfStock.color, outOfStock.size)?.stock).toBe(0);
    }
  });

  it("retourne undefined pour une combinaison inexistante", () => {
    const tee = productsMock.find((p) => p.slug === "t-shirt-coton-premium")!;
    expect(findVariant(tee, "Noir", "42")).toBeUndefined();
    expect(findVariant(tee, undefined, "M")).toBeUndefined();
  });
});

describe("génération des variantes", () => {
  it("génère le produit cartésien couleurs × tailles (2 × 3 = 6)", () => {
    const variants = generateVariants({
      reference: "TST-001",
      price: 5000,
      colors: [{ name: "Noir", code: "#1a1a1a" }, { name: "Blanc", code: "#ffffff" }],
      sizes: ["S", "M", "L"],
    });
    expect(variants).toHaveLength(6);
    expect(new Set(variants.map((v) => v.sku)).size).toBe(6);
    expect(variants.every((v) => v.stock === 0)).toBe(true);
    expect(variants[0]!.sku).toBe(buildSku("TST-001", "Noir", "S"));
  });

  it("conserve le stock déjà saisi quand on ajoute une taille", () => {
    const base = generateVariants({ reference: "TST-002", price: 1000, colors: [{ name: "Noir", code: "#000000" }], sizes: ["S", "M"] });
    base[0]!.stock = 12;
    const next = generateVariants({ reference: "TST-002", price: 1000, colors: [{ name: "Noir", code: "#000000" }], sizes: ["S", "M", "L"], existing: base });
    expect(next).toHaveLength(3);
    expect(next.find((v) => v.size === "S")!.stock).toBe(12);
  });

  it("détecte les SKU en doublon sans tenir compte de la casse", () => {
    expect(findDuplicateSkus(["A-1", "b-2", "a-1"])).toEqual(["A-1"]);
  });
});

describe("filtres catalogue", () => {
  const pub = productsMock.filter((p) => p.isPublished && !p.isArchived);

  it("inclut les sous-catégories d'une catégorie parent", () => {
    const femme = applyProductFilters(pub, { category: "femme" }, categoriesMock);
    expect(femme.length).toBeGreaterThan(0);
    expect(femme.every((p) => ["cat_robes", "cat_hauts", "cat_pantalons_f", "cat_manteaux", "cat_femme"].includes(p.categoryId))).toBe(true);
  });

  it("filtre taille+couleur sur une variante réellement en stock", () => {
    const res = applyProductFilters(pub, { sizes: ["M"], colors: ["Noir"] }, categoriesMock);
    for (const p of res) expect(p.variants.some((v) => v.size === "M" && v.color === "Noir" && v.stock > 0)).toBe(true);
  });

  it("tri par prix et filtre de prix", () => {
    const asc = applyProductFilters(pub, { sort: "price_asc" }, categoriesMock);
    expect(asc.map((p) => p.price)).toEqual([...asc.map((p) => p.price)].sort((a, b) => a - b));
    const ranged = applyProductFilters(pub, { minPrice: 5000, maxPrice: 8000 }, categoriesMock);
    expect(ranged.every((p) => p.price >= 5000 && p.price <= 8000)).toBe(true);
  });

  it("collection promotions = produits avec ancien prix supérieur", () => {
    const sale = applyProductFilters(pub, { collection: "sale" }, categoriesMock);
    expect(sale.length).toBeGreaterThan(0);
    expect(sale.every((p) => p.compareAtPrice! > p.price)).toBe(true);
  });

  it("la recherche ignore accents et casse", () => {
    expect(applyProductFilters(pub, { search: "ECHARPE" }, categoriesMock).map((p) => p.slug)).toContain("echarpe-en-laine");
  });
});

describe("commande, livraison et promotions", () => {
  it("les frais de livraison sont séparés et dépendent de la zone et du mode", () => {
    expect(getShippingFee(settingsMock, "16", "home", 10000)).toBe(450);
    expect(getShippingFee(settingsMock, "16", "pickup_point", 10000)).toBe(300);
    expect(getShippingFee(settingsMock, "11", "home", 10000)).toBe(1200); // Tamanrasset (zone 3)
  });

  it("livraison offerte au-delà du seuil", () => {
    expect(getShippingFee({ ...settingsMock, freeShippingThreshold: 20000 }, "16", "home", 25000)).toBe(0);
  });

  it("total = sous-total − remise + livraison", () => {
    expect(computeOrderTotals({ subtotal: 10000, discount: 1000, shippingFee: 450 }).total).toBe(9450);
  });

  it("valide un code actif et refuse expiré / sous le minimum / inconnu", () => {
    const ok = validatePromotion(promotionsMock.find((p) => p.code === "BIENVENUE10"), 10000);
    expect(ok).toMatchObject({ valid: true, discount: 1000 });
    expect(validatePromotion(promotionsMock.find((p) => p.code === "BIENVENUE10"), 2000).valid).toBe(false);
    expect(validatePromotion(promotionsMock.find((p) => p.code === "SOLDES20"), 20000).valid).toBe(false);
    expect(validatePromotion(undefined, 20000).valid).toBe(false);
  });

  it("machine à états des commandes", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("delivered", "pending")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("formate les montants en DZD", () => {
    expect(formatDZD(12500)).toBe("12 500 DA");
    expect(formatDZD(450)).toBe("450 DA");
  });
});
