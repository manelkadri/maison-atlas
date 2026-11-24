import { categoryFormSchema } from "@fashion/validators";
import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { conflict, notFound, validation } from "../../utils/errors";
import { parseBody, parseParams, parseQuery } from "../../utils/validate";
import { toCategory } from "./mappers";

type Tx = Prisma.TransactionClient;

const idParams = z.object({ id: z.string().min(1) });
const slugParams = z.object({ slug: z.string().min(1).max(200) });

/** Création : le formulaire d'administration + `kind` (« category » par défaut). */
const createSchema = categoryFormSchema.extend({ kind: z.enum(["category", "collection"]).default("category") });
const updateSchema = categoryFormSchema.partial().extend({
  kind: z.enum(["category", "collection"]).optional(),
  isArchived: z.boolean().optional(),
});

const listQuery = z.object({ includeArchived: z.enum(["true", "false", "1", "0"]).optional() });

const ORDER = [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }, { id: "asc" as const }];

const COLLECTION_LOCKED = "Les collections ne peuvent pas être archivées.";

async function assertUniqueSlug(tx: Tx, slug: string, exceptId?: string) {
  const clash = await tx.category.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw conflict(`Le slug « ${slug} » est déjà utilisé.`);
}

async function assertParentExists(tx: Tx, parentId: string | null | undefined) {
  if (!parentId) return;
  const parent = await tx.category.findUnique({ where: { id: parentId }, select: { id: true } });
  if (!parent) throw validation("La catégorie parente est introuvable.");
}

/** Refuse qu'une catégorie devienne son propre ancêtre (boucle dans l'arbre). */
async function assertNoCycle(tx: Tx, id: string, parentId: string | null | undefined) {
  if (!parentId) return;
  if (parentId === id) throw validation("Une catégorie ne peut pas être son propre parent.");
  const seen = new Set<string>([id]);
  let cursor: string | null = parentId;
  while (cursor) {
    if (seen.has(cursor)) throw validation("Ce parent créerait une boucle dans l'arborescence des catégories.");
    seen.add(cursor);
    const row: { parentId: string | null } | null = await tx.category.findUnique({ where: { id: cursor }, select: { parentId: true } });
    cursor = row?.parentId ?? null;
  }
}

/** Archive la catégorie et tous ses descendants (les collections, verrouillées, ne sont jamais archivées). */
async function archiveTree(tx: Tx, id: string) {
  const ids = [id];
  let frontier = [id];
  while (frontier.length) {
    const children = await tx.category.findMany({ where: { parentId: { in: frontier }, kind: "category" }, select: { id: true } });
    frontier = children.map((c) => c.id).filter((c) => !ids.includes(c));
    ids.push(...frontier);
  }
  await tx.category.updateMany({ where: { id: { in: ids } }, data: { isArchived: true } });
}

const COLLECTION_DELETE_LOCKED = "Les collections ne peuvent pas être supprimées.";

/** La catégorie et tous ses descendants (archivés compris). `locked` : l'arbre contient une collection système. */
async function loadTree(tx: Tx, id: string): Promise<{ ids: string[]; locked: boolean }> {
  const root = await tx.category.findUnique({ where: { id }, select: { id: true, kind: true } });
  if (!root) throw notFound("Catégorie introuvable.");
  const ids = [id];
  let locked = root.kind === "collection";
  let frontier = [id];
  while (frontier.length) {
    const children = await tx.category.findMany({ where: { parentId: { in: frontier } }, select: { id: true, kind: true } });
    frontier = children.map((c) => c.id).filter((c) => !ids.includes(c));
    if (children.some((c) => c.kind === "collection")) locked = true;
    ids.push(...frontier);
  }
  return { ids, locked };
}

/** Ce que supprimerait la suppression d'une catégorie (affiché dans la fenêtre de confirmation). */
async function deletionImpact(tx: Tx, ids: string[]) {
  const [products, orderedProducts] = await Promise.all([
    tx.product.count({ where: { categoryId: { in: ids } } }),
    tx.product.count({ where: { categoryId: { in: ids }, orderItems: { some: {} } } }),
  ]);
  return { subcategories: ids.length - 1, products, orderedProducts };
}

