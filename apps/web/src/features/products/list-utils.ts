import { getTotalStock, getVariantStatus, paginate } from "@fashion/shared";
import type { Category, PaginatedResult, Product } from "@/types/product.types";

export type PublicationFilter = "all" | "published" | "draft";
/** all : tous · partial : au moins une variante en rupture mais du stock restant · total : plus aucun stock. */
export type StockFilter = "all" | "partial" | "total";
export type ProductListSort = "newest" | "oldest" | "name_asc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";
export type ProductPublicationStatus = "published" | "draft" | "archived";

export type ProductListFilters = {
  search: string;
  categoryId: string;
  publication: PublicationFilter;
  stock: StockFilter;
  includeArchived: boolean;
  sort: ProductListSort;
};

export const DEFAULT_PRODUCT_FILTERS: ProductListFilters = {
  search: "",
  categoryId: "all",
  publication: "all",
  stock: "all",
  includeArchived: false,
  sort: "newest",
};

export const PRODUCT_SORT_LABELS: Record<ProductListSort, string> = {
  newest: "Plus récents",
  oldest: "Plus anciens",
  name_asc: "Nom (A → Z)",
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
  stock_asc: "Stock croissant",
  stock_desc: "Stock décroissant",
};

export function getProductStatus(p: Pick<Product, "isArchived" | "isPublished">): ProductPublicationStatus {
  if (p.isArchived) return "archived";
  return p.isPublished ? "published" : "draft";
}

export function getStockSummary(p: Pick<Product, "variants">): { total: number; outVariants: number; variantCount: number } {
  return {
    total: getTotalStock(p),
    outVariants: p.variants.filter((v) => getVariantStatus(v) === "out_of_stock").length,
    variantCount: p.variants.length,
  };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Identifiants d'une catégorie et de tous ses descendants. */
export function getCategoryAndDescendantIds(categories: Category[], categoryId: string): Set<string> {
  const ids = new Set<string>([categoryId]);
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
  return ids;
}

/** Filtre + tri de la liste admin des produits. Fonction pure. */
export function filterAndSortProducts(products: Product[], filters: ProductListFilters, categories: Category[]): Product[] {
  let result = products;

  if (!filters.includeArchived) result = result.filter((p) => !p.isArchived);

  const q = normalize(filters.search.trim());
  if (q) result = result.filter((p) => normalize(`${p.name} ${p.reference} ${p.slug} ${p.tags.join(" ")}`).includes(q));

  if (filters.categoryId !== "all") {
    const ids = getCategoryAndDescendantIds(categories, filters.categoryId);
    result = result.filter((p) => ids.has(p.categoryId));
  }

  if (filters.publication === "published") result = result.filter((p) => !p.isArchived && p.isPublished);
  if (filters.publication === "draft") result = result.filter((p) => !p.isArchived && !p.isPublished);

  if (filters.stock === "partial") {
    result = result.filter((p) => {
      const s = getStockSummary(p);
      return s.outVariants > 0 && s.total > 0;
    });
  }
  if (filters.stock === "total") result = result.filter((p) => getTotalStock(p) === 0);

  const list = [...result];
  switch (filters.sort) {
    case "oldest":
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "name_asc":
      return list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    case "price_asc":
      return list.sort((a, b) => a.price - b.price);
    case "price_desc":
      return list.sort((a, b) => b.price - a.price);
    case "stock_asc":
      return list.sort((a, b) => getTotalStock(a) - getTotalStock(b));
    case "stock_desc":
      return list.sort((a, b) => getTotalStock(b) - getTotalStock(a));
    case "newest":
    default:
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const PRODUCTS_PAGE_SIZE = 10;

export function paginateProducts(products: Product[], page: number, pageSize = PRODUCTS_PAGE_SIZE): PaginatedResult<Product> {
  return paginate(products, page, pageSize);
}

/** Nombre de filtres actifs (hors tri), pour le bouton « Réinitialiser ». */
export function countActiveFilters(f: ProductListFilters): number {
  return (f.search.trim() ? 1 : 0) + (f.categoryId !== "all" ? 1 : 0) + (f.publication !== "all" ? 1 : 0) + (f.stock !== "all" ? 1 : 0) + (f.includeArchived ? 1 : 0);
}
