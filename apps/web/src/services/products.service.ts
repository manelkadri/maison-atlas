import { applyProductFilters, findDuplicateSkus, paginate, slugify } from "@fashion/shared";
import type { CreateProductInput, Product, ProductVariant, UpdateProductInput } from "@/types/product.types";
import { ServiceError } from "./errors";
import type { ProductService } from "./contracts";
import { commit, getDb, nextId } from "./mock/db";
import { pushMovement } from "./mock/movements";

const isPublic = (p: Product) => p.isPublished && !p.isArchived;

function assertUniqueSlug(slug: string, exceptId?: string) {
  if (getDb().products.some((p) => p.slug === slug && p.id !== exceptId)) {
    throw new ServiceError("CONFLICT", `Le slug « ${slug} » est déjà utilisé par un autre produit.`);
  }
}

function assertUniqueSkus(skus: string[], exceptProductId?: string) {
  const dup = findDuplicateSkus(skus);
  if (dup.length) throw new ServiceError("CONFLICT", `SKU en doublon dans le produit : ${dup.join(", ")}.`);
  const taken = new Set(
    getDb()
      .products.filter((p) => p.id !== exceptProductId)
      .flatMap((p) => p.variants.map((v) => v.sku.toUpperCase())),
  );
  const clash = skus.filter((s) => taken.has(s.trim().toUpperCase()));
  if (clash.length) throw new ServiceError("CONFLICT", `SKU déjà utilisé par un autre produit : ${clash.join(", ")}.`);
}

function buildVariants(productId: string, variants: CreateProductInput["variants"]): ProductVariant[] {
  return variants.map((v) => ({ ...v, id: v.id ?? nextId("var"), productId }));
}

export const productService: ProductService = {
  async getProducts(options) {
    const products = getDb().products;
    return structuredClone(options?.onlyPublic ? products.filter(isPublic) : products);
  },

  async searchProducts(filters, page = 1, pageSize = 12) {
    const db = getDb();
    const filtered = applyProductFilters(db.products.filter(isPublic), filters, db.categories);
    return structuredClone(paginate(filtered, page, pageSize));
  },

  async getProductBySlug(slug, options) {
    const p = getDb().products.find((x) => x.slug === slug && (!options?.onlyPublic || isPublic(x)));
    return p ? structuredClone(p) : null;
  },

  async getProductById(id) {
    const p = getDb().products.find((x) => x.id === id);
    return p ? structuredClone(p) : null;
  },

  async getRelatedProducts(productId, limit = 4) {
    const db = getDb();
    const base = db.products.find((p) => p.id === productId);
    if (!base) return [];
    const candidates = db.products.filter((p) => p.id !== productId && isPublic(p));
    const score = (p: Product) =>
      (p.categoryId === base.categoryId ? 3 : 0) + (p.gender === base.gender ? 1 : 0) + p.tags.filter((t) => base.tags.includes(t)).length;
    return structuredClone(
      candidates
        .map((p) => ({ p, s: score(p) }))
        .sort((a, b) => b.s - a.s || b.p.soldCount - a.p.soldCount)
        .slice(0, limit)
        .map((x) => x.p),
    );
  },

  async createProduct(data) {
    const db = getDb();
    const slug = data.slug || slugify(data.name);
    assertUniqueSlug(slug);
    assertUniqueSkus(data.variants.map((v) => v.sku));
    if (data.variants.length === 0) throw new ServiceError("VALIDATION", "Un produit doit avoir au moins une variante.");

    const id = nextId("prod");
    const now = new Date().toISOString();
    const product: Product = {
      ...data,
      id,
      slug,
      variants: buildVariants(id, data.variants),
      soldCount: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    db.products.unshift(product);
    for (const v of product.variants) {
      if (v.stock > 0) pushMovement({ product, variant: v, type: "initial", delta: v.stock, before: 0, reason: "Stock initial" });
    }
    commit();
    return structuredClone(product);
  },

  async updateProduct(id, data: UpdateProductInput) {
    const db = getDb();
    const product = db.products.find((p) => p.id === id);
    if (!product) throw new ServiceError("NOT_FOUND", "Produit introuvable.");

    if (data.slug) assertUniqueSlug(data.slug, id);
    if (data.variants) assertUniqueSkus(data.variants.map((v) => v.sku), id);

    const { variants: incoming, ...rest } = data;
    Object.assign(product, rest, { updatedAt: new Date().toISOString() });

    if (incoming) {
      const next: ProductVariant[] = [];
      for (const v of incoming) {
        const existing = product.variants.find((e) => (v.id && e.id === v.id) || e.sku === v.sku);
        if (existing) {
          const before = existing.stock;
          Object.assign(existing, v, { id: existing.id, productId: id });
          if (existing.stock !== before) {
            pushMovement({
              product, variant: existing, type: "adjustment", delta: existing.stock - before, before,
              reason: "Correction depuis la fiche produit",
            });
          }
          next.push(existing);
        } else {
          const created: ProductVariant = { ...v, id: v.id ?? nextId("var"), productId: id };
          next.push(created);
          if (created.stock > 0) pushMovement({ product, variant: created, type: "initial", delta: created.stock, before: 0, reason: "Stock initial" });
        }
      }
      product.variants = next;
    }
    commit();
    return structuredClone(product);
  },

  async setPublished(id, isPublished) {
    const product = getDb().products.find((p) => p.id === id);
    if (!product) throw new ServiceError("NOT_FOUND", "Produit introuvable.");
    if (product.isArchived && isPublished) throw new ServiceError("VALIDATION", "Restaurez le produit avant de le publier.");
    product.isPublished = isPublished;
    product.updatedAt = new Date().toISOString();
    commit();
    return structuredClone(product);
  },

  async archiveProduct(id) {
    const product = getDb().products.find((p) => p.id === id);
    if (!product) throw new ServiceError("NOT_FOUND", "Produit introuvable.");
    product.isArchived = true;
    product.isPublished = false;
    product.updatedAt = new Date().toISOString();
    commit();
  },

  async restoreProduct(id) {
    const product = getDb().products.find((p) => p.id === id);
    if (!product) throw new ServiceError("NOT_FOUND", "Produit introuvable.");
    product.isArchived = false;
    product.updatedAt = new Date().toISOString();
    commit();
  },

  async deleteProduct(id) {
    const db = getDb();
    const product = db.products.find((p) => p.id === id);
    if (!product) throw new ServiceError("NOT_FOUND", "Produit introuvable.");
    if (db.orders.some((o) => o.items.some((it) => it.productId === id))) {
      throw new ServiceError("CONFLICT", "Ce produit figure dans des commandes existantes : archivez-le plutôt que de le supprimer.");
    }
    db.products = db.products.filter((p) => p.id !== id);
    db.movements = db.movements.filter((m) => m.productId !== id);
    commit();
  },
};
