import type { Prisma, ProductVariant } from "@prisma/client";
import { findDuplicateSkus, slugify } from "@fashion/shared";
import { prisma } from "../../config/db";
import { conflict, notFound, validation } from "../../utils/errors";
import { productInclude, toProduct } from "./mappers";
import type { CreateProductBody, UpdateProductBody, VariantInput } from "./schemas";

type Tx = Prisma.TransactionClient;

/** Une écriture produit + variantes + images + mouvements de stock tient dans UNE transaction. */
const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

const INITIAL_REASON = "Stock initial";
const ADJUSTMENT_REASON = "Correction depuis la fiche produit";

/* ---------- Règles d'unicité (identiques à products.service.ts) ---------- */

async function assertUniqueSlug(tx: Tx, slug: string, exceptId?: string) {
  const clash = await tx.product.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw conflict(`Le slug « ${slug} » est déjà utilisé par un autre produit.`);
}

async function assertUniqueReference(tx: Tx, reference: string, exceptId?: string) {
  const clash = await tx.product.findUnique({ where: { reference }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw conflict(`La référence « ${reference} » est déjà utilisée par un autre produit.`);
}

/** SKU uniques dans le produit ET sur tout le catalogue, sans tenir compte de la casse. */
async function assertUniqueSkus(tx: Tx, skus: string[], exceptProductId?: string) {
  const dup = findDuplicateSkus(skus);
  if (dup.length) throw conflict(`SKU en doublon dans le produit : ${dup.join(", ")}.`);
  if (skus.length === 0) return;
  const taken = await tx.productVariant.findMany({
    where: {
      OR: skus.map((sku) => ({ sku: { equals: sku.trim(), mode: "insensitive" as const } })),
      ...(exceptProductId ? { productId: { not: exceptProductId } } : {}),
    },
    select: { sku: true },
  });
  if (taken.length) {
    const takenKeys = new Set(taken.map((t) => t.sku.toUpperCase()));
    const clash = skus.map((s) => s.trim()).filter((s) => takenKeys.has(s.toUpperCase()));
    throw conflict(`SKU déjà utilisé par un autre produit : ${clash.join(", ")}.`);
  }
}

function assertUniqueVariantCombos(variants: VariantInput[]) {
  const seen = new Set<string>();
  for (const v of variants) {
    const key = `${v.color.toLowerCase()}|${v.size.toLowerCase()}`;
    if (seen.has(key)) throw validation(`Variante en double : ${v.color} / ${v.size}.`);
    seen.add(key);
  }
}

async function assertCategoryExists(tx: Tx, categoryId: string) {
  const category = await tx.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) throw validation("La catégorie choisie est introuvable.");
}

const imageRows = (productId: string, images: NonNullable<CreateProductBody["images"]>) =>
  images.map((img) => ({ productId, url: img.url, alt: img.alt, color: img.color ?? null, position: img.position }));

const loadAdmin = async (tx: Tx, id: string) => toProduct(await tx.product.findUniqueOrThrow({ where: { id }, include: productInclude }), "admin");

/* ---------- Création ---------- */

export async function createProduct(data: CreateProductBody) {
  const slug = data.slug || slugify(data.name);
  if (!slug) throw validation("Impossible de déduire un slug à partir du nom du produit.");

  return prisma.$transaction(async (tx) => {
    await assertUniqueSlug(tx, slug);
    await assertUniqueReference(tx, data.reference);
    await assertUniqueSkus(tx, data.variants.map((v) => v.sku));
    assertUniqueVariantCombos(data.variants);
    await assertCategoryExists(tx, data.categoryId);

    const created = await tx.product.create({
      data: {
        reference: data.reference,
        name: data.name,
        slug,
        description: data.description,
        categoryId: data.categoryId,
        gender: data.gender,
        tags: data.tags,
        price: data.price,
        costPrice: data.costPrice,
        compareAtPrice: data.compareAtPrice ?? null,
        isFeatured: data.isFeatured,
        isPublished: data.isPublished,
        images: { create: data.images.map((img) => ({ url: img.url, alt: img.alt, color: img.color ?? null, position: img.position })) },
        variants: {
          create: data.variants.map((v) => ({
            sku: v.sku,
            color: v.color,
            colorCode: v.colorCode,
            size: v.size,
            price: v.price,
            stock: v.stock,
            alertThreshold: v.alertThreshold,
          })),
        },
      },
      include: { variants: true },
    });

    const initial = created.variants.filter((v) => v.stock > 0);
    if (initial.length) {
      await tx.stockMovement.createMany({
        data: initial.map((v) => ({
          variantId: v.id,
          type: "initial" as const,
          quantityDelta: v.stock,
          quantityBefore: 0,
          quantityAfter: v.stock,
          reason: INITIAL_REASON,
        })),
      });
    }
    return loadAdmin(tx, created.id);
  }, TX_OPTIONS);
}

/* ---------- Modification ---------- */

type VariantRow = ProductVariant;

/** Appariement « par id puis par SKU » des variantes reçues avec celles de la base (chaque variante existante au plus une fois). */
function pairVariants(incoming: VariantInput[], current: VariantRow[]) {
  const used = new Set<string>();
  const matches: Array<VariantRow | undefined> = incoming.map(() => undefined);
  const byId = new Map(current.map((v) => [v.id, v]));

  incoming.forEach((v, i) => {
    const hit = v.id ? byId.get(v.id) : undefined;
    if (hit && !used.has(hit.id)) {
      used.add(hit.id);
      matches[i] = hit;
    }
  });
  incoming.forEach((v, i) => {
    if (matches[i]) return;
    const hit = current.find((e) => !used.has(e.id) && e.sku.toUpperCase() === v.sku.toUpperCase());
    if (hit) {
      used.add(hit.id);
      matches[i] = hit;
    }
  });
  return { matches, removed: current.filter((v) => !used.has(v.id)) };
}

export async function updateProduct(id: string, data: UpdateProductBody) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id }, select: { id: true, slug: true, reference: true, isArchived: true } });
    if (!existing) throw notFound("Produit introuvable.");

    if (data.slug && data.slug !== existing.slug) await assertUniqueSlug(tx, data.slug, id);
    if (data.reference !== undefined && data.reference !== existing.reference) await assertUniqueReference(tx, data.reference, id);
    if (data.categoryId !== undefined) await assertCategoryExists(tx, data.categoryId);
    if (data.isPublished === true && existing.isArchived) throw validation("Restaurez le produit avant de le publier.");

    const { variants: incoming, images, compareAtPrice, slug, ...scalars } = data;
    const update: Prisma.ProductUncheckedUpdateInput = { ...scalars, updatedAt: new Date() };
    if (slug) update.slug = slug;
    // Clé absente = inchangé ; `null` = prix barré effacé ; nombre = nouveau prix barré.
    if (compareAtPrice !== undefined) update.compareAtPrice = compareAtPrice;
    await tx.product.update({ where: { id }, data: update });

    if (images !== undefined) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (images.length) await tx.productImage.createMany({ data: imageRows(id, images) });
    }

    if (incoming !== undefined) {
      // Verrou de ligne : une vente concurrente ne peut pas fausser le « avant » des mouvements d'ajustement.
      await tx.$queryRaw`SELECT "id" FROM "ProductVariant" WHERE "productId" = ${id} FOR UPDATE`;
      await assertUniqueSkus(tx, incoming.map((v) => v.sku), id);
      assertUniqueVariantCombos(incoming);

      const current = await tx.productVariant.findMany({ where: { productId: id } });
      const { matches, removed } = pairVariants(incoming, current);

      if (removed.length) {
        const ordered = await tx.orderItem.count({ where: { variantId: { in: removed.map((v) => v.id) } } });
        if (ordered > 0) {
          throw conflict("Une variante retirée figure dans des commandes existantes : conservez-la (mettez son stock à 0) plutôt que de la supprimer.");
        }
        await tx.productVariant.deleteMany({ where: { id: { in: removed.map((v) => v.id) } } });
      }

      const movements: Prisma.StockMovementCreateManyInput[] = [];
      for (const [i, v] of incoming.entries()) {
        const match = matches[i];
        const fields = { sku: v.sku, color: v.color, colorCode: v.colorCode, size: v.size, price: v.price, stock: v.stock, alertThreshold: v.alertThreshold };
        if (match) {
          await tx.productVariant.update({ where: { id: match.id }, data: fields });
          if (match.stock !== v.stock) {
            movements.push({
              variantId: match.id,
              type: "adjustment",
              quantityDelta: v.stock - match.stock,
              quantityBefore: match.stock,
              quantityAfter: v.stock,
              reason: ADJUSTMENT_REASON,
            });
          }
        } else {
          const created = await tx.productVariant.create({ data: { ...fields, productId: id } });
          if (created.stock > 0) {
            movements.push({ variantId: created.id, type: "initial", quantityDelta: created.stock, quantityBefore: 0, quantityAfter: created.stock, reason: INITIAL_REASON });
          }
        }
      }
      if (movements.length) await tx.stockMovement.createMany({ data: movements });
    }

    return loadAdmin(tx, id);
  }, TX_OPTIONS);
}

