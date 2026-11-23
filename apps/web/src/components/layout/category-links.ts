import type { Category } from "@/types/product.types";

/** Collections dynamiques : leur slug correspond à un filtre `collection` de la boutique. */
const COLLECTION_SLUGS: Record<string, "new" | "sale"> = {
  nouveautes: "new",
  promotions: "sale",
  soldes: "sale",
};

/** URL boutique d'une catégorie (catégorie classique ou collection dynamique). */
export function categoryHref(category: Pick<Category, "slug" | "kind">): string {
  if (category.kind === "collection") {
    const collection = COLLECTION_SLUGS[category.slug];
    if (collection) return `/shop?collection=${collection}`;
  }
  return `/shop?category=${encodeURIComponent(category.slug)}`;
}

/** Catégories racines non archivées, triées par ordre d'affichage. */
export function getRootCategories(categories: Category[]): Category[] {
  return categories.filter((c) => c.parentId === null && !c.isArchived).sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Sous-catégories non archivées d'une catégorie, triées par ordre d'affichage. */
export function getChildCategories(categories: Category[], parentId: string): Category[] {
  return categories.filter((c) => c.parentId === parentId && !c.isArchived).sort((a, b) => a.displayOrder - b.displayOrder);
}
