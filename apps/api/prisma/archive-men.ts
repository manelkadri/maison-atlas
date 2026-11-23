/**
 * Boutique 100 % femme : ARCHIVE (sans rien supprimer) la catégorie « Homme », ses sous-catégories
 * et les produits destinés aux hommes d'une base existante.
 *
 *   pnpm --filter @fashion/api db:archive-men
 *
 * - Réversible : tout reste visible et restaurable dans l'administration (Catégories / Produits → Archivés).
 * - Idempotent : sans effet si déjà fait.
 * - Les commandes passées restent intactes (elles gardent leurs articles et leurs prix).
 */
import "dotenv/config"; // charge apps/api/.env (DATABASE_URL) quand le script est lancé à la main
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Catégorie « Homme » et tous ses descendants.
  const all = await prisma.category.findMany({ select: { id: true, slug: true, parentId: true, isArchived: true } });
  const roots = all.filter((c) => c.slug === "homme" && c.parentId === null);
  const ids = new Set(roots.map((c) => c.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of all) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }

  const categories = await prisma.category.updateMany({ where: { id: { in: [...ids] }, isArchived: false }, data: { isArchived: true } });

  // Produits pour homme : explicitement marqués « men », ou rangés dans la branche Homme.
  const products = await prisma.product.updateMany({
    where: { isArchived: false, OR: [{ gender: "men" }, { categoryId: { in: [...ids] } }] },
    data: { isArchived: true, isPublished: false },
  });

  console.log(`Catégories archivées : ${categories.count}`);
  console.log(`Produits archivés    : ${products.count}`);
  if (categories.count === 0 && products.count === 0) console.log("Rien à faire : la base ne contient déjà plus de contenu « Homme » actif.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
