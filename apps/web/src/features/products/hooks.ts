"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { productService } from "@/services";
import type { CreateProductInput, PaginatedResult, Product, ProductFilters, UpdateProductInput } from "@/types/product.types";

/** Catalogue complet (admin) ou public. */
export function useProducts(options?: { onlyPublic?: boolean }, initialData?: Product[]) {
  return useQuery({ queryKey: queryKeys.products.list(options), queryFn: () => productService.getProducts(options), initialData, initialDataUpdatedAt: 0 });
}

/** Catalogue de la boutique : filtres + pagination. `initialData` vient du rendu serveur. */
export function useSearchProducts(filters: ProductFilters, page: number, pageSize: number, initialData?: PaginatedResult<Product>) {
  return useQuery({
    queryKey: queryKeys.products.search(filters, page, pageSize),
    queryFn: () => productService.searchProducts(filters, page, pageSize),
    placeholderData: keepPreviousData,
    initialData,
  initialDataUpdatedAt: 0,
  });
}

export function useProductBySlug(slug: string, initialData?: Product | null) {
  return useQuery({
    queryKey: queryKeys.products.bySlug(slug),
    queryFn: () => productService.getProductBySlug(slug, { onlyPublic: true }),
    initialData,
  initialDataUpdatedAt: 0,
  });
}

export function useAdminProductBySlug(slug: string) {
  return useQuery({ queryKey: [...queryKeys.products.bySlug(slug), "admin"], queryFn: () => productService.getProductBySlug(slug) });
}

export function useProductById(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.byId(id ?? ""),
    queryFn: () => productService.getProductById(id!),
    enabled: !!id,
  });
}

export function useRelatedProducts(productId: string, limit = 4, initialData?: Product[]) {
  return useQuery({
    queryKey: queryKeys.products.related(productId, limit),
    queryFn: () => productService.getRelatedProducts(productId, limit),
    initialData,
  initialDataUpdatedAt: 0,
  });
}

export function useCreateProduct() {
  return useMutation({ mutationFn: (data: CreateProductInput) => productService.createProduct(data) });
}

export function useUpdateProduct() {
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateProductInput }) => productService.updateProduct(id, data) });
}

export function useSetPublished() {
  return useMutation({ mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => productService.setPublished(id, isPublished) });
}

export function useArchiveProduct() {
  return useMutation({ mutationFn: (id: string) => productService.archiveProduct(id) });
}

export function useRestoreProduct() {
  return useMutation({ mutationFn: (id: string) => productService.restoreProduct(id) });
}

export function useDeleteProduct() {
  return useMutation({ mutationFn: (id: string) => productService.deleteProduct(id) });
}
