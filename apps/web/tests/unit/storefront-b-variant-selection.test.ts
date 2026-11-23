import { findVariant, getTotalStock } from "@fashion/shared";
import { describe, expect, it } from "vitest";
import {
  buildCartItem,
  clampQuantity,
  getColorOptions,
  getImagesForColor,
  getSizeChoices,
  getVariantAvailability,
  pickInitialColor,
  resolveSelectedVariant,
  resolveSizeOnColorChange,
} from "@/features/products/variant-selection";
import { buildProductJsonLd, serializeJsonLd } from "@/components/store/product/json-ld";
import type { Product } from "@/types/product.types";
import { testProduct } from "./storefront-b-fixtures";

describe("sélection de variante (fiche produit)", () => {
  it("identifie la bonne variante pour une couleur + taille", () => {
    const v = resolveSelectedVariant(testProduct, "Beige", "S");
    expect(v?.id).toBe("var-beige-s");
    expect(v?.stock).toBe(4);
  });

  it("une combinaison inexistante ne donne aucune variante (Beige M n'existe pas)", () => {
    expect(resolveSelectedVariant(testProduct, "Beige", "M")).toBeUndefined();
    const choices = getSizeChoices(testProduct, "Beige");
    expect(choices.find((c) => c.size === "M")).toMatchObject({ state: "unavailable" });
    expect(choices.find((c) => c.size === "M")?.variant).toBeUndefined();
  });

  it("le stock global est confortable mais la combinaison choisie est épuisée : non commandable", () => {
    expect(getTotalStock(testProduct)).toBe(11);
    const soldOut = findVariant(testProduct, "Noir", "S");
    expect(soldOut?.stock).toBe(0);
    const availability = getVariantAvailability(soldOut);
    expect(availability).toMatchObject({ kind: "out_of_stock", canAdd: false, maxQuantity: 0, label: "Rupture de stock" });
    expect(getSizeChoices(testProduct, "Noir").find((c) => c.size === "S")?.state).toBe("sold_out");
  });

  it("calcule l'état des tailles pour chaque couleur indépendamment", () => {
    expect(getSizeChoices(testProduct, "Noir").map((c) => [c.size, c.state])).toEqual([
      ["S", "sold_out"],
      ["M", "available"],
      ["L", "available"],
    ]);
    expect(getSizeChoices(testProduct, "Beige").map((c) => [c.size, c.state])).toEqual([
      ["S", "available"],
      ["M", "unavailable"],
      ["L", "sold_out"],
    ]);
  });

  it("messages de disponibilité : aucune taille, en stock, stock faible, rupture", () => {
    expect(getVariantAvailability(undefined)).toMatchObject({ kind: "no_size", label: "Choisissez une taille", canAdd: false });
    expect(getVariantAvailability(findVariant(testProduct, "Noir", "M"))).toMatchObject({ kind: "available", label: "En stock", maxQuantity: 5, canAdd: true });
    expect(getVariantAvailability(findVariant(testProduct, "Noir", "L"))).toMatchObject({ kind: "low", label: "Plus que 2 en stock", maxQuantity: 2, canAdd: true });
  });

  it("changement de couleur : conserve la taille si la combinaison existe ET est en stock", () => {
    expect(resolveSizeOnColorChange(testProduct, "Beige", "S")).toBe("S"); // Beige S : 4 en stock
    expect(resolveSizeOnColorChange(testProduct, "Noir", "M")).toBe("M");
  });

  it("changement de couleur : désélectionne la taille si inexistante ou épuisée", () => {
    expect(resolveSizeOnColorChange(testProduct, "Beige", "M")).toBeUndefined(); // n'existe pas
    expect(resolveSizeOnColorChange(testProduct, "Beige", "L")).toBeUndefined(); // épuisée
    expect(resolveSizeOnColorChange(testProduct, "Noir", "S")).toBeUndefined(); // épuisée
    expect(resolveSizeOnColorChange(testProduct, "Noir", undefined)).toBeUndefined();
  });

  it("plafonne la quantité au stock de la variante", () => {
    const m = findVariant(testProduct, "Noir", "M"); // stock 5
    const l = findVariant(testProduct, "Noir", "L"); // stock 2
    expect(clampQuantity(99, m)).toBe(5);
    expect(clampQuantity(0, m)).toBe(1);
    expect(clampQuantity(-3, m)).toBe(1);
    expect(clampQuantity(Number.NaN, m)).toBe(1);
    // Passer d'une variante à une autre ramène la quantité dans les bornes.
    expect(clampQuantity(5, l)).toBe(2);
    expect(clampQuantity(3, undefined)).toBe(1);
  });

  it("choisit par défaut la première couleur qui a du stock", () => {
    expect(pickInitialColor(testProduct)).toBe("Noir");
    const noirSoldOut: Product = { ...testProduct, variants: testProduct.variants.map((v) => (v.color === "Noir" ? { ...v, stock: 0 } : v)) };
    expect(pickInitialColor(noirSoldOut)).toBe("Beige");
    const allSoldOut: Product = { ...testProduct, variants: testProduct.variants.map((v) => ({ ...v, stock: 0 })) };
    expect(pickInitialColor(allSoldOut)).toBe("Noir");
    expect(getColorOptions(allSoldOut).every((c) => c.soldOut)).toBe(true);
  });

  it("filtre les images sur la couleur, avec repli sur toutes les images", () => {
    expect(getImagesForColor(testProduct, "Noir").map((i) => i.id)).toEqual(["im-1", "im-2"]);
    expect(getImagesForColor(testProduct, "Beige").map((i) => i.id)).toEqual(["im-3"]);
    expect(getImagesForColor(testProduct, "Rouge").map((i) => i.id)).toEqual(["im-1", "im-2", "im-3"]);
    expect(getImagesForColor(testProduct, undefined)).toHaveLength(3);
  });

  it("construit la ligne de panier depuis la variante (prix, stock, image de la couleur)", () => {
    const variant = findVariant(testProduct, "Beige", "S")!;
    expect(buildCartItem(testProduct, variant)).toEqual({
      variantId: "var-beige-s",
      productId: "prod-test",
      slug: "robe-de-test",
      name: "Robe de test",
      imageUrl: "/images/products/test/beige-1.svg",
      color: "Beige",
      colorCode: "#d8c3a5",
      size: "S",
      sku: "TST-BEI-S",
      unitPrice: 10000,
      maxStock: 4,
    });
  });
});

