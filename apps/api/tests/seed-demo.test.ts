import bcrypt from "bcryptjs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { assertSeedAllowed, loadDemoData, seedDemo, type DemoData, type SeedResult } from "../prisma/seed-demo";
import { adminAgent, customerAgent, http, prisma, resetDatabase } from "./helpers";

let demo: DemoData;
let first: SeedResult;

beforeAll(async () => {
  await resetDatabase();
  demo = await loadDemoData(resolve(__dirname, "../../web/src/mocks"));
  first = await seedDemo(prisma, { data: demo, adminEmail: "demo-owner@test.local", adminPassword: "mot-de-passe-de-demo-long" });
});

describe("seed de démonstration — chargement", () => {
  it("charge toutes les tables avec les mêmes effectifs que les mocks", async () => {
    expect(first.skipped).toBe(false);
    expect(await prisma.category.count()).toBe(demo.categories.length);
    expect(await prisma.product.count()).toBe(demo.products.length);
    expect(await prisma.productVariant.count()).toBe(demo.products.reduce((s, p) => s + p.variants.length, 0));
    expect(await prisma.productImage.count()).toBe(demo.products.reduce((s, p) => s + p.images.length, 0));
    expect(await prisma.customer.count()).toBe(demo.customers.length);
    expect(await prisma.promotion.count()).toBe(demo.promotions.length);
    expect(await prisma.order.count()).toBe(demo.orders.length);
    expect(await prisma.orderItem.count()).toBe(demo.orders.reduce((s, o) => s + o.items.length, 0));
    expect(await prisma.orderStatusEvent.count()).toBe(demo.orders.reduce((s, o) => s + o.statusHistory.length, 0));
    expect(await prisma.stockMovement.count()).toBe(demo.movements.length);
    expect(demo.orders.length).toBeGreaterThan(30);
    expect(demo.products.length).toBeGreaterThan(5);
  });

  it("crée la ligne de paramètres et le compte administrateur (mot de passe haché)", async () => {
    const settings = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings.storeName).toBe(demo.settings.storeName);
    expect(settings.shippingFees).toEqual(demo.settings.shippingFees);
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email: "demo-owner@test.local" } });
    expect(admin.passwordHash).not.toContain("mot-de-passe");
    expect(await bcrypt.compare("mot-de-passe-de-demo-long", admin.passwordHash)).toBe(true);
  });

  it("préserve identifiants, SKU et relations (catégories, variantes, clients)", async () => {
    const skus = new Set((await prisma.productVariant.findMany({ select: { sku: true } })).map((v) => v.sku));
    for (const p of demo.products) for (const v of p.variants) expect(skus.has(v.sku)).toBe(true);
    const sub = await prisma.category.findUniqueOrThrow({ where: { id: "cat_robes" } });
    expect(sub.parentId).toBe("cat_femme");
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: demo.customers[0]!.id } });
    expect(customer.phoneKey).toBe(customer.phone.replace(/\D/g, ""));
    expect(await prisma.order.count({ where: { customerId: null } })).toBe(0);
  });
});

describe("seed de démonstration — cohérence", () => {
  it("aucun stock négatif", async () => {
    expect(await prisma.productVariant.count({ where: { stock: { lt: 0 } } })).toBe(0);
  });

  it("l'historique de chaque variante est chaîné et aboutit exactement à son stock courant", async () => {
    const variants = await prisma.productVariant.findMany({ include: { movements: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } });
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      let running = 0;
      for (const m of v.movements) {
        expect(m.quantityBefore, `${v.sku} avant`).toBe(running);
        expect(m.quantityAfter, `${v.sku} après`).toBe(m.quantityBefore + m.quantityDelta);
        running = m.quantityAfter;
      }
      expect(running, `${v.sku} : stock courant`).toBe(v.stock);
    }
  });

  it("totaux de commande cohérents (lignes, remise, livraison, total) et statuts COD", async () => {
    const orders = await prisma.order.findMany({ include: { items: true, history: { orderBy: { createdAt: "asc" } } } });
    for (const o of orders) {
      const lines = o.items.reduce((s, it) => s + it.lineTotal, 0);
      expect(o.items.length, o.orderNumber).toBeGreaterThan(0);
      for (const it of o.items) expect(it.lineTotal).toBe(it.unitPrice * it.quantity);
      expect(o.subtotal, o.orderNumber).toBe(lines);
      expect(o.total, o.orderNumber).toBe(o.subtotal - o.discountTotal + o.shippingFee);
      expect(o.discountTotal).toBeLessThanOrEqual(o.subtotal);
      expect(o.paymentMethod).toBe("cash_on_delivery");
      expect(o.paymentStatus).toBe(o.status === "delivered" ? "paid" : o.status === "delivery_failed" || o.status === "returned" ? "failed" : "pending");
      expect(o.history[0]?.status).toBe("pending");
      expect(o.history[o.history.length - 1]?.status).toBe(o.status);
      expect(o.orderNumber).toBe(`CMD-${o.createdAt.getFullYear()}-${String(o.sequence).padStart(6, "0")}`);
    }
  });

  it("les lignes de commande pointent vers des variantes existantes avec prix et coût figés", async () => {
    const items = await prisma.orderItem.findMany({ include: { variant: { include: { product: true } } } });
    for (const it of items) {
      expect(it.sku).toBe(it.variant.sku);
      expect(it.unitCost).toBe(it.variant.product.costPrice);
      expect(it.unitPrice).toBe(it.variant.price);
    }
  });
});

