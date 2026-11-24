/**
 * Seed de DÉMONSTRATION : charge dans PostgreSQL les données fictives du frontend
 * (apps/web/src/mocks : catégories, produits, clients, commandes, mouvements de stock, promotions, paramètres)
 * en préservant les identifiants, les relations, les SKU, les prix figés, les historiques de statut et de stock.
 *
 *   pnpm --filter @fashion/api db:seed:demo            (refusé si NODE_ENV=production, sauf avec --force)
 *
 * - Idempotent : si la base contient déjà des produits, il ne modifie rien et le dit.
 * - Ne touche jamais aux paramètres ni au compte admin déjà présents (création seulement s'ils manquent).
 * - Le jeu de données est inséré en UNE transaction : tout ou rien.
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizePhone } from "@fashion/shared";
import type { Category, Customer, Order, Product, Promotion, StockMovement, StoreSettings } from "@fashion/types";
import { syncOrderSequence } from "../src/utils/order-number";

export type DemoData = {
  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  movements: StockMovement[];
  promotions: Promotion[];
  settings: StoreSettings;
};

export type SeedResult = {
  skipped: boolean;
  reason?: string;
  adminCreated: boolean;
  settingsCreated: boolean;
  counts: Record<string, number>;
};

/**
 * Le dossier des mocks du site (apps/web/src/mocks) est fourni À L'EXÉCUTION (option `--mocks <dossier>` ou variable
 * DEMO_MOCKS_DIR), jamais écrit en dur : un chemin constant vers apps/web serait suivi par l'analyse statique des
 * plateformes de déploiement (Vercel), qui tenterait alors de compiler le code du site avec la configuration de l'API.
 */
function requireMocksDir(dir: string | undefined): string {
  const value = dir ?? process.env.DEMO_MOCKS_DIR;
  if (!value) throw new Error("Dossier des mocks manquant : lancez `pnpm db:seed:demo` (il passe --mocks ../web/src/mocks) ou définissez DEMO_MOCKS_DIR.");
  return resolve(process.cwd(), value);
}

/**
 * Charge les mocks du frontend. Import dynamique : ces fichiers n'ont que des `import type` vers l'alias `@/` du site web
 * (effacés à l'exécution), mais le compilateur de l'API ne doit pas tenter de les résoudre.
 */
async function importMock<T>(dir: string, file: string, exportName: string): Promise<T> {
  const mod = (await import(/* @vite-ignore */ pathToFileURL(resolve(dir, file)).href)) as Record<string, unknown>;
  const value = mod[exportName];
  if (value === undefined) throw new Error(`Mock introuvable : ${file} → ${exportName}`);
  return value as T;
}

export async function loadDemoData(mocksDir?: string): Promise<DemoData> {
  const dir = requireMocksDir(mocksDir);
  const [categories, products, customers, orders, movements, promotions, settings] = await Promise.all([
    importMock<Category[]>(dir, "categories.mock.ts", "categoriesMock"),
    importMock<Product[]>(dir, "products.mock.ts", "productsMock"),
    importMock<Customer[]>(dir, "customers.mock.ts", "customersMock"),
    importMock<Order[]>(dir, "orders.mock.ts", "ordersMock"),
    importMock<StockMovement[]>(dir, "inventory.mock.ts", "stockMovementsMock"),
    importMock<Promotion[]>(dir, "promotions.mock.ts", "promotionsMock"),
    importMock<StoreSettings>(dir, "settings.mock.ts", "settingsMock"),
  ]);
  return { categories, products, customers, orders, movements, promotions, settings };
}

/** Refuse de s'exécuter en production sauf demande explicite (--force). */
export function assertSeedAllowed(nodeEnv: string | undefined, force: boolean): void {
  if (nodeEnv === "production" && !force) {
    throw new Error("Seed de démonstration refusé en production (NODE_ENV=production). Utilisez --force si c'est vraiment voulu.");
  }
}

const iso = (value: string) => new Date(value);

/** createMany par paquets (limite de paramètres liés de PostgreSQL). */
async function insertChunked<T>(rows: readonly T[], insert: (chunk: T[]) => Promise<unknown>, size = 500) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

/** Numéro de séquence porté par le numéro de commande CMD-AAAA-NNNNNN. */
function sequenceOf(orderNumber: string): number {
  const n = Number(orderNumber.slice(orderNumber.lastIndexOf("-") + 1));
  if (!Number.isInteger(n) || n < 1) throw new Error(`Numéro de commande inattendu : ${orderNumber}`);
  return n;
}

