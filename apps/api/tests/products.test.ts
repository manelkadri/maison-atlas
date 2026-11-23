import type { Product } from "@fashion/types";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminAgent, http, prisma, resetDatabase } from "./helpers";

type Agent = Awaited<ReturnType<typeof adminAgent>>;
let admin: Agent;
let catId: string;

beforeAll(async () => {
  await resetDatabase();
  admin = await adminAgent();
});

beforeEach(async () => {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  catId = (await prisma.category.create({ data: { name: "Robes", slug: "robes", displayOrder: 1 } })).id;
});

type VariantBody = { id?: string; sku: string; color: string; colorCode: string; size: string; price: number; stock: number; alertThreshold: number };
const variant = (sku: string, color: string, size: string, stock: number, extra: Partial<VariantBody> = {}): VariantBody => ({
  sku,
  color,
  colorCode: color === "Noir" ? "#000000" : "#ffffff",
  size,
  price: 5000,
  stock,
  alertThreshold: 2,
  ...extra,
});

function body(over: Record<string, unknown> = {}) {
  return {
    name: "Robe longue",
    slug: "robe-longue",
    reference: "REF-1",
    description: "Une jolie robe longue pour l'été",
    categoryId: catId,
    gender: "women",
    tags: ["ete", "robe"],
    price: 5000,
    costPrice: 2000,
    images: [
      { url: "/uploads/b.png", alt: "dos", position: 1 },
      { url: "/uploads/a.png", alt: "face", color: "Noir", position: 0 },
    ],
    variants: [variant("REF-1-NOI-M", "Noir", "M", 5), variant("REF-1-NOI-L", "Noir", "L", 0)],
    isFeatured: false,
    isPublished: true,
    ...over,
  };
}

async function create(over: Record<string, unknown> = {}): Promise<Product> {
  const res = await admin.post("/api/admin/products").send(body(over));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as Product;
}

const movementsOf = (productId: string) =>
  prisma.stockMovement.findMany({ where: { variant: { productId } }, orderBy: { createdAt: "asc" }, include: { variant: true } });

