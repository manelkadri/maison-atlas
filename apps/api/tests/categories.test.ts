import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeProduct, orderBody } from "./api2-factories";
import { adminAgent, customerAgent, http, prisma, resetDatabase } from "./helpers";

type Agent = Awaited<ReturnType<typeof adminAgent>>;
let admin: Agent;

beforeAll(async () => {
  await resetDatabase();
  admin = await adminAgent();
});

beforeEach(async () => {
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

const body = (over: Record<string, unknown> = {}) => ({
  name: "Robes",
  slug: "robes",
  description: "Toutes les robes",
  imageUrl: "",
  kind: "category",
  parentId: null,
  displayOrder: 1,
  ...over,
});

async function create(over: Record<string, unknown> = {}) {
  const res = await admin.post("/api/admin/categories").send(body(over));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string; slug: string; isArchived: boolean; parentId: string | null };
}

describe("création et lecture", () => {
  it("crée une catégorie (201) au format Category de @fashion/types", async () => {
    const res = await admin.post("/api/admin/categories").send(body());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Robes",
      slug: "robes",
      description: "Toutes les robes",
      imageUrl: "",
      kind: "category",
      parentId: null,
      displayOrder: 1,
      isArchived: false,
    });
    expect(typeof res.body.id).toBe("string");
    expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
  });

  it("kind vaut « category » par défaut", async () => {
    const { kind: _k, ...withoutKind } = body({ slug: "sans-kind" });
    const res = await admin.post("/api/admin/categories").send(withoutKind);
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe("category");
  });

  it("refuse un slug en doublon (CONFLICT) et un slug invalide (VALIDATION)", async () => {
    await create();
    const dup = await admin.post("/api/admin/categories").send(body({ name: "Autre" }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("CONFLICT");
    const bad = await admin.post("/api/admin/categories").send(body({ slug: "Pas Valide!" }));
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION");
  });

  it("refuse un parent inexistant", async () => {
    const res = await admin.post("/api/admin/categories").send(body({ parentId: "inconnu" }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("public : liste triée par displayOrder, sans archivées ; admin : includeArchived", async () => {
    const b = await create({ name: "Cat B", slug: "b", displayOrder: 2 });
    await create({ name: "Cat A", slug: "a", displayOrder: 1 });
    const c = await create({ name: "Cat C", slug: "c", displayOrder: 3 });
    await admin.post(`/api/admin/categories/${c.id}/archive`).expect(204);

    const pub = await http().get("/api/categories");
    expect(pub.status).toBe(200);
    expect(pub.body.map((x: { slug: string }) => x.slug)).toEqual(["a", "b"]);

    const adminDefault = await admin.get("/api/admin/categories");
    expect(adminDefault.body.map((x: { slug: string }) => x.slug)).toEqual(["a", "b"]);
    const adminAll = await admin.get("/api/admin/categories?includeArchived=true");
    expect(adminAll.body.map((x: { slug: string }) => x.slug)).toEqual(["a", "b", "c"]);
    expect(b.id).toBeTruthy();
  });

  it("par slug : 200 si active, 404 si archivée ou inconnue", async () => {
    const a = await create({ slug: "actif" });
    expect((await http().get("/api/categories/by-slug/actif")).body.id).toBe(a.id);
    await admin.post(`/api/admin/categories/${a.id}/archive`).expect(204);
    expect((await http().get("/api/categories/by-slug/actif")).status).toBe(404);
    expect((await http().get("/api/categories/by-slug/nope")).status).toBe(404);
  });
});

describe("modification", () => {
  it("PATCH partiel : met à jour les champs reçus uniquement", async () => {
    const c = await create();
    const res = await admin.patch(`/api/admin/categories/${c.id}`).send({ name: "Robes d'été", displayOrder: 7 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Robes d'été", slug: "robes", displayOrder: 7 });
  });

  it("PATCH : slug en doublon ⇒ 409, mais garder son propre slug est permis", async () => {
    await create({ slug: "un" });
    const two = await create({ name: "Deux", slug: "deux" });
    expect((await admin.patch(`/api/admin/categories/${two.id}`).send({ slug: "un" })).status).toBe(409);
    expect((await admin.patch(`/api/admin/categories/${two.id}`).send({ slug: "deux", name: "Deux bis" })).status).toBe(200);
  });

  it("PATCH : pas de parent = soi-même, ni de boucle dans l'arbre", async () => {
    const a = await create({ slug: "a" });
    const b = await create({ slug: "b", parentId: a.id });
    const self = await admin.patch(`/api/admin/categories/${a.id}`).send({ parentId: a.id });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe("VALIDATION");
    const loop = await admin.patch(`/api/admin/categories/${a.id}`).send({ parentId: b.id });
    expect(loop.status).toBe(400);
    const ok = await admin.patch(`/api/admin/categories/${b.id}`).send({ parentId: null });
    expect(ok.status).toBe(200);
    expect(ok.body.parentId).toBeNull();
  });

  it("PATCH inconnu ⇒ 404", async () => {
    expect((await admin.patch("/api/admin/categories/nope").send({ name: "Xx" })).status).toBe(404);
  });

  it("PATCH { isArchived: true } archive comme la route dédiée, { isArchived: false } restaure", async () => {
    const parent = await create({ slug: "p" });
    const child = await create({ slug: "c", parentId: parent.id });
    const res = await admin.patch(`/api/admin/categories/${parent.id}`).send({ isArchived: true });
    expect(res.body.isArchived).toBe(true);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: child.id } })).isArchived).toBe(true);
    const back = await admin.patch(`/api/admin/categories/${parent.id}`).send({ isArchived: false });
    expect(back.body.isArchived).toBe(false);
  });
});

describe("archivage", () => {
  it("l'archivage cascade à tous les descendants ; la restauration ne touche que la catégorie visée", async () => {
    const root = await create({ slug: "root" });
    const child = await create({ slug: "child", parentId: root.id });
    const grand = await create({ slug: "grand", parentId: child.id });
    const sibling = await create({ slug: "sibling" });

    await admin.post(`/api/admin/categories/${root.id}/archive`).expect(204);
    const state = async (id: string) => (await prisma.category.findUniqueOrThrow({ where: { id } })).isArchived;
    expect(await state(root.id)).toBe(true);
    expect(await state(child.id)).toBe(true);
    expect(await state(grand.id)).toBe(true);
    expect(await state(sibling.id)).toBe(false);

    await admin.post(`/api/admin/categories/${child.id}/restore`).expect(204);
    expect(await state(child.id)).toBe(false);
    expect(await state(root.id)).toBe(true);
    expect(await state(grand.id)).toBe(true);
  });

  it("les collections sont verrouillées : jamais archivées (409), ni par la cascade", async () => {
    const parent = await create({ slug: "parent" });
    const collection = await create({ slug: "nouveautes", name: "Nouveautés", kind: "collection", parentId: parent.id });

    const direct = await admin.post(`/api/admin/categories/${collection.id}/archive`);
    expect(direct.status).toBe(409);
    expect(direct.body.error.code).toBe("CONFLICT");
    const viaPatch = await admin.patch(`/api/admin/categories/${collection.id}`).send({ isArchived: true });
    expect(viaPatch.status).toBe(409);

    await admin.post(`/api/admin/categories/${parent.id}/archive`).expect(204);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: collection.id } })).isArchived).toBe(false);
  });

  it("archive / restore d'une catégorie inconnue ⇒ 404", async () => {
    expect((await admin.post("/api/admin/categories/nope/archive")).status).toBe(404);
    expect((await admin.post("/api/admin/categories/nope/restore")).status).toBe(404);
  });
});

