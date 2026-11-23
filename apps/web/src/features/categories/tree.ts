import type { Category, Product } from "@/types/product.types";

export type CategoryRow = {
  category: Category;
  /** 0 = racine, 1 = sous-catégorie. */
  depth: number;
  /** Produits directement rattachés. */
  productCount: number;
  /** Produits de la catégorie + de ses sous-catégories. */
  treeProductCount: number;
  childCount: number;
};

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Liste hiérarchique à plat : chaque parent suivi de ses enfants, triés par ordre d'affichage.
 * Les catégories orphelines (parent absent) sont traitées comme des racines.
 * Avec une recherche, on garde les correspondances et leur parent (pour le contexte).
 */
export function buildCategoryRows(
  categories: Category[],
  products: Product[],
  options: { search?: string; includeArchived?: boolean } = {},
): CategoryRow[] {
  const { search = "", includeArchived = true } = options;
  const visible = categories.filter((c) => includeArchived || !c.isArchived);
  const ids = new Set(visible.map((c) => c.id));

  const direct = new Map<string, number>();
  for (const p of products) direct.set(p.categoryId, (direct.get(p.categoryId) ?? 0) + 1);

  const byOrder = (a: Category, b: Category) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "fr");
  const roots = visible.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byOrder);
  const childrenOf = (id: string) => visible.filter((c) => c.parentId === id).sort(byOrder);

  const q = normalize(search.trim());
  const matches = (c: Category) => !q || normalize(`${c.name} ${c.slug}`).includes(q);

  const rows: CategoryRow[] = [];
  for (const root of roots) {
    const kids = childrenOf(root.id);
    const keptKids = kids.filter(matches);
    if (!matches(root) && keptKids.length === 0) continue;
    const treeCount = (direct.get(root.id) ?? 0) + kids.reduce((s, k) => s + (direct.get(k.id) ?? 0), 0);
    rows.push({ category: root, depth: 0, productCount: direct.get(root.id) ?? 0, treeProductCount: treeCount, childCount: kids.length });
    // Si la racine correspond, on montre tous ses enfants ; sinon seulement ceux qui correspondent.
    for (const kid of matches(root) ? kids : keptKids) {
      const n = direct.get(kid.id) ?? 0;
      rows.push({ category: kid, depth: 1, productCount: n, treeProductCount: n, childCount: 0 });
    }
  }
  return rows;
}

/** Libellé "Parent / Enfant" pour les listes déroulantes. */
export function getCategoryPath(categories: Category[], id: string): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parts: string[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 5) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.join(" / ");
}

/** Catégories sélectionnables pour un produit : type "category" (pas les collections), parents avant enfants. */
export function getProductCategoryOptions(categories: Category[], currentId?: string): Array<{ id: string; label: string; archived: boolean }> {
  const usable = categories.filter((c) => c.kind === "category" && (!c.isArchived || c.id === currentId));
  const byOrder = (a: Category, b: Category) => a.displayOrder - b.displayOrder;
  const roots = usable.filter((c) => !c.parentId || !usable.some((p) => p.id === c.parentId)).sort(byOrder);
  const out: Array<{ id: string; label: string; archived: boolean }> = [];
  for (const root of roots) {
    out.push({ id: root.id, label: getCategoryPath(categories, root.id), archived: root.isArchived });
    for (const kid of usable.filter((c) => c.parentId === root.id).sort(byOrder)) {
      out.push({ id: kid.id, label: getCategoryPath(categories, kid.id), archived: kid.isArchived });
    }
  }
  return out;
}