describe("seed de démonstration — idempotence et garde-fous", () => {
  it("un second passage ne fait rien et le dit", async () => {
    const before = { products: await prisma.product.count(), orders: await prisma.order.count(), movements: await prisma.stockMovement.count() };
    const again = await seedDemo(prisma, { data: demo, adminEmail: "demo-owner@test.local", adminPassword: "mot-de-passe-de-demo-long" });
    expect(again.skipped).toBe(true);
    expect(again.reason).toMatch(/déjà \d+ produit/);
    expect(again.adminCreated).toBe(false);
    expect(await prisma.product.count()).toBe(before.products);
    expect(await prisma.order.count()).toBe(before.orders);
    expect(await prisma.stockMovement.count()).toBe(before.movements);
    expect(await prisma.adminUser.count()).toBe(1);
  });

  it("refuse de s'exécuter en production sans --force", () => {
    expect(() => assertSeedAllowed("production", false)).toThrow(/production/);
    expect(() => assertSeedAllowed("production", true)).not.toThrow();
    expect(() => assertSeedAllowed("development", false)).not.toThrow();
    expect(() => assertSeedAllowed(undefined, false)).not.toThrow();
  });
});

describe("seed de démonstration — visible dans l'API", () => {
  it("l'admin voit les commandes, les stocks, les clients et les promotions de la démo", async () => {
    const agent = await adminAgent();
    const orders = await agent.get("/api/admin/orders");
    expect(orders.status).toBe(200);
    expect(orders.body).toHaveLength(demo.orders.length);
    const sample = demo.orders[demo.orders.length - 1]!;
    const fetched = (orders.body as Array<{ id: string }>).find((o) => o.id === sample.id);
    expect(fetched).toMatchObject({ orderNumber: sample.orderNumber, total: sample.total, status: sample.status });

    const detail = await agent.get(`/api/admin/orders/${sample.id}`);
    expect(detail.body.items).toHaveLength(sample.items.length);
    expect(detail.body.statusHistory.map((h: { status: string }) => h.status)).toEqual(sample.statusHistory.map((h) => h.status));

    const inventory = await agent.get("/api/admin/inventory");
    const active = demo.products.filter((p) => !p.isArchived).reduce((s, p) => s + p.variants.length, 0);
    expect(inventory.body).toHaveLength(active);

    expect((await agent.get("/api/admin/customers")).body).toHaveLength(demo.customers.length);
    expect((await agent.get("/api/admin/promotions")).body).toHaveLength(demo.promotions.length);
    const moves = await agent.get("/api/admin/inventory/movements");
    expect(moves.body).toHaveLength(demo.movements.length);
  });

  it("une nouvelle commande reprend la numérotation après la dernière commande de la démo", async () => {
    const lastSeq = Math.max(...demo.orders.map((o) => Number(o.orderNumber.slice(-6))));
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { stock: { gte: 3 }, product: { isPublished: true, isArchived: false } } });
    const buyer = await customerAgent({ phone: "0555 99 88 77", phoneKey: "0555998877", firstName: "Test", lastName: "Seed" });
    const res = await buyer.agent.post("/api/orders").send({
      customer: { firstName: "Test", lastName: "Seed", phone: "0555 99 88 77" },
      shippingAddress: { wilayaCode: "16", commune: "Alger", address: "12 rue de test", deliveryMethod: "home" },
      items: [{ variantId: variant.id, quantity: 1 }],
    });
    expect(res.status).toBe(201);
    expect(Number(res.body.orderNumber.slice(-6))).toBe(lastSeq + 1);
  });

  it("saisir le téléphone d'une cliente de la démo comme coordonnée de livraison ne touche pas sa fiche", async () => {
    const c = demo.customers[2]!;
    const before = JSON.stringify(await prisma.customer.findUniqueOrThrow({ where: { id: c.id } }));
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { stock: { gte: 3 }, product: { isPublished: true, isArchived: false } } });
    const buyer = await customerAgent({ phone: "0555 99 88 76", phoneKey: "0555998876", firstName: "Autre", lastName: "Cliente" });
    const res = await buyer.agent.post("/api/orders").send({
      customer: { firstName: c.firstName, lastName: c.lastName, phone: `+213${c.phone.replace(/\D/g, "").slice(1)}` },
      shippingAddress: { wilayaCode: c.wilayaCode, commune: c.commune, address: "Adresse de test", deliveryMethod: "home" },
      items: [{ variantId: variant.id, quantity: 1 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.customer.customerId).toBe(buyer.customer.id); // rattachée à la cliente connectée, pas à celle du numéro saisi
    expect(JSON.stringify(await prisma.customer.findUniqueOrThrow({ where: { id: c.id } }))).toBe(before);
  });
});
