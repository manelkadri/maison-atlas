import { apiFetch, apiFetchOrNull } from "@/lib/api-client";
import type { Category } from "@/types/product.types";
import type { CategoryService } from "../contracts";

const seg = encodeURIComponent;

export const apiCategoryService: CategoryService = {
  getCategories: (options) =>
    options?.includeArchived
      ? apiFetch<Category[]>("/admin/categories", { query: { includeArchived: true } })
      : apiFetch<Category[]>("/categories"),

  getCategoryBySlug: (slug) => apiFetchOrNull<Category>(`/categories/by-slug/${seg(slug)}`),

  createCategory: (data) => apiFetch<Category>("/admin/categories", { method: "POST", body: data }),

  updateCategory: (id, data) => apiFetch<Category>(`/admin/categories/${seg(id)}`, { method: "PATCH", body: data }),

  async archiveCategory(id) {
    await apiFetch<void>(`/admin/categories/${seg(id)}/archive`, { method: "POST" });
  },

  async restoreCategory(id) {
    await apiFetch<void>(`/admin/categories/${seg(id)}/restore`, { method: "POST" });
  },
};
