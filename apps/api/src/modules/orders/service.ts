import {
  ORDER_STATUS_LABELS,
  STOCK_RELEASING_STATUSES,
  canTransition,
  computeOrderTotals,
  getPickupPointsForWilaya,
  getShippingFee,
  getWilaya,
  normalizePhone,
  validatePromotion,
} from "@fashion/shared";
import type { Order, OrderStatus, PaymentStatus, StoreSettings } from "@fashion/types";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/db";
import { invalidTransition, notFound, outOfStock, validation } from "../../utils/errors";
import { DEFAULT_SETTINGS } from "../../utils/default-settings";
import { nextOrderSequence, orderNumberFor } from "../../utils/order-number";
import { toPromotion } from "../promotions/mappers";
import { orderInclude, toOrder } from "./mappers";
import type { ParsedCreateOrder, ParsedOrderFilters } from "./schemas";

type Tx = Prisma.TransactionClient;

/** Les transactions de commande peuvent attendre le verrou d'une variante très demandée. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

const byId = <T>(a: [string, T], b: [string, T]) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/* ------------------------------------------------------------------ paramètres de livraison */

const zoneFees = z.object({ home: z.number().int().min(0), pickupPoint: z.number().int().min(0) });
const shippingFeesSchema = z.object({ "1": zoneFees, "2": zoneFees, "3": zoneFees });

/** Frais de livraison et seuil de gratuité : paramètres en base, sinon valeurs par défaut de la boutique. */
async function loadShippingSettings(tx: Tx): Promise<Pick<StoreSettings, "shippingFees" | "freeShippingThreshold">> {
  const row = await tx.storeSettings.findUnique({ where: { id: 1 }, select: { shippingFees: true, freeShippingThreshold: true } });
  if (!row) return DEFAULT_SETTINGS;
  const fees = shippingFeesSchema.safeParse(row.shippingFees);
  return { shippingFees: fees.success ? fees.data : DEFAULT_SETTINGS.shippingFees, freeShippingThreshold: row.freeShippingThreshold };
}

/* ------------------------------------------------------------------ création */

/** Message d'erreur identique à celui du mock pour une variante sans assez de stock. */
function stockMessage(name: string, color: string, size: string, stock: number): string {
  return stock === 0 ? `« ${name} » (${color}, ${size}) est en rupture de stock.` : `« ${name} » (${color}, ${size}) : il ne reste que ${stock} pièce(s).`;
}

/**
 * Décrémentation ATOMIQUE et conditionnelle du stock : une seule instruction SQL, qui n'agit que si le produit
 * est publié et non archivé ET que le stock suffit. Retourne le stock après décrémentation, ou `null`.
 * (Le verrou de ligne pris par l'UPDATE sérialise les commandes concurrentes ; sous Read Committed, la condition
 * est ré-évaluée sur la version la plus récente de la ligne.)
 */
async function reserveStock(tx: Tx, variantId: string, quantity: number): Promise<number | null> {
  const rows = await tx.$queryRaw<Array<{ stock: number }>>`
    UPDATE "ProductVariant" AS v
       SET "stock" = v."stock" - ${quantity}::int
      FROM "Product" AS p
     WHERE v."id" = ${variantId}
       AND p."id" = v."productId"
       AND p."isPublished" = true
       AND p."isArchived" = false
       AND v."stock" >= ${quantity}::int
    RETURNING v."stock"::int AS "stock"`;
  return rows[0]?.stock ?? null;
}

/** Explique pourquoi la réservation a échoué : article indisponible (404) ou stock insuffisant (409). */
async function reservationError(tx: Tx, variantId: string) {
  const v = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { stock: true, color: true, size: true, product: { select: { name: true, isPublished: true, isArchived: true } } },
  });
  if (!v || !v.product.isPublished || v.product.isArchived) return notFound("Un article de votre panier n'est plus disponible.");
  return outOfStock(stockMessage(v.product.name, v.color, v.size, v.stock));
}