describe("suppression définitive", () => {
  const exists = async (id: string) => (await prisma.category.count({ where: { id } })) === 1;

  it("supprime une catégorie vide : 204, elle disparaît de la base et de la boutique", async () => {
    const cat = await create({ slug: "a-supprimer" });
    await admin.delete(`/api/admin/categories/${cat.id}`).expect(204);
    expect(await exists(cat.id)).toBe(false);
    const publicList = await http().get("/api/categories");
    expect(publicList.body.map((c: { id: string }) => c.id)).not.toContain(cat.id);
  });

  it("annonce l'impact (sous-catégories, produits archivés compris) puis supprime tout en cascade", async () => {
    const parent = await create({ slug: "femme", name: "Femme" });
    const child = await create({ slug: "robe", name: "Robe", parentId: parent.id });
    const product = await makeProduct({ categoryId: child.id, variants: [{ stock: 4 }, { stock: 2 }] });
    await makeProduct({ categoryId: child.id, isArchived: true });
    await prisma.stockMovement.create({
      data: { variantId: product.variants[0]!.id, type: "adjustment", quantityDelta: 4, quantityBefore: 0, quantityAfter: 4, reason: "test" },
    });

    const impact = await admin.get(`/api/admin/categories/${parent.id}/deletion-impact`);
    expect(impact.status).toBe(200);
    expect(impact.body).toEqual({ subcategories: 1, products: 2, orderedProducts: 0 });

    await admin.delete(`/api/admin/categories/${parent.id}`).expect(204);
    expect(await prisma.category.count()).toBe(0);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.productVariant.count()).toBe(0);
    expect(await prisma.productImage.count()).toBe(0);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("supprimer une sous-catégorie laisse le parent et ses autres produits intacts", async () => {
    const parent = await create({ slug: "femme", name: "Femme" });
    const child = await create({ slug: "robe", name: "Robe", parentId: parent.id });
    const keep = await makeProduct({ categoryId: parent.id });
    await makeProduct({ categoryId: child.id });

    await admin.delete(`/api/admin/categories/${child.id}`).expect(204);
    expect(await exists(parent.id)).toBe(true);
    expect(await exists(child.id)).toBe(false);
    expect(await prisma.product.findMany({ select: { id: true } })).toEqual([{ id: keep.id }]);
  });

  it("refuse tout (409) si un produit a déjà été commandé : rien n'est supprimé, il faut archiver", async () => {
    const parent = await create({ slug: "femme", name: "Femme" });
    const child = await create({ slug: "robe", name: "Robe", parentId: parent.id });
    const ordered = await makeProduct({ categoryId: child.id, variants: [{ stock: 5 }] });
    await makeProduct({ categoryId: child.id });
    const buyer = await customerAgent();
    await buyer.agent.post("/api/orders").send(orderBody([{ variantId: ordered.variants[0]!.id, quantity: 1 }])).expect(201);

    const impact = await admin.get(`/api/admin/categories/${parent.id}/deletion-impact`);
    expect(impact.body).toEqual({ subcategories: 1, products: 2, orderedProducts: 1 });

    const res = await admin.delete(`/api/admin/categories/${parent.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.message).toMatch(/commandes existantes.*archivez/);
    expect(await prisma.category.count()).toBe(2);
    expect(await prisma.product.count()).toBe(2);
    expect(await prisma.order.count()).toBe(1);
  });

  it("les collections système ne se suppriment pas (409), ni ne s'évaluent", async () => {
    const collection = await create({ slug: "new", name: "Nouveautés", kind: "collection" });
    expect((await admin.delete(`/api/admin/categories/${collection.id}`)).status).toBe(409);
    expect((await admin.get(`/api/admin/categories/${collection.id}/deletion-impact`)).status).toBe(409);
    expect(await exists(collection.id)).toBe(true);
  });

  it("catégorie inconnue ⇒ 404", async () => {
    expect((await admin.delete("/api/admin/categories/nope")).status).toBe(404);
    expect((await admin.get("/api/admin/categories/nope/deletion-impact")).status).toBe(404);
  });

  it("exige une session (401) et refuse une autre origine (403)", async () => {
    const cat = await create({ slug: "protegee" });
    expect((await http().delete(`/api/admin/categories/${cat.id}`)).status).toBe(401);
    expect((await http().get(`/api/admin/categories/${cat.id}/deletion-impact`)).status).toBe(401);
    const cross = await admin.delete(`/api/admin/categories/${cat.id}`).set("Origin", "https://site-malveillant.example");
    expect(cross.status).toBe(403);
    expect(await exists(cat.id)).toBe(true);
  });
});

describe("sécurité", () => {
  it("les écritures exigent une session", async () => {
    expect((await http().post("/api/admin/categories").send(body())).status).toBe(401);
    expect((await http().patch("/api/admin/categories/x").send({})).status).toBe(401);
    expect((await http().post("/api/admin/categories/x/archive")).status).toBe(401);
  });
});