describe("JSON-LD Product", () => {
  const options = { siteUrl: "https://maison-atlas.example/", brand: "Maison Atlas" };

  it("décrit le produit avec référence, marque, devise DZD et URL absolue", () => {
    const ld = buildProductJsonLd(testProduct, options);
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("Robe de test");
    expect(ld.sku).toBe("TST-001");
    expect(ld.mpn).toBe("TST-001");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Maison Atlas" });
    expect(ld.image[0]).toBe("https://maison-atlas.example/images/products/test/noir-1.svg");
    expect(ld.offers).toMatchObject({ "@type": "Offer", price: 10000, priceCurrency: "DZD", url: "https://maison-atlas.example/product/robe-de-test" });
  });

  it("la disponibilité suit le stock réel des variantes", () => {
    expect(buildProductJsonLd(testProduct, options).offers.availability).toBe("https://schema.org/InStock");
    const soldOut: Product = { ...testProduct, variants: testProduct.variants.map((v) => ({ ...v, stock: 0 })) };
    expect(buildProductJsonLd(soldOut, options).offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("utilise AggregateOffer quand les variantes ont des prix différents", () => {
    const mixed: Product = { ...testProduct, variants: testProduct.variants.map((v, i) => (i === 0 ? { ...v, price: 12000 } : v)) };
    expect(buildProductJsonLd(mixed, options).offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: 10000, highPrice: 12000 });
  });

  it("neutralise « < » pour ne pas casser la balise script", () => {
    expect(serializeJsonLd({ name: "</script><b>" })).not.toContain("<");
  });
});