export async function createOrder(input: ParsedCreateOrder): Promise<Order> {
  // 1. Cohérence wilaya / mode de livraison (les noms viennent de nos tables, jamais du client).
  const wilaya = getWilaya(input.shippingAddress.wilayaCode);
  if (!wilaya) throw validation("Wilaya inconnue.");
  const pickup =
    input.shippingAddress.deliveryMethod === "pickup_point"
      ? getPickupPointsForWilaya(wilaya.code).find((p) => p.id === input.shippingAddress.pickupPointId)
      : undefined;
  if (input.shippingAddress.deliveryMethod === "pickup_point" && !pickup) {
    throw validation("Ce bureau de livraison n'existe pas dans la wilaya choisie.");
  }

  // Quantités fusionnées par variante (ordre de la demande conservé pour les lignes de la commande).
  const requested = new Map<string, number>();
  for (const it of input.items) requested.set(it.variantId, (requested.get(it.variantId) ?? 0) + it.quantity);

  return prisma.$transaction(async (tx) => {
    // 2. Réservation atomique du stock, par variante, dans un ordre déterministe (pas d'interblocage entre commandes).
    const stockAfter = new Map<string, number>();
    for (const [variantId, quantity] of [...requested].sort(byId)) {
      const after = await reserveStock(tx, variantId, quantity);
      if (after === null) throw await reservationError(tx, variantId); // l'exception annule TOUTE la transaction
      stockAfter.set(variantId, after);
    }

    // 3. Prix et coût relus en base (les variantes sont verrouillées jusqu'à la fin de la transaction).
    const variants = await tx.productVariant.findMany({
      where: { id: { in: [...requested.keys()] } },
      include: { product: { include: { images: { orderBy: { position: "asc" } } } } },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const lines = [...requested].map(([variantId, quantity]) => {
      const variant = variantById.get(variantId);
      if (!variant) throw notFound("Un article de votre panier n'est plus disponible.");
      const { product } = variant;
      const image = product.images.find((im) => im.color === variant.color) ?? product.images[0];
      return {
        product,
        variant,
        quantity,
        data: {
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          productSlug: product.slug,
          colorCode: variant.colorCode,
          imageUrl: image?.url ?? "",
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
          unitPrice: variant.price, // prix figé à l'achat
          unitCost: product.costPrice,
          quantity,
          lineTotal: variant.price * quantity,
        },
      };
    });

    // 4. Remise (usage incrémenté dans la même transaction), livraison, total.
    const subtotal = lines.reduce((s, l) => s + l.data.lineTotal, 0);
    let discount = 0;
    let promoCode: string | null = null;
    if (input.promoCode) {
      const row = await tx.promotion.findFirst({ where: { code: { equals: input.promoCode, mode: "insensitive" } } });
      const check = validatePromotion(row ? toPromotion(row) : undefined, subtotal);
      if (!check.valid) throw validation(check.reason);
      discount = check.discount;
      promoCode = check.promotion.code;
      await tx.promotion.update({ where: { id: check.promotion.id }, data: { usageCount: { increment: 1 } } });
    }
    const settings = await loadShippingSettings(tx);
    const shippingFee = getShippingFee(settings, wilaya.code, input.shippingAddress.deliveryMethod, subtotal);
    const totals = computeOrderTotals({ subtotal, discount, shippingFee });

    // 5. Client : retrouvé par téléphone normalisé, sinon créé en invité (INSERT … ON CONFLICT DO NOTHING : sûr en concurrence).
    const phoneKey = normalizePhone(input.customer.phone);
    await tx.customer.createMany({
      data: [
        {
          firstName: input.customer.firstName,
          lastName: input.customer.lastName,
          phone: input.customer.phone,
          phoneKey,
          email: input.customer.email ?? null,
          wilayaCode: wilaya.code,
          commune: input.shippingAddress.commune,
          address: input.shippingAddress.address,
          isGuest: true,
        },
      ],
      skipDuplicates: true,
    });
    const customer = await tx.customer.findUniqueOrThrow({ where: { phoneKey }, select: { id: true } });

    // 6. Commande, historique initial, mouvements de vente, compteur de ventes.
    const now = new Date();
    const sequence = await nextOrderSequence(tx);
    const orderNumber = orderNumberFor(sequence, now);
    const created = await tx.order.create({
      data: {
        sequence,
        orderNumber,
        customerId: customer.id,
        customerFirstName: input.customer.firstName,
        customerLastName: input.customer.lastName,
        customerPhone: input.customer.phone,
        customerEmail: input.customer.email ?? null,
        wilayaCode: wilaya.code,
        wilayaName: wilaya.name,
        commune: input.shippingAddress.commune,
        address: input.shippingAddress.address,
        deliveryMethod: input.shippingAddress.deliveryMethod,
        pickupPointId: pickup?.id ?? null,
        pickupPointName: pickup?.name ?? null,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        promoCode,
        shippingFee: totals.shippingFee,
        total: totals.total,
        paymentMethod: "cash_on_delivery",
        paymentStatus: "pending", // COD : rien n'est encaissé à la commande
        status: "pending",
        customerNote: input.customerNote ?? null,
        createdAt: now,
        updatedAt: now,
        items: { create: lines.map((l) => l.data) },
        history: { create: [{ status: "pending", createdAt: now }] },
      },
      include: orderInclude,
    });

    await tx.stockMovement.createMany({
      data: lines.map((l) => {
        const after = stockAfter.get(l.variant.id) ?? 0;
        return {
          variantId: l.variant.id,
          type: "sale" as const,
          quantityDelta: -l.quantity,
          quantityBefore: after + l.quantity,
          quantityAfter: after,
          reason: "Commande client",
          reference: orderNumber,
          createdAt: now,
        };
      }),
    });

    const soldByProduct = new Map<string, number>();
    for (const l of lines) soldByProduct.set(l.product.id, (soldByProduct.get(l.product.id) ?? 0) + l.quantity);
    for (const [productId, qty] of [...soldByProduct].sort(byId)) {
      await tx.product.update({ where: { id: productId }, data: { soldCount: { increment: qty } } });
    }

    return toOrder(created);
  }, TX_OPTIONS);
}

/* ------------------------------------------------------------------ suivi public */

const TRACK_NOT_FOUND = "Aucune commande ne correspond à ces informations.";

/** Même 404 (même message) que le numéro soit inconnu ou que le téléphone ne corresponde pas. */
export async function trackOrder(number: string, phone: string): Promise<Order> {
  const key = normalizePhone(phone);
  const row = key ? await prisma.order.findUnique({ where: { orderNumber: number.trim().toUpperCase() }, include: orderInclude }) : null;
  if (!row || normalizePhone(row.customerPhone) !== key) throw notFound(TRACK_NOT_FOUND);
  return toOrder(row);
}

/* ------------------------------------------------------------------ lecture (admin) */

/** Heure d'Algérie : UTC+1 toute l'année (pas d'heure d'été). */
const algeriaStart = (day: string) => new Date(`${day}T00:00:00.000+01:00`);
const algeriaEnd = (day: string) => new Date(`${day}T23:59:59.999+01:00`);

/**
 * Normalisation d'une colonne téléphone EN SQL : jumelle exacte de `normalizePhone` (@fashion/shared).
 * Toute modification de l'une doit être répercutée sur l'autre ; l'égalité est vérifiée dans PostgreSQL par
 * tests/phone-sql.test.ts.
 */
export const normalizedPhoneSql = (column: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`regexp_replace(regexp_replace(regexp_replace(${column}, '[^0-9]', '', 'g'), '^213', '0'), '^00213', '0')`;

/**
 * Ids des commandes satisfaisant les filtres « texte » (recherche, téléphone normalisé) — évalués en SQL paramétré,
 * avec exactement la logique de l'interface : sous-chaîne insensible à la casse sur
 * « numéro prénom nom téléphone wilaya », et comparaison des téléphones après normalisation.
 */
async function idsMatchingText(filters: ParsedOrderFilters): Promise<string[] | null> {
  const conditions: Prisma.Sql[] = [];
  if (filters.phone) {
    conditions.push(
      Prisma.sql`${normalizedPhoneSql(Prisma.sql`"customerPhone"`)} = ${normalizePhone(filters.phone)}`,
    );
  }
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    conditions.push(
      Prisma.sql`strpos(lower(concat_ws(' ', "orderNumber", "customerFirstName", "customerLastName", "customerPhone", "wilayaName")), ${q}) > 0`,
    );
  }
  if (conditions.length === 0) return null;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Order" WHERE ${Prisma.join(conditions, " AND ")}`);
  return rows.map((r) => r.id);
}

export async function listOrders(filters: ParsedOrderFilters): Promise<Order[]> {
  const where: Prisma.OrderWhereInput = {};
  if (filters.status && filters.status !== "all") where.status = filters.status;
  if (filters.deliveryMethod && filters.deliveryMethod !== "all") where.deliveryMethod = filters.deliveryMethod;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: algeriaStart(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: algeriaEnd(filters.dateTo) } : {}),
    };
  }
  if (filters.minTotal !== undefined || filters.maxTotal !== undefined) {
    where.total = {
      ...(filters.minTotal !== undefined ? { gte: filters.minTotal } : {}),
      ...(filters.maxTotal !== undefined ? { lte: filters.maxTotal } : {}),
    };
  }
  const ids = await idsMatchingText(filters);
  if (ids) where.id = { in: ids };

  const rows = await prisma.order.findMany({ where, include: orderInclude, orderBy: [{ createdAt: "desc" }, { sequence: "desc" }] });
  return rows.map(toOrder);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  return row ? toOrder(row) : null;
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const row = await prisma.order.findUnique({ where: { orderNumber }, include: orderInclude });
  return row ? toOrder(row) : null;
}

