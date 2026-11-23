import type { Category } from "@/types/product.types";
import type { CategoryService } from "./contracts";
import { ServiceError } from "./errors";
import { commit, getDb, nextId } from "./mock/db";

function assertUniqueSlug(slug: string, exceptId?: string) {
  if (getDb().categories.some((c) => c.slug === slug && c.id !== exceptId)) {
    throw new ServiceError("CONFLICT", `Le slug « ${slug} » est déjà utilisé.`);
  }
}

export const categoryService: CategoryService = {
  async getCategories(options) {
    const list = getDb().categories.filter((c) => options?.includeArchived || !c.isArchived);
    return structuredClone([...list].sort((a, b) => a.displayOrder - b.displayOrder));
  },

  async getCategoryBySlug(slug) {
    const c = getDb().categories.find((x) => x.slug === slug && !x.isArchived);
    return c ? structuredClone(c) : null;
  },

  async createCategory(data) {
    assertUniqueSlug(data.slug);
    const category: Category = { ...data, id: nextId("cat"), isArchived: false, createdAt: new Date().toISOString() };
    getDb().categories.push(category);
    commit();
    return structuredClone(category);
  },

  async updateCategory(id, data) {
    const category = getDb().categories.find((c) => c.id === id);
    if (!category) throw new ServiceError("NOT_FOUND", "Catégorie introuvable.");
    if (data.slug) assertUniqueSlug(data.slug, id);
    if (data.parentId === id) throw new ServiceError("VALIDATION", "Une catégorie ne peut pas être son propre parent.");
    Object.assign(category, data);
    commit();
    return structuredClone(category);
  },

  async archiveCategory(id) {
    const db = getDb();
    const category = db.categories.find((c) => c.id === id);
    if (!category) throw new ServiceError("NOT_FOUND", "Catégorie introuvable.");
    category.isArchived = true;
    // Les sous-catégories suivent leur parent.
    for (const c of db.categories) if (c.parentId === id) c.isArchived = true;
    commit();
  },

  async restoreCategory(id) {
    const category = getDb().categories.find((c) => c.id === id);
    if (!category) throw new ServiceError("NOT_FOUND", "Catégorie introuvable.");
    category.isArchived = false;
    commit();
  },
};