async function ensureSettingsAndAdmin(
  prisma: PrismaClient,
  settings: StoreSettings,
  options: { adminEmail?: string; adminPassword?: string },
): Promise<{ settingsCreated: boolean; adminCreated: boolean }> {
  const existing = await prisma.storeSettings.findUnique({ where: { id: 1 }, select: { id: true } });
  if (!existing) {
    const { currency: _currency, ...data } = settings;
    void _currency;
    await prisma.storeSettings.create({ data: { id: 1, ...data } });
  }

  let adminCreated = false;
  if (options.adminPassword) {
    const email = options.adminEmail ?? "owner@example.com";
    const admin = await prisma.adminUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (!admin) {
      await prisma.adminUser.create({ data: { email, passwordHash: await bcrypt.hash(options.adminPassword, 12) } });
      adminCreated = true;
    }
  }
  return { settingsCreated: !existing, adminCreated };
}

export async function seedDemo(
  prisma: PrismaClient,
  options: { adminEmail?: string; adminPassword?: string; log?: (message: string) => void; data?: DemoData; mocksDir?: string } = {},
): Promise<SeedResult> {
  const log = options.log ?? (() => undefined);
  const data = options.data ?? (await loadDemoData(options.mocksDir));

  const { settingsCreated, adminCreated } = await ensureSettingsAndAdmin(prisma, data.settings, options);
  if (settingsCreated) log("Paramètres de la boutique créés.");
  if (adminCreated) log("Compte administrateur créé.");

  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    return {
      skipped: true,
      reason: `La base contient déjà ${existingProducts} produit(s) : aucune donnée de démonstration n'a été ajoutée.`,
      adminCreated,
      settingsCreated,
      counts: {},
    };
  }

  const { categories, products, customers, orders, movements, promotions } = data;

  await prisma.$transaction(
    async (tx) => {
      // Les parents d'abord (clé étrangère auto-référencée).
      const parentsFirst = [...categories].sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null));
      await tx.category.createMany({
        data: parentsFirst.map<Prisma.CategoryCreateManyInput>((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: c.imageUrl,
          kind: c.kind,
          parentId: c.parentId,
          displayOrder: c.displayOrder,
          isArchived: c.isArchived,
          createdAt: iso(c.createdAt),
        })),
      });

      await tx.product.createMany({
        data: products.map<Prisma.ProductCreateManyInput>((p) => ({
          id: p.id,
          reference: p.reference,
          name: p.name,
          slug: p.slug,
          description: p.description,
          categoryId: p.categoryId,
          gender: p.gender,
          tags: p.tags,
          price: p.price,
          costPrice: p.costPrice,
          compareAtPrice: p.compareAtPrice ?? null,
          soldCount: p.soldCount,
          isFeatured: p.isFeatured,
          isPublished: p.isPublished,
          isArchived: p.isArchived,
          createdAt: iso(p.createdAt),
          updatedAt: iso(p.updatedAt),
        })),
      });
      await insertChunked(
        products.flatMap((p) =>
          p.images.map<Prisma.ProductImageCreateManyInput>((im) => ({ id: im.id, productId: p.id, url: im.url, alt: im.alt, color: im.color ?? null, position: im.position })),
        ),
        (data) => tx.productImage.createMany({ data }),
      );
      await insertChunked(
        products.flatMap((p) =>
          p.variants.map<Prisma.ProductVariantCreateManyInput>((v) => ({
            id: v.id,
            productId: p.id,
            sku: v.sku,
            color: v.color,
            colorCode: v.colorCode,
            size: v.size,
            price: v.price,
            stock: v.stock,
            alertThreshold: v.alertThreshold,
          })),
        ),
        (data) => tx.productVariant.createMany({ data }),
      );

      await tx.customer.createMany({
        data: customers.map<Prisma.CustomerCreateManyInput>((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          phoneKey: normalizePhone(c.phone),
          email: c.email ?? null,
          wilayaCode: c.wilayaCode,
          commune: c.commune,
          address: c.address,
          isGuest: c.isGuest,
          createdAt: iso(c.createdAt),
        })),
      });

      await tx.promotion.createMany({
        data: promotions.map<Prisma.PromotionCreateManyInput>((p) => ({
          id: p.id,
          code: p.code.toUpperCase(),
          label: p.label,
          type: p.type,
          value: p.value,
          startsAt: iso(p.startsAt),
          endsAt: iso(p.endsAt),
          minOrderAmount: p.minOrderAmount,
          isActive: p.isActive,
          usageCount: p.usageCount,
          createdAt: iso(p.createdAt),
        })),
      });

      await insertChunked(
        orders,
        (chunk) =>
          tx.order.createMany({
            data: chunk.map<Prisma.OrderCreateManyInput>((o) => ({
              id: o.id,
              sequence: sequenceOf(o.orderNumber),
              orderNumber: o.orderNumber,
              customerId: o.customer.customerId ?? null,
              customerFirstName: o.customer.firstName,
              customerLastName: o.customer.lastName,
              customerPhone: o.customer.phone,
              customerEmail: o.customer.email ?? null,
              wilayaCode: o.shippingAddress.wilayaCode,
              wilayaName: o.shippingAddress.wilayaName,
              commune: o.shippingAddress.commune,
              address: o.shippingAddress.address,
              deliveryMethod: o.deliveryMethod,
              pickupPointId: o.shippingAddress.pickupPointId ?? null,
              pickupPointName: o.shippingAddress.pickupPointName ?? null,
              subtotal: o.subtotal,
              discountTotal: o.discountTotal,
              promoCode: o.promoCode ?? null,
              shippingFee: o.shippingFee,
              total: o.total,
              paymentMethod: o.paymentMethod,
              paymentStatus: o.paymentStatus,
              status: o.status,
              customerNote: o.customerNote ?? null,
              createdAt: iso(o.createdAt),
              updatedAt: iso(o.updatedAt),
            })),
          }),
        200,
      );
      await insertChunked(
        orders.flatMap((o) =>
          o.items.map<Prisma.OrderItemCreateManyInput>((it) => ({
            id: it.id,
            orderId: o.id,
            productId: it.productId,
            variantId: it.variantId,
            productName: it.productName,
            productSlug: it.productSlug,
            colorCode: it.colorCode,
            imageUrl: it.imageUrl,
            sku: it.sku,
            color: it.color,
            size: it.size,
            unitPrice: it.unitPrice,
            unitCost: it.unitCost,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
          })),
        ),
        (data) => tx.orderItem.createMany({ data }),
      );
      await insertChunked(
        orders.flatMap((o) => o.statusHistory.map<Prisma.OrderStatusEventCreateManyInput>((h) => ({ orderId: o.id, status: h.status, note: h.note ?? null, createdAt: iso(h.at) }))),
        (data) => tx.orderStatusEvent.createMany({ data }),
      );

      // Du plus ancien au plus récent : l'ordre d'insertion reflète la chronologie.
      const chronological = [...movements].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      await insertChunked(
        chronological,
        (chunk) =>
          tx.stockMovement.createMany({
            data: chunk.map<Prisma.StockMovementCreateManyInput>((m) => ({
              id: m.id,
              variantId: m.variantId,
              type: m.type,
              quantityDelta: m.quantityDelta,
              quantityBefore: m.quantityBefore,
              quantityAfter: m.quantityAfter,
              reason: m.reason,
              reference: m.reference ?? null,
              createdAt: iso(m.createdAt),
            })),
          }),
        1000,
      );

      // Les numéros ont été fournis explicitement : le compteur doit repartir après le plus grand.
      await syncOrderSequence(tx);
    },
    { maxWait: 30_000, timeout: 120_000 },
  );

  const variantsCount = products.reduce((s, p) => s + p.variants.length, 0);
  return {
    skipped: false,
    adminCreated,
    settingsCreated,
    counts: {
      categories: categories.length,
      products: products.length,
      variants: variantsCount,
      customers: customers.length,
      orders: orders.length,
      orderItems: orders.reduce((s, o) => s + o.items.length, 0),
      stockMovements: movements.length,
      promotions: promotions.length,
    },
  };
}

async function main() {
  const force = process.argv.includes("--force");
  const mocksFlag = process.argv.indexOf("--mocks");
  const mocksDir = mocksFlag >= 0 ? process.argv[mocksFlag + 1] : undefined;
  try {
    assertSeedAllowed(process.env.NODE_ENV, force);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const result = await seedDemo(prisma, {
      adminEmail: process.env.ADMIN_EMAIL,
      adminPassword: process.env.ADMIN_PASSWORD,
      mocksDir,
      log: (m) => console.log(m),
    });
    if (result.skipped) {
      console.log(result.reason);
      return;
    }
    console.log("Données de démonstration chargées :");
    for (const [name, count] of Object.entries(result.counts)) console.log(`  ${name.padEnd(15)} ${count}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution directe (tsx prisma/seed-demo.ts) uniquement : l'import par les tests n'a aucun effet de bord.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error("Échec du seed de démonstration :", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