/* ------------------------------------------------------------------ transition de statut */

/** COD : « payée » seulement à la livraison effective ; échec/retour ⇒ échec ; nouvelle expédition ⇒ à encaisser. */
export function paymentStatusAfter(status: OrderStatus, current: PaymentStatus): PaymentStatus {
  if (status === "delivered") return "paid";
  if (status === "delivery_failed" || status === "returned") return "failed";
  if (status === "shipped") return "pending";
  return current;
}

export async function updateOrderStatus(id: string, status: OrderStatus, note?: string): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    // Verrou de ligne : un double clic ou deux administrateurs ne peuvent pas restituer le stock deux fois
    // (la 2e transaction attend, relit le statut final et échoue en INVALID_TRANSITION).
    const locked = await tx.$queryRaw<Array<{ status: OrderStatus; paymentStatus: PaymentStatus; orderNumber: string }>>`
      SELECT "status", "paymentStatus", "orderNumber" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
    const current = locked[0];
    if (!current) throw notFound("Commande introuvable.");
    if (!canTransition(current.status, status)) {
      throw invalidTransition(`Transition impossible : « ${ORDER_STATUS_LABELS[current.status]} » → « ${ORDER_STATUS_LABELS[status]} ».`);
    }

    const now = new Date();
    if (STOCK_RELEASING_STATUSES.includes(status)) {
      const items = await tx.orderItem.findMany({ where: { orderId: id }, select: { productId: true, variantId: true, quantity: true } });
      const byVariant = new Map<string, number>();
      const byProduct = new Map<string, number>();
      for (const it of items) {
        byVariant.set(it.variantId, (byVariant.get(it.variantId) ?? 0) + it.quantity);
        byProduct.set(it.productId, (byProduct.get(it.productId) ?? 0) + it.quantity);
      }
      for (const [variantId, quantity] of [...byVariant].sort(byId)) {
        const rows = await tx.$queryRaw<Array<{ stock: number }>>`
          UPDATE "ProductVariant" SET "stock" = "stock" + ${quantity}::int WHERE "id" = ${variantId} RETURNING "stock"::int AS "stock"`;
        const after = rows[0]?.stock;
        if (after === undefined) continue;
        await tx.stockMovement.create({
          data: {
            variantId,
            type: "return",
            quantityDelta: quantity,
            quantityBefore: after - quantity,
            quantityAfter: after,
            reason: `Commande ${ORDER_STATUS_LABELS[status].toLowerCase()}`,
            reference: current.orderNumber,
            createdAt: now,
          },
        });
      }
      for (const [productId, quantity] of [...byProduct].sort(byId)) {
        await tx.$executeRaw`UPDATE "Product" SET "soldCount" = GREATEST(0, "soldCount" - ${quantity}::int) WHERE "id" = ${productId}`;
      }
    }

    const updated = await tx.order.update({
      where: { id },
      data: {
        status,
        paymentStatus: paymentStatusAfter(status, current.paymentStatus),
        updatedAt: now,
        history: { create: { status, note: note?.trim() || null, createdAt: now } },
      },
      include: orderInclude,
    });
    return toOrder(updated);
  }, TX_OPTIONS);
}
