import { apiFetch, apiFetchOrNull, type ApiQuery } from "@/lib/api-client";
import type { PaginatedResult, Product, ProductFilters, UpdateProductInput } from "@/types/product.types";
import type { ProductService } from "../contracts";

const seg = encodeURIComponent;

/** Filtres de la boutique → query-string (`sizes`/`colors` en listes séparées par des virgules). */
export function productFiltersToQuery(filters: ProductFilters, page: number, pageSize: number): ApiQuery {
  return {
    search: filters.search?.trim(),
    category: filters.category,
    collection: filters.collection,
    sizes: filters.sizes,
    colors: filters.colors,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStockOnly: filters.inStockOnly ? true : undefined,
    sort: filters.sort,
    page,
    pageSize,
  };
}

export const apiProductService: ProductService = {
  getProducts: (options) => apiFetch<Product[]>(options?.onlyPublic ? "/products/catalog" : "/admin/products"),

  searchProducts: (filters, page = 1, pageSize = 12) =>
    apiFetch<PaginatedResult<Product>>("/products", { query: productFiltersToQuery(filters, page, pageSize) }),

  getProductBySlug: (slug, options) =>
    apiFetchOrNull<Product>(options?.onlyPublic ? `/products/by-slug/${seg(slug)}` : `/admin/products/by-slug/${seg(slug)}`),

  getProductById: (id) => apiFetchOrNull<Product>(`/admin/products/${seg(id)}`),

  async getRelatedProducts(productId, limit = 4) {
    return (await apiFetchOrNull<Product[]>(`/products/${seg(productId)}/related`, { query: { limit } })) ?? [];
  },

  createProduct: (data) => apiFetch<Product>("/admin/products", { method: "POST", body: data }),

  updateProduct(id, data: UpdateProductInput) {
    // JSON.stringify supprime `undefined` : un `compareAtPrice` explicitement vide doit partir en `null` (= effacé).
    const body = "compareAtPrice" in data && data.compareAtPrice === undefined ? { ...data, compareAtPrice: null } : data;
    return apiFetch<Product>(`/admin/products/${seg(id)}`, { method: "PATCH", body });
  },

  setPublished: (id, isPublished) => apiFetch<Product>(`/admin/products/${seg(id)}/publish`, { method: "POST", body: { isPublished } }),

  async archiveProduct(id) {
    await apiFetch<void>(`/admin/products/${seg(id)}/archive`, { method: "POST" });
  },

  async restoreProduct(id) {
    await apiFetch<void>(`/admin/products/${seg(id)}/restore`, { method: "POST" });
  },

  async deleteProduct(id) {
    await apiFetch<void>(`/admin/products/${seg(id)}`, { method: "DELETE" });
  },
};