describe("création (admin)", () => {
  it("crée produit + variantes + images ordonnées, au format Product", async () => {
    const res = await admin.post("/api/admin/products").send(body());
    expect(res.status).toBe(201);
    const p = res.body as Product;
    expect(p).toMatchObject({
      name: "Robe longue",
      slug: "robe-longue",
      reference: "REF-1",
      categoryId: catId,
      gender: "women",
      tags: ["ete", "robe"],
      price: 5000,
      costPrice: 2000,
      soldCount: 0,
      isFeatured: false,
      isPublished: true,
      isArchived: false,
    });
    expect(p).not.toHaveProperty("compareAtPrice");
    expect(p.images.map((i) => i.url)).toEqual(["/uploads/a.png", "/uploads/b.png"]);
    expect(p.images[0]).toMatchObject({ alt: "face", color: "Noir", position: 0 });
    expect(p.images[1]).not.toHaveProperty("color");
    expect(p.variants.map((v) => v.sku)).toEqual(["REF-1-NOI-M", "REF-1-NOI-L"]);
    expect(p.variants[0]).toMatchObject({ productId: p.id, color: "Noir", colorCode: "#000000", size: "M", price: 5000, stock: 5, alertThreshold: 2 });
    expect(new Date(p.createdAt).toISOString()).toBe(p.createdAt);

    const again = await admin.get(`/api/admin/products/${p.id}`);
    expect(again.body).toEqual(p);
  });

  it("déduit le slug du nom s'il est absent ou vide", async () => {
    const { slug: _s, ...noSlug } = body({ name: "Écharpe en Laine", reference: "REF-S1", variants: [variant("S1-A", "Noir", "M", 1)] });
    const res = await admin.post("/api/admin/products").send(noSlug);
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("echarpe-en-laine");
    const empty = await admin.post("/api/admin/products").send(body({ slug: "", name: "Veste Ardoise", reference: "REF-S2", variants: [variant("S2-A", "Noir", "M", 1)] }));
    expect(empty.body.slug).toBe("veste-ardoise");
  });

  it("crée un mouvement « initial » pour chaque variante créée avec un stock > 0 (et seulement celles-là)", async () => {
    const p = await create({ variants: [variant("A-1", "Noir", "M", 5), variant("A-2", "Noir", "L", 0), variant("A-3", "Blanc", "M", 12)] });
    const moves = await movementsOf(p.id);
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.type === "initial" && m.quantityBefore === 0 && m.reason === "Stock initial")).toBe(true);
    expect(moves.map((m) => [m.variant.sku, m.quantityDelta, m.quantityAfter]).sort()).toEqual([
      ["A-1", 5, 5],
      ["A-3", 12, 12],
    ]);
  });

  it("slug en doublon ⇒ 409 CONFLICT ; référence en doublon ⇒ 409", async () => {
    await create();
    const dupSlug = await admin.post("/api/admin/products").send(body({ reference: "REF-2", variants: [variant("Z-1", "Noir", "M", 1)] }));
    expect(dupSlug.status).toBe(409);
    expect(dupSlug.body.error.code).toBe("CONFLICT");
    expect(dupSlug.body.error.message).toContain("robe-longue");
    const dupRef = await admin.post("/api/admin/products").send(body({ slug: "autre", variants: [variant("Z-2", "Noir", "M", 1)] }));
    expect(dupRef.status).toBe(409);
    expect(await prisma.product.count()).toBe(1);
  });

  it("SKU en doublon dans le produit (insensible à la casse) ⇒ 409 avec les SKU fautifs", async () => {
    const res = await admin.post("/api/admin/products").send(body({ variants: [variant("DUP-1", "Noir", "M", 1), variant("dup-1", "Noir", "L", 1)] }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.message).toContain("DUP-1");
    expect(await prisma.product.count()).toBe(0);
  });

  it("SKU déjà utilisé par un autre produit (insensible à la casse) ⇒ 409 listant les SKU, rien n'est créé", async () => {
    await create();
    const res = await admin
      .post("/api/admin/products")
      .send(body({ slug: "autre", reference: "REF-2", variants: [variant("ref-1-noi-m", "Noir", "M", 1), variant("NEUF-1", "Noir", "L", 1), variant("REF-1-NOI-L", "Blanc", "S", 1)] }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("ref-1-noi-m");
    expect(res.body.error.message).toContain("REF-1-NOI-L");
    expect(res.body.error.message).not.toContain("NEUF-1");
    expect(await prisma.product.count()).toBe(1);
    expect(await prisma.productVariant.count({ where: { sku: "NEUF-1" } })).toBe(0);
  });

  it("refuse catégorie inconnue, corps invalide, variantes absentes, URL d'image dangereuse", async () => {
    const cases: Array<Record<string, unknown>> = [
      { categoryId: "inconnue" },
      { name: "" },
      { price: -1 },
      { price: 12.5 },
      { variants: [] },
      { variants: [variant("V-1", "Noir", "M", -1)] },
      { variants: [{ ...variant("V-2", "Noir", "M", 1), colorCode: "noir" }] },
      { variants: [variant("V-3", "Noir", "M", 1), variant("V-4", "noir", "m", 1)] },
      { images: [{ url: "javascript:alert(1)", alt: "x", position: 0 }] },
      { gender: "kids" },
    ];
    for (const over of cases) {
      const res = await admin.post("/api/admin/products").send(body({ reference: "REF-X", slug: "x", ...over }));
      expect(res.status, JSON.stringify(over)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
    expect(await prisma.product.count()).toBe(0);
  });

  it("ne crée rien en cas d'erreur en cours de transaction (atomicité)", async () => {
    // Le 2e SKU est déjà pris par un autre produit : aucun produit, variante ou mouvement orphelin.
    await create();
    const before = { v: await prisma.productVariant.count(), m: await prisma.stockMovement.count() };
    await admin
      .post("/api/admin/products")
      .send(body({ slug: "autre", reference: "REF-2", variants: [variant("NEW-1", "Noir", "M", 3), variant("REF-1-NOI-M", "Noir", "L", 3)] }))
      .expect(409);
    expect(await prisma.productVariant.count()).toBe(before.v);
    expect(await prisma.stockMovement.count()).toBe(before.m);
  });
});

describe("modification (admin)", () => {
  it("apparie les variantes par id puis par SKU ; l'écart de stock crée un mouvement « adjustment »", async () => {
    const p = await create({ variants: [variant("U-1", "Noir", "M", 5), variant("U-2", "Noir", "L", 3), variant("U-3", "Noir", "S", 4)] });
    const [v1, v2, v3] = p.variants as [Product["variants"][number], Product["variants"][number], Product["variants"][number]];

    const res = await admin.patch(`/api/admin/products/${p.id}`).send({
      variants: [
        // par id : le SKU change, l'identité est conservée ; stock 5 → 9
        { ...variant("U-1-BIS", "Noir", "M", 9), id: v1.id },
        // par SKU (sans id) : stock 3 → 3 (aucun mouvement)
        variant("u-2", "Noir", "L", 3),
        // v3 (U-3) est retirée ; une nouvelle variante apparaît avec du stock
        variant("U-4", "Blanc", "M", 7),
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const updated = res.body as Product;
    expect(updated.variants).toHaveLength(3);
    const byId = new Map(updated.variants.map((v) => [v.id, v]));
    expect(byId.get(v1.id)).toMatchObject({ sku: "U-1-BIS", stock: 9 });
    expect(byId.get(v2.id)).toMatchObject({ sku: "u-2", stock: 3 });
    expect(byId.has(v3.id)).toBe(false);
    const created = updated.variants.find((v) => v.sku === "U-4");
    expect(created).toBeDefined();
    expect(created!.id).not.toBe(v1.id);

    const moves = (await movementsOf(p.id)).filter((m) => m.type !== "initial" || m.variant.sku === "U-4");
    const adjustments = moves.filter((m) => m.type === "adjustment");
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toMatchObject({ variantId: v1.id, quantityDelta: 4, quantityBefore: 5, quantityAfter: 9, reason: "Correction depuis la fiche produit" });
    const initialU4 = moves.filter((m) => m.type === "initial");
    expect(initialU4).toHaveLength(1);
    expect(initialU4[0]).toMatchObject({ quantityDelta: 7, quantityAfter: 7 });
    expect(await prisma.productVariant.count({ where: { id: v3.id } })).toBe(0);
  });

  it("un stock revu à la baisse crée un ajustement négatif", async () => {
    const p = await create({ variants: [variant("N-1", "Noir", "M", 10)] });
    await admin.patch(`/api/admin/products/${p.id}`).send({ variants: [{ ...variant("N-1", "Noir", "M", 4), id: p.variants[0]!.id }] }).expect(200);
    const adj = (await movementsOf(p.id)).filter((m) => m.type === "adjustment");
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ quantityDelta: -6, quantityBefore: 10, quantityAfter: 4 });
  });

  it("PATCH partiel : les clés absentes sont inchangées, les variantes aussi (aucun mouvement)", async () => {
    const p = await create();
    const before = (await movementsOf(p.id)).length;
    const res = await admin.patch(`/api/admin/products/${p.id}`).send({ name: "Robe renommée", price: 5500, tags: ["promo"], isFeatured: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Robe renommée", price: 5500, tags: ["promo"], isFeatured: true, slug: "robe-longue", costPrice: 2000 });
    expect(res.body.variants).toEqual(p.variants);
    expect(res.body.images).toHaveLength(2);
    expect((await movementsOf(p.id)).length).toBe(before);
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(p.updatedAt).getTime());
  });

  it("compareAtPrice : clé absente = conservé ; null = effacé ; nombre = défini", async () => {
    const p = await create({ compareAtPrice: 8000 });
    expect(p.compareAtPrice).toBe(8000);

    const untouched = await admin.patch(`/api/admin/products/${p.id}`).send({ name: "Autre nom" });
    expect(untouched.body.compareAtPrice).toBe(8000);

    const cleared = await admin.patch(`/api/admin/products/${p.id}`).send({ compareAtPrice: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body).not.toHaveProperty("compareAtPrice");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).compareAtPrice).toBeNull();

    const set = await admin.patch(`/api/admin/products/${p.id}`).send({ compareAtPrice: 9000 });
    expect(set.body.compareAtPrice).toBe(9000);
  });

  it("remplace les images quand elles sont fournies, les trie par position", async () => {
    const p = await create();
    const res = await admin
      .patch(`/api/admin/products/${p.id}`)
      .send({ images: [{ url: "https://cdn.example/z.jpg", alt: "z", position: 2 }, { url: "https://cdn.example/y.jpg", alt: "y", position: 0 }] });
    expect(res.status).toBe(200);
    expect(res.body.images.map((i: { url: string }) => i.url)).toEqual(["https://cdn.example/y.jpg", "https://cdn.example/z.jpg"]);
    expect(await prisma.productImage.count({ where: { productId: p.id } })).toBe(2);
  });

  it("slug / référence / SKU : unicité contrôlée en modification, garder les siens est permis", async () => {
    const a = await create();
    const b = await create({ slug: "autre", reference: "REF-2", variants: [variant("B-1", "Noir", "M", 1)] });

    expect((await admin.patch(`/api/admin/products/${b.id}`).send({ slug: "robe-longue" })).status).toBe(409);
    expect((await admin.patch(`/api/admin/products/${b.id}`).send({ reference: "REF-1" })).status).toBe(409);
    const skuClash = await admin.patch(`/api/admin/products/${b.id}`).send({ variants: [{ ...variant("ref-1-noi-m", "Noir", "M", 1), id: b.variants[0]!.id }] });
    expect(skuClash.status).toBe(409);
    expect(skuClash.body.error.message).toContain("ref-1-noi-m");

    expect((await admin.patch(`/api/admin/products/${a.id}`).send({ slug: "robe-longue", reference: "REF-1", variants: a.variants })).status).toBe(200);
    // Le refus n'a rien modifié sur b.
    expect((await admin.get(`/api/admin/products/${b.id}`)).body.variants[0].sku).toBe("B-1");
  });

  it("refuse de retirer une variante déjà commandée (409) et ne modifie rien", async () => {
    const p = await create({ variants: [variant("O-1", "Noir", "M", 5), variant("O-2", "Noir", "L", 5)] });
    await orderOf(p, p.variants[0]!);
    const res = await admin.patch(`/api/admin/products/${p.id}`).send({ name: "Nouveau nom", variants: [{ ...variant("O-2", "Noir", "L", 5), id: p.variants[1]!.id }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    const after = (await admin.get(`/api/admin/products/${p.id}`)).body as Product;
    expect(after.name).toBe("Robe longue");
    expect(after.variants).toHaveLength(2);
  });

  it("404 si le produit n'existe pas ; 400 si le corps est invalide", async () => {
    expect((await admin.patch("/api/admin/products/inconnu").send({ name: "x" })).status).toBe(404);
    const p = await create();
    expect((await admin.patch(`/api/admin/products/${p.id}`).send({ price: -5 })).status).toBe(400);
    expect((await admin.patch(`/api/admin/products/${p.id}`).send({ variants: [] })).status).toBe(400);
  });
});

/** Crée directement en base une commande contenant la variante (le module commandes appartient à un autre périmètre). */
async function orderOf(product: Product, v: Product["variants"][number]) {
  return prisma.order.create({
    data: {
      orderNumber: `CMD-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`,
      customerFirstName: "Amel",
      customerLastName: "Test",
      customerPhone: "0555123456",
      wilayaCode: "46",
      wilayaName: "Aïn Témouchent",
      commune: "Centre",
      deliveryMethod: "home",
      subtotal: v.price,
      shippingFee: 450,
      total: v.price + 450,
      items: {
        create: [
          {
            productId: product.id,
            variantId: v.id,
            productName: product.name,
            productSlug: product.slug,
            colorCode: v.colorCode,
            sku: v.sku,
            color: v.color,
            size: v.size,
            unitPrice: v.price,
            unitCost: product.costPrice,
            quantity: 1,
            lineTotal: v.price,
          },
        ],
      },
    },
  });
}

describe("publication, archivage, suppression (admin)", () => {
  it("publish / dépublier", async () => {
    const p = await create({ isPublished: false });
    const on = await admin.post(`/api/admin/products/${p.id}/publish`).send({ isPublished: true });
    expect(on.status).toBe(200);
    expect(on.body.isPublished).toBe(true);
    expect(on.body.costPrice).toBe(2000);
    const off = await admin.post(`/api/admin/products/${p.id}/publish`).send({ isPublished: false });
    expect(off.body.isPublished).toBe(false);
    expect((await admin.post(`/api/admin/products/${p.id}/publish`).send({})).status).toBe(400);
    expect((await admin.post("/api/admin/products/nope/publish").send({ isPublished: true })).status).toBe(404);
  });

  it("archive dépublie ; publier un produit archivé est refusé ; restore le rend de nouveau modifiable (brouillon)", async () => {
    const p = await create();
    await admin.post(`/api/admin/products/${p.id}/archive`).expect(204);
    let row = (await admin.get(`/api/admin/products/${p.id}`)).body as Product;
    expect(row).toMatchObject({ isArchived: true, isPublished: false });

    const refused = await admin.post(`/api/admin/products/${p.id}/publish`).send({ isPublished: true });
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("VALIDATION");
    expect((await admin.patch(`/api/admin/products/${p.id}`).send({ isPublished: true })).status).toBe(400);

    await admin.post(`/api/admin/products/${p.id}/restore`).expect(204);
    row = (await admin.get(`/api/admin/products/${p.id}`)).body as Product;
    expect(row).toMatchObject({ isArchived: false, isPublished: false });
    expect((await admin.post(`/api/admin/products/${p.id}/publish`).send({ isPublished: true })).status).toBe(200);

    expect((await admin.post("/api/admin/products/nope/archive")).status).toBe(404);
    expect((await admin.post("/api/admin/products/nope/restore")).status).toBe(404);
  });

  it("supprime un produit jamais commandé (204) avec variantes, images et mouvements", async () => {
    const p = await create();
    await admin.delete(`/api/admin/products/${p.id}`).expect(204);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.productVariant.count()).toBe(0);
    expect(await prisma.productImage.count()).toBe(0);
    expect(await prisma.stockMovement.count()).toBe(0);
    expect((await admin.get(`/api/admin/products/${p.id}`)).status).toBe(404);
    expect((await admin.delete(`/api/admin/products/${p.id}`)).status).toBe(404);
  });

  it("refuse la suppression d'un produit présent dans une commande (409 CONFLICT, message du mock)", async () => {
    const p = await create();
    await orderOf(p, p.variants[0]!);
    const res = await admin.delete(`/api/admin/products/${p.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.message).toBe("Ce produit figure dans des commandes existantes : archivez-le plutôt que de le supprimer.");
    expect(await prisma.product.count()).toBe(1);
    expect(await prisma.productVariant.count()).toBe(2);
    // L'archivage reste possible.
    await admin.post(`/api/admin/products/${p.id}/archive`).expect(204);
  });
});

describe("lecture admin", () => {
  it("liste tout (brouillons et archivés inclus), par id et par slug, avec costPrice", async () => {
    const pub = await create();
    const draft = await create({ slug: "brouillon", reference: "REF-D", isPublished: false, variants: [variant("D-1", "Noir", "M", 1)] });
    const arch = await create({ slug: "archive", reference: "REF-A", variants: [variant("A-1", "Noir", "M", 1)] });
    await admin.post(`/api/admin/products/${arch.id}/archive`).expect(204);

    const list = await admin.get("/api/admin/products");
    expect(list.status).toBe(200);
    expect(list.body.map((p: Product) => p.id).sort()).toEqual([pub.id, draft.id, arch.id].sort());
    // Plus récent d'abord.
    expect(list.body[0].id).toBe(arch.id);
    expect(list.body.every((p: Product) => p.costPrice > 0)).toBe(true);

    expect((await admin.get(`/api/admin/products/${draft.id}`)).body.slug).toBe("brouillon");
    expect((await admin.get("/api/admin/products/by-slug/archive")).body.id).toBe(arch.id);
    expect((await admin.get("/api/admin/products/by-slug/nope")).status).toBe(404);
    expect((await admin.get("/api/admin/products/nope")).status).toBe(404);
  });

  it("toutes les routes admin exigent une session", async () => {
    const p = await create();
    for (const [method, path] of [
      ["get", "/api/admin/products"],
      ["get", `/api/admin/products/${p.id}`],
      ["post", "/api/admin/products"],
      ["patch", `/api/admin/products/${p.id}`],
      ["post", `/api/admin/products/${p.id}/publish`],
      ["post", `/api/admin/products/${p.id}/archive`],
      ["delete", `/api/admin/products/${p.id}`],
    ] as const) {
      const res = await http()[method](path).send({});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});

describe("routes publiques : visibilité", () => {
  it("n'exposent ni brouillons ni archivés, ni par liste, ni par catalogue, ni par slug, ni en « related »", async () => {
    const pub = await create();
    const draft = await create({ slug: "brouillon", reference: "REF-D", isPublished: false, variants: [variant("D-1", "Noir", "M", 1)] });
    const arch = await create({ slug: "archive", reference: "REF-A", variants: [variant("A-1", "Noir", "M", 1)] });
    await admin.post(`/api/admin/products/${arch.id}/archive`).expect(204);

    const list = await http().get("/api/products");
    expect(list.status).toBe(200);
    expect(list.body.items.map((p: Product) => p.id)).toEqual([pub.id]);
    expect(list.body.total).toBe(1);

    const catalog = await http().get("/api/products/catalog");
    expect(catalog.body.map((p: Product) => p.id)).toEqual([pub.id]);

    expect((await http().get("/api/products/by-slug/robe-longue")).status).toBe(200);
    for (const slug of ["brouillon", "archive", "inconnu"]) {
      const res = await http().get(`/api/products/by-slug/${slug}`);
      expect(res.status, slug).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }

    const related = await http().get(`/api/products/${pub.id}/related`);
    expect(related.body).toEqual([]);
    // Un brouillon ou un archivé n'a pas de « produits liés » publics (rien ne fuit).
    expect((await http().get(`/api/products/${draft.id}/related`)).body).toEqual([]);
    expect((await http().get(`/api/products/${arch.id}/related`)).body).toEqual([]);
  });

  it("ne divulguent jamais le prix d'achat (costPrice = 0) alors que l'admin le voit", async () => {
    const p = await create({ costPrice: 1234 });
    const slugRes = await http().get("/api/products/by-slug/robe-longue");
    expect(slugRes.body.costPrice).toBe(0);
    expect((await http().get("/api/products")).body.items[0].costPrice).toBe(0);
    expect((await http().get("/api/products/catalog")).body[0].costPrice).toBe(0);
    expect((await admin.get(`/api/admin/products/${p.id}`)).body.costPrice).toBe(1234);
  });
});

describe("routes publiques : filtres, tri, pagination", () => {
  let parentId: string;
  let childId: string;
  let otherId: string;
  const ids: Record<string, string> = {};

  beforeEach(async () => {
    parentId = (await prisma.category.create({ data: { name: "Femme", slug: "femme", displayOrder: 2 } })).id;
    childId = (await prisma.category.create({ data: { name: "Jupes", slug: "jupes", parentId, displayOrder: 3 } })).id;
    otherId = (await prisma.category.create({ data: { name: "Homme", slug: "homme", displayOrder: 4 } })).id;

    const make = async (key: string, over: Record<string, unknown>) => {
      const p = await create({ slug: key, reference: `R-${key}`, name: `Produit ${key}`, ...over });
      ids[key] = p.id;
      return p;
    };
    // Créés dans cet ordre : « d » est le plus récent.
    await make("a", { categoryId: parentId, price: 3000, tags: ["laine"], variants: [variant("a-1", "Noir", "M", 5), variant("a-2", "Blanc", "L", 0)] });
    await make("b", { categoryId: childId, price: 9000, compareAtPrice: 12000, variants: [variant("b-1", "Blanc", "M", 0), variant("b-2", "Noir", "S", 2)] });
    await make("c", { categoryId: otherId, price: 6000, gender: "men", variants: [variant("c-1", "Noir", "L", 7)] });
    await make("d", { categoryId: catId, price: 1500, description: "Écharpe douce en cachemire", variants: [variant("d-1", "Blanc", "S", 0)] });
    await prisma.product.update({ where: { id: ids.c! }, data: { soldCount: 50 } });
    await prisma.product.update({ where: { id: ids.a! }, data: { soldCount: 10 } });
  });

  const slugs = (res: { body: { items: Product[] } }) => res.body.items.map((p) => p.slug);

  it("par défaut : nouveautés d'abord, format PaginatedResult", async () => {
    const res = await http().get("/api/products");
    expect(res.status).toBe(200);
    expect(slugs(res)).toEqual(["d", "c", "b", "a"]);
    expect(res.body).toMatchObject({ total: 4, page: 1, pageSize: 12, totalPages: 1 });
  });

  it("catégorie parente : inclut les produits des sous-catégories ; une sous-catégorie seule ne remonte pas", async () => {
    expect(slugs(await http().get("/api/products?category=femme"))).toEqual(["b", "a"]);
    expect(slugs(await http().get("/api/products?category=jupes"))).toEqual(["b"]);
    expect(slugs(await http().get("/api/products?category=homme"))).toEqual(["c"]);
    expect(slugs(await http().get("/api/products?category=inexistante"))).toEqual([]);
  });

  it("taille/couleur : seules les variantes EN STOCK comptent, combinées sur la même variante", async () => {
    // « a » : (Noir, M, 5) en stock et (Blanc, L) en rupture.
    expect(slugs(await http().get("/api/products?sizes=L"))).toEqual(["c"]);
    expect(slugs(await http().get("/api/products?sizes=M"))).toEqual(["a"]);
    expect(slugs(await http().get("/api/products?colors=Blanc"))).toEqual([]);
    expect(slugs(await http().get("/api/products?colors=Noir&sizes=S"))).toEqual(["b"]);
    expect(slugs(await http().get("/api/products?colors=Blanc&sizes=M"))).toEqual([]);
    expect(slugs(await http().get("/api/products?sizes=S,M"))).toEqual(["b", "a"]);
    expect(slugs(await http().get("/api/products?sizes=S&sizes=M"))).toEqual(["b", "a"]);
  });

  it("prix min/max, inStockOnly, recherche (sans accents), collection « sale »", async () => {
    expect(slugs(await http().get("/api/products?minPrice=3000&maxPrice=6000&sort=price_asc"))).toEqual(["a", "c"]);
    expect(slugs(await http().get("/api/products?inStockOnly=true"))).toEqual(["c", "b", "a"]);
    expect(slugs(await http().get("/api/products?search=echarpe"))).toEqual(["d"]);
    expect(slugs(await http().get("/api/products?search=LAINE"))).toEqual(["a"]);
    expect(slugs(await http().get("/api/products?collection=sale"))).toEqual(["b"]);
    expect(slugs(await http().get("/api/products?collection=new"))).toEqual(["d", "c", "b", "a"]);
  });

  it("tri : prix croissant/décroissant et popularité", async () => {
    expect(slugs(await http().get("/api/products?sort=price_asc"))).toEqual(["d", "a", "c", "b"]);
    expect(slugs(await http().get("/api/products?sort=price_desc"))).toEqual(["b", "c", "a", "d"]);
    expect(slugs(await http().get("/api/products?sort=popular"))).toEqual(["c", "a", "d", "b"]);
  });

  it("pagination : page, pageSize, totalPages, page hors bornes ramenée à la dernière", async () => {
    const p1 = await http().get("/api/products?pageSize=3&page=1&sort=price_asc");
    expect(slugs(p1)).toEqual(["d", "a", "c"]);
    expect(p1.body).toMatchObject({ total: 4, page: 1, pageSize: 3, totalPages: 2 });
    const p2 = await http().get("/api/products?pageSize=3&page=2&sort=price_asc");
    expect(slugs(p2)).toEqual(["b"]);
    const far = await http().get("/api/products?pageSize=3&page=99&sort=price_asc");
    expect(far.body.page).toBe(2);
    expect(slugs(far)).toEqual(["b"]);
  });

  it("paramètres vides ignorés, paramètres invalides ⇒ 400", async () => {
    expect(slugs(await http().get("/api/products?search=&category=&sizes=&minPrice=&sort="))).toEqual(["d", "c", "b", "a"]);
    for (const q of ["sort=nimporte", "minPrice=abc", "page=0", "pageSize=1000", "collection=x"]) {
      const res = await http().get(`/api/products?${q}`);
      expect(res.status, q).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
  });

  it("produits liés : score catégorie (3) + genre (1) + tags communs, puis popularité ; limite respectée", async () => {
    const related = await http().get(`/api/products/${ids.a}/related?limit=2`);
    expect(related.status).toBe(200);
    // a (femme, women, tag laine) : b = 1 (genre), d = 1 (genre), c = 0 mais 50 vendus ; égalité b/d départagée par l'ordre « plus récent d'abord ».
    expect(related.body).toHaveLength(2);
    expect(related.body.map((p: Product) => p.id)).not.toContain(ids.a);
    const all = await http().get(`/api/products/${ids.a}/related`);
    expect(all.body.map((p: Product) => p.slug)).toEqual(["d", "b", "c"]);
    expect(all.body.every((p: Product) => p.costPrice === 0)).toBe(true);
    expect((await http().get(`/api/products/${ids.a}/related?limit=0`)).status).toBe(400);
    expect((await http().get("/api/products/inconnu/related")).body).toEqual([]);
  });
});