/* ---------- Publication, archivage, suppression ---------- */

export async function setPublished(id: string, isPublished: boolean) {
  const product = await prisma.product.findUnique({ where: { id }, select: { isArchived: true } });
  if (!product) throw notFound("Produit introuvable.");
  if (product.isArchived && isPublished) throw validation("Restaurez le produit avant de le publier.");
  const row = await prisma.product.update({ where: { id }, data: { isPublished, updatedAt: new Date() }, include: productInclude });
  return toProduct(row, "admin");
}

export async function setArchived(id: string, isArchived: boolean) {
  const { count } = await prisma.product.updateMany({
    where: { id },
    // Un produit archivé n'est plus jamais publié ; la restauration le laisse en brouillon.
    data: isArchived ? { isArchived: true, isPublished: false, updatedAt: new Date() } : { isArchived: false, updatedAt: new Date() },
  });
  if (count === 0) throw notFound("Produit introuvable.");
}

export async function deleteProduct(id: string) {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw notFound("Produit introuvable.");
    const ordered = await tx.orderItem.count({ where: { productId: id } });
    if (ordered > 0) throw conflict("Ce produit figure dans des commandes existantes : archivez-le plutôt que de le supprimer.");
    // Variantes, images et mouvements de stock partent en cascade (clés étrangères).
    await tx.product.delete({ where: { id } });
  });
}
