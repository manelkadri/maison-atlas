"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { categoryService } from "@/services";
import type { Category, CreateCategoryInput, UpdateCategoryInput } from "@/types/product.types";

export function useCategories(includeArchived = false, initialData?: Category[]) {
  return useQuery({
    queryKey: queryKeys.categories.list(includeArchived),
    queryFn: () => categoryService.getCategories({ includeArchived }),
    initialData,
  initialDataUpdatedAt: 0,
  });
}

export function useCreateCategory() {
  return useMutation({ mutationFn: (data: CreateCategoryInput) => categoryService.createCategory(data) });
}

export function useUpdateCategory() {
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) => categoryService.updateCategory(id, data) });
}

export function useArchiveCategory() {
  return useMutation({ mutationFn: (id: string) => categoryService.archiveCategory(id) });
}

export function useRestoreCategory() {
  return useMutation({ mutationFn: (id: string) => categoryService.restoreCategory(id) });
}

/** Aperçu de la suppression définitive (chargé seulement quand `id` est renseigné, c.-à-d. fenêtre de confirmation ouverte). */
export function useCategoryDeletionImpact(id: string | null) {
  return useQuery({
    queryKey: queryKeys.categories.deletionImpact(id ?? ""),
    queryFn: () => categoryService.getCategoryDeletionImpact(id!),
    enabled: id !== null,
    gcTime: 0,
  });
}

export function useDeleteCategory() {
  return useMutation({ mutationFn: (id: string) => categoryService.deleteCategory(id) });
}
