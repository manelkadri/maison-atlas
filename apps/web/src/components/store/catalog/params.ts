import type { Category, ProductFilters, ProductSort } from "@/types/product.types";

/**
 * Paramètres d'URL du catalogue <-> ProductFilters (module pur, sans React).
 * L'URL est la source de vérité des filtres : partageable, bouton retour fonctionnel.
 *
 * Exemple : /shop?category=femme&collection=sale&search=robe&sizes=M,L&colors=Noir,Beige
 *           &min=5000&max=15000&inStock=1&sort=price_asc&page=2
 */

export const DEFAULT_SORT: ProductSort = "newest";

export const SORT_OPTIONS: ReadonlyArray<{ value: ProductSort; label: string }> = [
  { value: "newest", label: "Nouveautés" },
  { value: "popular", label: "Popularité" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
];

const SORT_VALUES: readonly string[] = SORT_OPTIONS.map((o) => o.value);
const MAX_LIST_ITEMS = 24;
const MAX_PRICE = 10_000_000;
const MAX_PAGE = 10_000;

/** Entrée acceptée : `URLSearchParams` (client) ou `searchParams` d'une page serveur. */
export type RawParams =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

export type CatalogQuery = { filters: ProductFilters; page: number };

function readParam(raw: RawParams, key: string): string | undefined {
  if (typeof (raw as { get?: unknown }).get === "function") {
    return (raw as { get(name: string): string | null }).get(key) ?? undefined;
  }
  const value = (raw as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = [
    ...new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_LIST_ITEMS);
  return items.length ? items : undefined;
}

function parseAmount(value: string | undefined): number | undefined {
  if (!value || !/^\d{1,8}$/.test(value.trim())) return undefined;
  const n = Number(value);
  return n > 0 && n <= MAX_PRICE ? n : undefined;
}

export function parseCatalogParams(raw: RawParams): CatalogQuery {
  const filters: ProductFilters = {};

  const search = readParam(raw, "search")?.trim().slice(0, 100);
  if (search) filters.search = search;

  const category = readParam(raw, "category")?.trim();
  if (category) filters.category = category;

  const collection = readParam(raw, "collection");
  if (collection === "new" || collection === "sale") filters.collection = collection;

  const sizes = parseList(readParam(raw, "sizes"));
  if (sizes) filters.sizes = sizes;

  const colors = parseList(readParam(raw, "colors"));
  if (colors) filters.colors = colors;

  let min = parseAmount(readParam(raw, "min"));
  let max = parseAmount(readParam(raw, "max"));
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  if (min !== undefined) filters.minPrice = min;
  if (max !== undefined) filters.maxPrice = max;

  const inStock = readParam(raw, "inStock");
  if (inStock === "1" || inStock === "true") filters.inStockOnly = true;

  const sort = readParam(raw, "sort");
  if (sort && SORT_VALUES.includes(sort) && sort !== DEFAULT_SORT) filters.sort = sort as ProductSort;

  const pageRaw = Number(readParam(raw, "page"));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, MAX_PAGE) : 1;

  return { filters, page };
}

const enc = encodeURIComponent;

/** Chaîne de requête (sans « ? »). Les listes restent lisibles : `sizes=M,L`. */
export function serializeCatalogParams(filters: ProductFilters, page = 1): string {
  const parts: string[] = [];
  const search = filters.search?.trim();
  if (search) parts.push(`search=${enc(search)}`);
  if (filters.category) parts.push(`category=${enc(filters.category)}`);
  if (filters.collection) parts.push(`collection=${filters.collection}`);
  if (filters.sizes?.length) parts.push(`sizes=${filters.sizes.map(enc).join(",")}`);
  if (filters.colors?.length) parts.push(`colors=${filters.colors.map(enc).join(",")}`);
  if (filters.minPrice !== undefined && filters.minPrice > 0) parts.push(`min=${Math.round(filters.minPrice)}`);
  if (filters.maxPrice !== undefined && filters.maxPrice > 0) parts.push(`max=${Math.round(filters.maxPrice)}`);
  if (filters.inStockOnly) parts.push("inStock=1");
  if (filters.sort && filters.sort !== DEFAULT_SORT) parts.push(`sort=${filters.sort}`);
  if (page > 1) parts.push(`page=${page}`);
  return parts.join("&");
}

export function catalogUrl(filters: ProductFilters, page = 1, basePath = "/shop"): string {
  const qs = serializeCatalogParams(filters, page);
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Nombre de filtres actifs (hors recherche et tri). Le prix compte pour un seul filtre. */
export function countActiveFilters(filters: ProductFilters): number {
  return (
    (filters.category ? 1 : 0) +
    (filters.collection ? 1 : 0) +
    (filters.sizes?.length ?? 0) +
    (filters.colors?.length ?? 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0)
  );
}

export function hasAnyFilter(filters: ProductFilters): boolean {
  return countActiveFilters(filters) > 0 || !!filters.search?.trim();
}

/** Retire tous les filtres en conservant le tri choisi. */
export function resetFilters(filters: ProductFilters): ProductFilters {
  return filters.sort ? { sort: filters.sort } : {};
}

/** Titre de page selon la catégorie, la collection ou la recherche. */
export function getCatalogTitle(filters: ProductFilters, categories: Category[] = []): string {
  if (filters.search?.trim()) return `Résultats pour « ${filters.search.trim()} »`;
  if (filters.category) {
    const category = categories.find((c) => c.slug === filters.category);
    if (category) return category.name;
  }
  if (filters.collection === "new") return "Nouveautés";
  if (filters.collection === "sale") return "Promotions";
  return "Toute la boutique";
}
