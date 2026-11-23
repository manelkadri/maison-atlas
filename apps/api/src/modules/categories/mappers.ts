import type { Category as CategoryRow } from "@prisma/client";
import type { Category } from "@fashion/types";

/** Ligne Prisma → `Category` de @fashion/types (dates en ISO 8601). */
export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    kind: row.kind,
    parentId: row.parentId,
    displayOrder: row.displayOrder,
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
  };
}
