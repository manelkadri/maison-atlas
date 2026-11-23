import { formatDZD } from "@fashion/shared";
import { describe, expect, it } from "vitest";
import { getPageItems } from "@/components/store/catalog/catalog-pagination";
import { getActiveChips } from "@/components/store/catalog/active-filters";
import { buildCategoryTree, buildFacets } from "@/components/store/catalog/facets";
import {
  catalogUrl,
  countActiveFilters,
  getCatalogTitle,
  parseCatalogParams,
  resetFilters,
  serializeCatalogParams,
} from "@/components/store/catalog/params";
import { categoriesMock } from "@/mocks/categories.mock";
import { productsMock } from "@/mocks/products.mock";
import type { ProductFilters } from "@/types/product.types";

const qs = (s: string) => new URLSearchParams(s);

describe("paramètres du catalogue <-> filtres", () => {
  it("parse une URL complète", () => {
    const { filters, page } = parseCatalogParams(
      qs("category=femme&collection=sale&search=robe&sizes=M,L&colors=Noir,Beige&min=5000&max=15000&sort=price_asc&inStock=1&page=2"),
    );
    expect(filters).toEqual({
      category: "femme",
      collection: "sale",
      search: "robe",
      sizes: ["M", "L"],
      colors: ["Noir", "Beige"],
      minPrice: 5000,
      maxPrice: 15000,
      sort: "price_asc",
      inStockOnly: true,
    });
    expect(page).toBe(2);
  });

  it("une URL vide donne des filtres vides et la page 1", () => {
    expect(parseCatalogParams(qs(""))).toEqual({ filters: {}, page: 1 });
  });

  it("accepte l'objet searchParams d'une page serveur (valeurs simples ou tableaux)", () => {
    const { filters, page } = parseCatalogParams({ category: ["accessoires", "femme"], sizes: "S", page: "3", ignored: "x" });
    expect(filters).toEqual({ category: "accessoires", sizes: ["S"] });
    expect(page).toBe(3);
  });

  it("ignore les valeurs invalides au lieu de planter", () => {
    const { filters, page } = parseCatalogParams(qs("collection=foo&sort=hack&min=abc&max=-4&page=-2&inStock=0&sizes=,,"));
    expect(filters).toEqual({});
    expect(page).toBe(1);
    expect(parseCatalogParams(qs("page=2.5")).page).toBe(1);
    expect(parseCatalogParams(qs("page=abc")).page).toBe(1);
  });

  it("inverse un intervalle de prix incohérent et dédoublonne les listes", () => {
    const { filters } = parseCatalogParams(qs("min=20000&max=5000&sizes=M,M, L ,M"));
    expect(filters.minPrice).toBe(5000);
    expect(filters.maxPrice).toBe(20000);
    expect(filters.sizes).toEqual(["M", "L"]);
  });

  it("le tri par défaut (nouveautés) n'est pas conservé dans l'URL", () => {
    expect(parseCatalogParams(qs("sort=newest")).filters.sort).toBeUndefined();
    expect(serializeCatalogParams({ sort: "newest" })).toBe("");
    expect(serializeCatalogParams({ sort: "popular" })).toBe("sort=popular");
  });

  it("sérialise avec des listes lisibles et encode les valeurs", () => {
    expect(
      serializeCatalogParams(
        { category: "femme", collection: "new", search: "robe d'été", sizes: ["M", "L"], colors: ["Blanc cassé"], minPrice: 5000, maxPrice: 15000, inStockOnly: true, sort: "price_desc" },
        3,
      ),
    ).toBe("search=robe%20d'%C3%A9t%C3%A9&category=femme&collection=new&sizes=M,L&colors=Blanc%20cass%C3%A9&min=5000&max=15000&inStock=1&sort=price_desc&page=3");
  });

  it("aller-retour : parse(serialize(x)) restitue les filtres", () => {
    const filters: ProductFilters = {
      category: "hauts-femme",
      collection: "new",
      search: "soie & lin",
      sizes: ["XS", "36"],
      colors: ["Blanc cassé", "Noir"],
      minPrice: 4000,
      maxPrice: 9000,
      inStockOnly: true,
      sort: "popular",
    };
    const back = parseCatalogParams(qs(serializeCatalogParams(filters, 4)));
    expect(back.filters).toEqual(filters);
    expect(back.page).toBe(4);
  });

  it("catalogUrl omet le « ? » quand il n'y a aucun filtre", () => {
    expect(catalogUrl({})).toBe("/shop");
    expect(catalogUrl({ category: "femme" }, 2)).toBe("/shop?category=femme&page=2");
  });

  it("compte les filtres actifs (prix = un seul filtre, recherche et tri exclus)", () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ search: "x", sort: "popular" })).toBe(0);
    expect(countActiveFilters({ category: "femme", sizes: ["M", "L"], colors: ["Noir"], minPrice: 1, maxPrice: 2, inStockOnly: true })).toBe(6);
  });

  it("réinitialiser conserve uniquement le tri", () => {
    expect(resetFilters({ category: "femme", search: "x", sort: "price_asc" })).toEqual({ sort: "price_asc" });
    expect(resetFilters({ category: "femme" })).toEqual({});
  });

  it("construit le titre selon la recherche, la catégorie ou la collection", () => {
    expect(getCatalogTitle({}, categoriesMock)).toBe("Toute la boutique");
    expect(getCatalogTitle({ category: "femme" }, categoriesMock)).toBe("Femme");
    expect(getCatalogTitle({ collection: "new" }, categoriesMock)).toBe("Nouveautés");
    expect(getCatalogTitle({ collection: "sale" }, categoriesMock)).toBe("Promotions");
    expect(getCatalogTitle({ search: " robe ", category: "femme" }, categoriesMock)).toBe("Résultats pour « robe »");
  });
});