/** Module « categories » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

publicRoutes.get("/", async (_req, res) => {
  const rows = await prisma.category.findMany({ where: { isArchived: false }, orderBy: ORDER });
  res.json(rows.map(toCategory));
});

publicRoutes.get("/by-slug/:slug", async (req, res) => {
  const { slug } = parseParams(slugParams, req);
  const row = await prisma.category.findFirst({ where: { slug, isArchived: false } });
  if (!row) throw notFound("Catégorie introuvable.");
  res.json(toCategory(row));
});

adminRoutes.get("/", async (req, res) => {
  const { includeArchived } = parseQuery(listQuery, req);
  const withArchived = includeArchived === "true" || includeArchived === "1";
  const rows = await prisma.category.findMany({ where: withArchived ? {} : { isArchived: false }, orderBy: ORDER });
  res.json(rows.map(toCategory));
});

adminRoutes.post("/", async (req, res) => {
  const data = parseBody(createSchema, req);
  const row = await prisma.$transaction(async (tx) => {
    await assertUniqueSlug(tx, data.slug);
    await assertParentExists(tx, data.parentId);
    return tx.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        imageUrl: data.imageUrl,
        kind: data.kind,
        parentId: data.parentId,
        displayOrder: data.displayOrder,
      },
    });
  });
  res.status(201).json(toCategory(row));
});

adminRoutes.patch("/:id", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const { isArchived, ...fields } = parseBody(updateSchema, req);
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.category.findUnique({ where: { id } });
    if (!current) throw notFound("Catégorie introuvable.");
    if (fields.slug !== undefined) await assertUniqueSlug(tx, fields.slug, id);
    if (fields.parentId !== undefined) {
      await assertNoCycle(tx, id, fields.parentId);
      await assertParentExists(tx, fields.parentId);
    }
    if (isArchived === true && (fields.kind ?? current.kind) === "collection") throw conflict(COLLECTION_LOCKED);
    await tx.category.update({ where: { id }, data: fields });
    if (isArchived === true && !current.isArchived) await archiveTree(tx, id);
    else if (isArchived === false && current.isArchived) await tx.category.update({ where: { id }, data: { isArchived: false } });
    return tx.category.findUniqueOrThrow({ where: { id } });
  });
  res.json(toCategory(row));
});

adminRoutes.post("/:id/archive", async (req, res) => {
  const { id } = parseParams(idParams, req);
  await prisma.$transaction(async (tx) => {
    const current = await tx.category.findUnique({ where: { id }, select: { kind: true } });
    if (!current) throw notFound("Catégorie introuvable.");
    if (current.kind === "collection") throw conflict(COLLECTION_LOCKED);
    await archiveTree(tx, id);
  });
  res.status(204).end();
});

adminRoutes.post("/:id/restore", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const { count } = await prisma.category.updateMany({ where: { id }, data: { isArchived: false } });
  if (count === 0) throw notFound("Catégorie introuvable.");
  res.status(204).end();
});

adminRoutes.get("/:id/deletion-impact", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const impact = await prisma.$transaction(async (tx) => {
    const { ids, locked } = await loadTree(tx, id);
    if (locked) throw conflict(COLLECTION_DELETE_LOCKED);
    return deletionImpact(tx, ids);
  });
  res.json(impact);
});

/**
 * Suppression DÉFINITIVE : la catégorie, ses sous-catégories et leurs produits (variantes, images et mouvements de stock
 * partent en cascade). Tout ou rien : refusée si un produit figure dans une commande (l'historique des commandes doit rester
 * intact) ; il faut alors archiver. Les images Cloudinary ne sont pas supprimées.
 */
adminRoutes.delete("/:id", async (req, res) => {
  const { id } = parseParams(idParams, req);
  try {
    await prisma.$transaction(async (tx) => {
      const { ids, locked } = await loadTree(tx, id);
      if (locked) throw conflict(COLLECTION_DELETE_LOCKED);
      const { orderedProducts } = await deletionImpact(tx, ids);
      if (orderedProducts > 0) {
        throw conflict(
          `${orderedProducts} produit${orderedProducts > 1 ? "s" : ""} de cette catégorie figure${orderedProducts > 1 ? "nt" : ""} dans des commandes existantes : archivez la catégorie plutôt que de la supprimer.`,
        );
      }
      await tx.product.deleteMany({ where: { categoryId: { in: ids } } });
      // Les liens parent → enfant n'ont pas de suppression en cascade : on les détache avant de tout effacer.
      await tx.category.updateMany({ where: { id: { in: ids } }, data: { parentId: null } });
      await tx.category.deleteMany({ where: { id: { in: ids } } });
    });
  } catch (error) {
    // Une commande a été passée entre la vérification et la suppression (clé étrangère) : rien n'est supprimé.
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2003") {
      throw conflict("Une commande vient d'être passée sur l'un de ces produits : actualisez la page, puis archivez la catégorie.");
    }
    throw error;
  }
  res.status(204).end();
});
