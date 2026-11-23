import type { Category, PaginatedResult, Product, ProductFilters, ProductSort } from "@fashion/types";
import { isNewProduct, isOnSale, isProductInStock } from "./stock";

/** Slugs de la catégorie + de toutes ses sous-catégories. */
export function getCategoryTreeSlugs(categories: Category[], slug: string): { ids: Set<string>; found: boolean } {
  const root = categories.find((c) => c.slug === slug);
  if (!root) return { ids: new Set(), found: false };
  const ids = new Set<string>([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        changed = true;
      }
    }
  }
  return { ids, found: true };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function sortProducts(products: Product[], sort: ProductSort = "newest"): Product[] {
  const list = [...products];
  switch (sort) {
    case "price_asc":
      return list.sort((a, b) => a.price - b.price);
    case "price_desc":
      return list.sort((a, b) => b.price - a.price);
    case "popular":
      return list.sort((a, b) => b.soldCount - a.soldCount);
    case "newest":
    default:
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/**
 * Filtre pur et déterministe, utilisé par le service mock aujourd'hui
 * et réutilisable par le backend (ou comme référence de comportement) demain.
 * Les couleurs/tailles filtrent sur des VARIANTES réellement disponibles :
 * un produit n'apparaît pas pour "M" si la taille M est en rupture dans toutes ses couleurs.
 */
export function applyProductFilters(products: Product[], filters: ProductFilters, categories: Category[], now = new Date()): Product[] {
  let result = products;

  if (filters.search?.trim()) {
    const q = normalize(filters.search.trim());
    result = result.filter((p) => normalize(`${p.name} ${p.reference} ${p.tags.join(" ")} ${p.description}`).includes(q));
  }

  if (filters.category) {
    const { ids, found } = getCategoryTreeSlugs(categories, filters.category);
    result = found ? result.filter((p) => ids.has(p.categoryId)) : [];
  }

  if (filters.collection === "new") result = result.filter((p) => isNewProduct(p, now));
  if (filters.collection === "sale") result = result.filter((p) => isOnSale(p));

  const sizes = filters.sizes?.length ? filters.sizes : undefined;
  const colors = filters.colors?.length ? filters.colors : undefined;
  if (sizes || colors) {
    result = result.filter((p) =>
      p.variants.some(
        (v) => v.stock > 0 && (!sizes || sizes.includes(v.size)) && (!colors || colors.includes(v.color)),
      ),
    );
  }

  if (filters.minPrice !== undefined) result = result.filter((p) => p.price >= filters.minPrice!);
  if (filters.maxPrice !== undefined) result = result.filter((p) => p.price <= filters.maxPrice!);
  if (filters.inStockOnly) result = result.filter((p) => isProductInStock(p));

  return sortProducts(result, filters.sort);
}

export function paginate<T>(items: T[], page = 1, pageSize = 12): PaginatedResult<T> {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((safePage - 1) * safeSize, safePage * safeSize),
    total: items.length,
    page: safePage,
    pageSize: safeSize,
    totalPages,
  };
}