describe("facettes et puces du catalogue", () => {
  it("calcule tailles, couleurs et bornes de prix depuis les produits", () => {
    const facets = buildFacets(productsMock.filter((p) => p.isPublished && !p.isArchived));
    expect(facets.sizes.length).toBeGreaterThan(3);
    expect(facets.colors.length).toBeGreaterThan(3);
    const prices = productsMock.map((p) => p.price);
    expect(facets.priceBounds.min).toBeLessThanOrEqual(Math.min(...prices));
    expect(facets.priceBounds.max).toBeGreaterThanOrEqual(Math.max(...prices));
    expect(facets.priceBounds.max).toBeGreaterThan(facets.priceBounds.min);
  });

  it("gère un catalogue vide", () => {
    expect(buildFacets([])).toEqual({ sizes: [], colors: [], priceBounds: { min: 0, max: 100 } });
  });

  it("construit l'arbre de catégories (racines + sous-catégories, sans collections)", () => {
    const tree = buildCategoryTree(categoriesMock);
    expect(tree.map((n) => n.category.slug)).toEqual(["femme", "accessoires"]);
    expect(tree[0]?.children.map((c) => c.slug)).toContain("robes");
  });

  it("génère une puce par filtre actif, supprimable individuellement", () => {
    const filters: ProductFilters = { category: "femme", sizes: ["M", "L"], colors: ["Noir"], minPrice: 5000, maxPrice: 9000, inStockOnly: true };
    const chips = getActiveChips(filters, categoriesMock);
    expect(chips.map((c) => c.label)).toEqual(["Femme", "Taille M", "Taille L", "Noir", `${formatDZD(5000)} – ${formatDZD(9000)}`, "En stock"]);
    expect(chips.find((c) => c.key === "size-M")?.remove).toEqual({ sizes: ["L"] });
    expect(chips.find((c) => c.key === "price")?.remove).toEqual({ minPrice: undefined, maxPrice: undefined });
  });
});

describe("pagination du catalogue", () => {
  it("affiche toutes les pages quand il y en a peu", () => {
    expect(getPageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("condense avec des ellipses autour de la page courante", () => {
    expect(getPageItems(1, 12)).toEqual([1, 2, null, 12]);
    expect(getPageItems(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(getPageItems(12, 12)).toEqual([1, null, 11, 12]);
  });
});
