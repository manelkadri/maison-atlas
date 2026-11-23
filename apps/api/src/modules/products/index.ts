import { applyProductFilters, paginate } from "@fashion/shared";
import type { Product, ProductFilters } from "@fashion/types";
import { Router } from "express";
import { prisma } from "../../config/db";
import { notFound } from "../../utils/errors";
import { parseBody, parseParams, parseQuery } from "../../utils/validate";
import { toCategory } from "../categories/mappers";
import { productInclude, toProduct } from "./mappers";
import {
  createProductSchema,
  idParams,
  publishSchema,
  relatedQuerySchema,
  searchQuerySchema,
  slugParams,
  updateProductSchema,
} from "./schemas";
import { createProduct, deleteProduct, setArchived, setPublished, updateProduct } from "./service";

/** Publics = publiés ET non archivés. Les brouillons et archivés ne sortent jamais par les routes publiques. */
const PUBLIC = { isPublished: true, isArchived: false } as const;
const NEWEST = [{ createdAt: "desc" }, { id: "asc" }] as const;
const CATALOG_MAX = 500;
const SEARCH_MAX = 2000;

async function loadPublic(max: number): Promise<Product[]> {
  const rows = await prisma.product.findMany({ where: PUBLIC, include: productInclude, orderBy: [...NEWEST], take: max });
  return rows.map((r) => toProduct(r, "public"));
}

/** Module « products » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

/* ---------- Public ---------- */

publicRoutes.get("/", async (req, res) => {
  const q = parseQuery(searchQuerySchema, req);
  const filters: ProductFilters = {
    search: q.search,
    category: q.category,
    collection: q.collection,
    sizes: q.sizes,
    colors: q.colors,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    inStockOnly: q.inStockOnly,
    sort: q.sort,
  };
  const [products, categories] = await Promise.all([loadPublic(SEARCH_MAX), prisma.category.findMany()]);
  const filtered = applyProductFilters(products, filters, categories.map(toCategory));
  res.json(paginate(filtered, q.page ?? 1, q.pageSize ?? 12));
});

publicRoutes.get("/catalog", async (_req, res) => {
  res.json(await loadPublic(CATALOG_MAX));
});

publicRoutes.get("/by-slug/:slug", async (req, res) => {
  const { slug } = parseParams(slugParams, req);
  const row = await prisma.product.findFirst({ where: { slug, ...PUBLIC }, include: productInclude });
  if (!row) throw notFound("Produit introuvable.");
  res.json(toProduct(row, "public"));
});

publicRoutes.get("/:id/related", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const { limit } = parseQuery(relatedQuerySchema, req);
  const baseRow = await prisma.product.findFirst({ where: { id, ...PUBLIC }, include: productInclude });
  if (!baseRow) return void res.json([]);
  const base = toProduct(baseRow, "public");
  const candidates = (await loadPublic(SEARCH_MAX)).filter((p) => p.id !== id);
  const score = (p: Product) =>
    (p.categoryId === base.categoryId ? 3 : 0) + (p.gender === base.gender ? 1 : 0) + p.tags.filter((t) => base.tags.includes(t)).length;
  const related = candidates
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s || b.p.soldCount - a.p.soldCount)
    .slice(0, limit ?? 4)
    .map((x) => x.p);
  res.json(related);
});

/* ---------- Admin ---------- */

adminRoutes.get("/", async (_req, res) => {
  const rows = await prisma.product.findMany({ include: productInclude, orderBy: [...NEWEST] });
  res.json(rows.map((r) => toProduct(r, "admin")));
});

adminRoutes.get("/by-slug/:slug", async (req, res) => {
  const { slug } = parseParams(slugParams, req);
  const row = await prisma.product.findUnique({ where: { slug }, include: productInclude });
  if (!row) throw notFound("Produit introuvable.");
  res.json(toProduct(row, "admin"));
});

adminRoutes.get("/:id", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const row = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!row) throw notFound("Produit introuvable.");
  res.json(toProduct(row, "admin"));
});

adminRoutes.post("/", async (req, res) => {
  res.status(201).json(await createProduct(parseBody(createProductSchema, req)));
});

adminRoutes.patch("/:id", async (req, res) => {
  const { id } = parseParams(idParams, req);
  res.json(await updateProduct(id, parseBody(updateProductSchema, req)));
});

adminRoutes.post("/:id/publish", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const { isPublished } = parseBody(publishSchema, req);
  res.json(await setPublished(id, isPublished));
});

adminRoutes.post("/:id/archive", async (req, res) => {
  await setArchived(parseParams(idParams, req).id, true);
  res.status(204).end();
});

adminRoutes.post("/:id/restore", async (req, res) => {
  await setArchived(parseParams(idParams, req).id, false);
  res.status(204).end();
});

adminRoutes.delete("/:id", async (req, res) => {
  await deleteProduct(parseParams(idParams, req).id);
  res.status(204).end();
});
