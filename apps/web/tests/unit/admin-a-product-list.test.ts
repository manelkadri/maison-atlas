import { describe, expect, it } from "vitest";
import { buildCategoryRows, getProductCategoryOptions } from "@/features/categories/tree";
import {
  DEFAULT_PRODUCT_FILTERS,
  filterAndSortProducts,
  getProductStatus,
  getStockSummary,
  paginateProducts,
  type ProductListFilters,
} from "@/features/products/list-utils";
import { buildBreadcrumbs } from "@/components/admin/shell/breadcrumbs";
import { adminNav, isNavItemActive } from "@/config/admin-nav";
import { fitWithin, validateImageFile, validateImageReference } from "@/lib/image-utils";
import { makeCategory, makeProduct, makeVariant } from "./admin-a-fixtures";

const categories = [
  makeCategory({ id: "femme", name: "Femme", displayOrder: 1 }),
  makeCategory({ id: "robes", name: "Robes", parentId: "femme", displayOrder: 2 }),
  makeCategory({ id: "homme", name: "Homme", displayOrder: 3 }),
  makeCategory({ id: "new", name: "Nouveautés", kind: "collection", displayOrder: 9 }),
  makeCategory({ id: "old", name: "Ancienne", displayOrder: 10, isArchived: true }),
];

const full = [makeVariant({ color: "Noir", size: "M", stock: 5 }), makeVariant({ color: "Noir", size: "L", stock: 5 })];
const partial = [makeVariant({ color: "Noir", size: "M", stock: 5 }), makeVariant({ color: "Noir", size: "L", stock: 0 })];
const none = [makeVariant({ color: "Noir", size: "M", stock: 0 })];

const catalog = [
  makeProduct({ id: "p1", name: "Robe d'été", reference: "R-1", categoryId: "robes", price: 6000, variants: full, createdAt: "2026-03-01T00:00:00Z" }),
  makeProduct({ id: "p2", name: "Chemise lin", reference: "C-2", categoryId: "homme", price: 4000, variants: partial, createdAt: "2026-02-01T00:00:00Z", isPublished: false }),
  makeProduct({ id: "p3", name: "Écharpe", reference: "E-3", categoryId: "femme", price: 2000, variants: none, createdAt: "2026-01-01T00:00:00Z" }),
  makeProduct({ id: "p4", name: "Pull archivé", reference: "P-4", categoryId: "homme", price: 8000, variants: full, isArchived: true, isPublished: false, createdAt: "2025-12-01T00:00:00Z" }),
];

const f = (patch: Partial<ProductListFilters> = {}): ProductListFilters => ({ ...DEFAULT_PRODUCT_FILTERS, ...patch });
const ids = (list: ReturnType<typeof filterAndSortProducts>) => list.map((p) => p.id);

describe("liste produits — filtrage, tri, pagination", () => {
  it("masque les archivés par défaut et trie du plus récent au plus ancien", () => {
    expect(ids(filterAndSortProducts(catalog, f(), categories))).toEqual(["p1", "p2", "p3"]);
  });

  it("inclut les archivés à la demande", () => {
    expect(ids(filterAndSortProducts(catalog, f({ includeArchived: true }), categories))).toContain("p4");
  });

  it("recherche insensible aux accents et à la casse (nom, référence)", () => {
    expect(ids(filterAndSortProducts(catalog, f({ search: "echarpe" }), categories))).toEqual(["p3"]);
    expect(ids(filterAndSortProducts(catalog, f({ search: "c-2" }), categories))).toEqual(["p2"]);
    expect(ids(filterAndSortProducts(catalog, f({ search: "introuvable" }), categories))).toEqual([]);
  });

  it("filtre par catégorie en incluant les sous-catégories", () => {
    expect(ids(filterAndSortProducts(catalog, f({ categoryId: "femme" }), categories)).sort()).toEqual(["p1", "p3"]);
    expect(ids(filterAndSortProducts(catalog, f({ categoryId: "robes" }), categories))).toEqual(["p1"]);
  });

  it("filtre par publication", () => {
    expect(ids(filterAndSortProducts(catalog, f({ publication: "published" }), categories))).toEqual(["p1", "p3"]);
    expect(ids(filterAndSortProducts(catalog, f({ publication: "draft", includeArchived: true }), categories))).toEqual(["p2"]);
  });

  it("filtre rupture partielle vs rupture totale", () => {
    expect(ids(filterAndSortProducts(catalog, f({ stock: "partial" }), categories))).toEqual(["p2"]);
    expect(ids(filterAndSortProducts(catalog, f({ stock: "total" }), categories))).toEqual(["p3"]);
  });

  it("tri par prix et par stock", () => {
    expect(ids(filterAndSortProducts(catalog, f({ sort: "price_asc" }), categories))).toEqual(["p3", "p2", "p1"]);
    expect(ids(filterAndSortProducts(catalog, f({ sort: "stock_desc" }), categories))[0]).toBe("p1");
  });

  it("résumé de stock et statut", () => {
    expect(getStockSummary(catalog[1]!)).toEqual({ total: 5, outVariants: 1, variantCount: 2 });
    expect(getProductStatus(catalog[0]!)).toBe("published");
    expect(getProductStatus(catalog[1]!)).toBe("draft");
    expect(getProductStatus(catalog[3]!)).toBe("archived");
  });

  it("pagine par 10 et borne la page demandée", () => {
    const many = Array.from({ length: 23 }, (_, i) => makeProduct({ id: `m${i}`, slug: `m${i}`, name: `Produit ${i}` }));
    const page1 = paginateProducts(many, 1);
    expect(page1.items).toHaveLength(10);
    expect(page1.totalPages).toBe(3);
    expect(paginateProducts(many, 3).items).toHaveLength(3);
    expect(paginateProducts(many, 99).page).toBe(3);
    expect(paginateProducts([], 1)).toMatchObject({ total: 0, totalPages: 1, items: [] });
  });
});

