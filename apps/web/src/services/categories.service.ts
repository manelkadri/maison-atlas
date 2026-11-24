import type { Category } from "@/types/product.types";
import type { CategoryDeletionImpact, CategoryService } from "./contracts";
import { ServiceError } from "./errors";
import { commit, getDb, nextId } from "./mock/db";

function assertUniqueSlug(slug: string, exceptId?: string) {
  if (getDb().categories.some((c) => c.slug === slug && c.id !== exceptId)) {
    throw new ServiceError("CONFLICT", `Le slug « ${slug} » est déjà utilisé.`);
  }
}

/** La catégorie et tous ses descendants. */
function treeIds(id: string): string[] {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) for (const c of getDb().categories) if (c.parentId === ids[i] && !ids.includes(c.id)) ids.push(c.id);
  return ids;
}

function deletionImpact(id: string): CategoryDeletionImpact {
  const db = getDb();
  const category = db.categories.find((c) => c.id === id);
  if (!category) throw new ServiceError("NOT_FOUND", "Catégorie introuvable.");
  if (category.kind === "collection") throw new ServiceError("CONFLICT", "Les collections ne peuvent pas être supprimées.");
  const ids = treeIds(id);
  const products = db.products.filter((p) => ids.includes(p.categoryId));
  const orderedProducts = products.filter((p) => db.orders.some((o) => o.items.some((it) => it.productId === p.id)));
  return { subcategories: ids.length - 1, products: products.length, orderedProducts: orderedProducts.length };
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

  async getCategoryDeletionImpact(id) {
    return deletionImpact(id);
  },

  async deleteCategory(id) {
    const impact = deletionImpact(id);
    if (impact.orderedProducts > 0) {
      const n = impact.orderedProducts;
      throw new ServiceError(
        "CONFLICT",
        `${n} produit${n > 1 ? "s" : ""} de cette catégorie figure${n > 1 ? "nt" : ""} dans des commandes existantes : archivez la catégorie plutôt que de la supprimer.`,
      );
    }
    const db = getDb();
    const ids = treeIds(id);
    const productIds = new Set(db.products.filter((p) => ids.includes(p.categoryId)).map((p) => p.id));
    db.products = db.products.filter((p) => !productIds.has(p.id));
    db.movements = db.movements.filter((m) => !productIds.has(m.productId));
    db.categories = db.categories.filter((c) => !ids.includes(c.id));
    commit();
  },
};