describe("catégories — arborescence", () => {
  it("parents suivis de leurs enfants, avec comptage de produits", () => {
    const rows = buildCategoryRows(categories, catalog);
    expect(rows.map((r) => `${r.depth}:${r.category.id}`)).toEqual(["0:femme", "1:robes", "0:homme", "0:new", "0:old"]);
    const femme = rows.find((r) => r.category.id === "femme");
    expect(femme).toMatchObject({ productCount: 1, treeProductCount: 2, childCount: 1 });
  });

  it("peut masquer les archivées et filtrer par recherche en gardant le parent", () => {
    expect(buildCategoryRows(categories, catalog, { includeArchived: false }).some((r) => r.category.id === "old")).toBe(false);
    expect(buildCategoryRows(categories, catalog, { search: "robe" }).map((r) => r.category.id)).toEqual(["femme", "robes"]);
  });

  it("les choix de catégorie d'un produit excluent les collections et les archivées", () => {
    const options = getProductCategoryOptions(categories);
    expect(options.map((o) => o.label)).toEqual(["Femme", "Femme / Robes", "Homme"]);
    expect(getProductCategoryOptions(categories, "old").some((o) => o.id === "old")).toBe(true);
  });
});

describe("shell admin — navigation et fil d'Ariane", () => {
  it("expose exactement 9 entrées de navigation vers des pages distinctes", () => {
    expect(adminNav).toHaveLength(9);
    expect(new Set(adminNav.map((i) => i.href)).size).toBe(9);
    expect(adminNav.every((i) => i.href.startsWith("/admin/dashboard") && !i.href.endsWith("#"))).toBe(true);
  });

  it("état actif : exact pour le dashboard, par préfixe ailleurs", () => {
    const [dashboard, products] = adminNav;
    expect(isNavItemActive(dashboard!, "/admin/dashboard")).toBe(true);
    expect(isNavItemActive(dashboard!, "/admin/dashboard/products")).toBe(false);
    expect(isNavItemActive(products!, "/admin/dashboard/products/p1/edit")).toBe(true);
  });

  it("fil d'Ariane : libellés français, dernier segment non cliquable, segment dynamique générique", () => {
    const crumbs = buildBreadcrumbs("/admin/dashboard/products/prod_12/edit");
    expect(crumbs.map((c) => c.label)).toEqual(["Tableau de bord", "Produits", "Détail", "Modifier"]);
    expect(crumbs.map((c) => c.current)).toEqual([false, false, false, true]);
    expect(crumbs[2]?.href).toBe("/admin/dashboard/products/prod_12");
  });

  it("fil d'Ariane : un libellé dynamique remplace « Détail »", () => {
    const crumbs = buildBreadcrumbs("/admin/dashboard/products/prod_12/edit", { "/admin/dashboard/products/prod_12": "Robe d'été" });
    expect(crumbs[2]?.label).toBe("Robe d'été");
  });
});

describe("utilitaires d'images (simulation d'upload)", () => {
  it("redimensionne sans jamais agrandir (≤ 900 px)", () => {
    expect(fitWithin(1800, 900)).toEqual({ width: 900, height: 450 });
    expect(fitWithin(600, 1200)).toEqual({ width: 450, height: 900 });
    expect(fitWithin(400, 300)).toEqual({ width: 400, height: 300 });
  });

  it("refuse les non-images, les formats inconnus et les fichiers > 5 Mo", () => {
    expect(validateImageFile({ type: "application/pdf", size: 1000 })).toMatch(/pas une image/i);
    expect(validateImageFile({ type: "image/svg+xml", size: 1000 })).toMatch(/format/i);
    expect(validateImageFile({ type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/5 Mo/);
    expect(validateImageFile({ type: "image/webp", size: 200_000 })).toBeNull();
  });

  it("accepte un chemin /images/..., une URL https ou une data URL ; refuse le reste", () => {
    expect(validateImageReference("/images/products/a/noir-1.svg")).toBeNull();
    expect(validateImageReference("https://res.cloudinary.com/x/y.jpg")).toBeNull();
    expect(validateImageReference("data:image/webp;base64,AAAA")).toBeNull();
    expect(validateImageReference("javascript:alert(1)")).not.toBeNull();
    expect(validateImageReference("   ")).not.toBeNull();
    expect(validateImageReference("photo.jpg")).not.toBeNull();
  });
});
