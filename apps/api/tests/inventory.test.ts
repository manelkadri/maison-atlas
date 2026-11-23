import { beforeEach, describe, expect, it } from "vitest";
import { adminAgent, http, prisma, resetDatabase } from "./helpers";
import { makeProduct, stockOf } from "./api2-factories";

beforeEach(resetDatabase);

type Agent = Awaited<ReturnType<typeof adminAgent>>;
const move = (agent: Agent, body: Record<string, unknown>) =>
  agent.post("/api/admin/inventory/movements").send({ reason: "Motif de test", ...body });

describe("inventaire — protection", () => {
  it("exige une session", async () => {
    expect((await http().get("/api/admin/inventory")).status).toBe(401);
    expect((await http().get("/api/admin/inventory/movements")).status).toBe(401);
    expect((await http().post("/api/admin/inventory/movements").send({})).status).toBe(401);
  });
});

describe("GET /api/admin/inventory", () => {
  it("liste les variantes avec leur statut, hors produits archivés, et applique les filtres", async () => {
    const robe = await makeProduct({
      name: "Robe satinée",
      variants: [
        { color: "Noir", size: "S", stock: 0 },
        { color: "Noir", size: "M", stock: 2, alertThreshold: 3 },
        { color: "Rouge", size: "M", stock: 20 },
      ],
    });
    const veste = await makeProduct({ name: "Veste en jean", variants: [{ color: "Bleu", size: "L", stock: 9 }] });
    await makeProduct({ name: "Ancien produit", isArchived: true, variants: [{ stock: 0 }] });
    const agent = await adminAgent();

    const all = await agent.get("/api/admin/inventory");
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(4); // l'archivé est exclu
    const byColorSize = (color: string, size: string) => all.body.find((i: { color: string; size: string }) => i.color === color && i.size === size);
    expect(byColorSize("Noir", "S")).toMatchObject({ status: "out_of_stock", stock: 0, productName: "Robe satinée", productId: robe.id });
    expect(byColorSize("Noir", "M")).toMatchObject({ status: "low", stock: 2 });
    expect(byColorSize("Rouge", "M")).toMatchObject({ status: "available", stock: 20, colorCode: "#000000" });
    expect(byColorSize("Bleu", "L").imageUrl).toContain("/img/");

    const q = async (query: Record<string, string>) => ((await agent.get("/api/admin/inventory").query(query)).body as Array<{ variantId: string }>).length;
    expect(await q({ status: "out_of_stock" })).toBe(1);
    expect(await q({ status: "low" })).toBe(1);
    expect(await q({ status: "available" })).toBe(2);
    expect(await q({ status: "all" })).toBe(4);
    expect(await q({ productId: robe.id })).toBe(3);
    expect(await q({ color: "Noir" })).toBe(2);
    expect(await q({ size: "M" })).toBe(2);
    expect(await q({ search: "VESTE" })).toBe(1);
    expect(await q({ search: veste.variants[0]!.sku.toLowerCase() })).toBe(1);
    expect(await q({ search: "ancien" })).toBe(0);
    expect((await agent.get("/api/admin/inventory").query({ status: "zzz" })).status).toBe(400);
  });
});

describe("POST /api/admin/inventory/movements", () => {
  it("entrée : ajoute au stock, une ligne avec avant/après exacts", async () => {
    const p = await makeProduct({ variants: [{ stock: 4 }] });
    const v = p.variants[0]!;
    const agent = await adminAgent();
    const res = await move(agent, { variantId: v.id, type: "in", quantity: 6, reason: "Réception fournisseur" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      sku: v.sku,
      type: "in",
      quantityDelta: 6,
      quantityBefore: 4,
      quantityAfter: 10,
      reason: "Réception fournisseur",
    });
    expect(await stockOf(v.id)).toBe(10);
    expect(await prisma.stockMovement.count({ where: { variantId: v.id } })).toBe(1);
  });

  it("sortie : retire, mais refuse (OUT_OF_STOCK) au-delà du stock sans rien modifier", async () => {
    const p = await makeProduct({ variants: [{ stock: 5 }] });
    const v = p.variants[0]!;
    const agent = await adminAgent();

    const ok = await move(agent, { variantId: v.id, type: "out", quantity: 5, reason: "Casse en entrepôt" });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ quantityDelta: -5, quantityBefore: 5, quantityAfter: 0 });

    const refused = await move(agent, { variantId: v.id, type: "out", quantity: 1 });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatchObject({ code: "OUT_OF_STOCK", message: "Impossible de retirer 1 pièce(s) : le stock actuel est de 0." });
    expect(await stockOf(v.id)).toBe(0);
    expect(await prisma.stockMovement.count({ where: { variantId: v.id } })).toBe(1);
  });

  it("retour : réintègre au stock", async () => {
    const p = await makeProduct({ variants: [{ stock: 1 }] });
    const agent = await adminAgent();
    const res = await move(agent, { variantId: p.variants[0]!.id, type: "return", quantity: 2, reason: "Retour client" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: "return", quantityDelta: 2, quantityAfter: 3 });
  });

  it("ajustement : quantité ABSOLUE (delta calculé), refusé s'il est sans effet", async () => {
    const p = await makeProduct({ variants: [{ stock: 8 }] });
    const v = p.variants[0]!;
    const agent = await adminAgent();

    const down = await move(agent, { variantId: v.id, type: "adjustment", quantity: 3, reason: "Inventaire annuel" });
    expect(down.body).toMatchObject({ type: "adjustment", quantityDelta: -5, quantityBefore: 8, quantityAfter: 3 });
    expect(await stockOf(v.id)).toBe(3);

    const up = await move(agent, { variantId: v.id, type: "adjustment", quantity: 12, reason: "Inventaire annuel" });
    expect(up.body).toMatchObject({ quantityDelta: 9, quantityBefore: 3, quantityAfter: 12 });

    const noop = await move(agent, { variantId: v.id, type: "adjustment", quantity: 12, reason: "Inventaire annuel" });
    expect(noop.status).toBe(400);
    expect(noop.body.error).toMatchObject({ code: "VALIDATION", message: "L'ajustement ne change pas le stock actuel." });

    const toZero = await move(agent, { variantId: v.id, type: "adjustment", quantity: 0, reason: "Rupture constatée" });
    expect(toZero.status).toBe(201);
    expect(await stockOf(v.id)).toBe(0);
  });

  it("valide les entrées : quantité, type, motif, date future, variante inconnue", async () => {
    const p = await makeProduct({ variants: [{ stock: 5 }] });
    const id = p.variants[0]!.id;
    const agent = await adminAgent();

    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const cases: Array<[string, Record<string, unknown>, number, string]> = [
      ["quantité 0 sur une entrée", { variantId: id, type: "in", quantity: 0 }, 400, "VALIDATION"],
      ["quantité négative", { variantId: id, type: "in", quantity: -3 }, 400, "VALIDATION"],
      ["quantité décimale", { variantId: id, type: "in", quantity: 1.5 }, 400, "VALIDATION"],
      ["quantité texte", { variantId: id, type: "in", quantity: "2" }, 400, "VALIDATION"],
      ["type sale interdit", { variantId: id, type: "sale", quantity: 1 }, 400, "VALIDATION"],
      ["type initial interdit", { variantId: id, type: "initial", quantity: 1 }, 400, "VALIDATION"],
      ["motif trop court", { variantId: id, type: "in", quantity: 1, reason: "x" }, 400, "VALIDATION"],
      ["date future", { variantId: id, type: "in", quantity: 1, date: future }, 400, "VALIDATION"],
      ["date invalide", { variantId: id, type: "in", quantity: 1, date: "pas-une-date" }, 400, "VALIDATION"],
      ["variante inconnue", { variantId: "inconnue", type: "in", quantity: 1 }, 404, "NOT_FOUND"],
    ];
    for (const [label, body, status, code] of cases) {
      const res = await move(agent, body);
      expect(res.status, label).toBe(status);
      expect(res.body.error.code, label).toBe(code);
    }
    expect(await stockOf(id)).toBe(5);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("respecte la date passée fournie (et en rejette une future)", async () => {
    const p = await makeProduct({ variants: [{ stock: 5 }] });
    const agent = await adminAgent();
    const res = await move(agent, { variantId: p.variants[0]!.id, type: "in", quantity: 1, date: "2026-01-15T09:00:00.000Z" });
    expect(res.status).toBe(201);
    expect(res.body.createdAt).toBe("2026-01-15T09:00:00.000Z");
  });

  it("deux sorties simultanées ne dépassent jamais le stock (verrou de ligne)", async () => {
    const p = await makeProduct({ variants: [{ stock: 5 }] });
    const v = p.variants[0]!;
    const agent = await adminAgent();
    const results = await Promise.all(Array.from({ length: 4 }, () => move(agent, { variantId: v.id, type: "out", quantity: 2 })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === "OUT_OF_STOCK")).toBe(true);
    expect(await stockOf(v.id)).toBe(1);
    const rows = await prisma.stockMovement.findMany({ where: { variantId: v.id }, orderBy: { quantityAfter: "desc" } });
    expect(rows.map((m) => [m.quantityBefore, m.quantityAfter])).toEqual([[5, 3], [3, 1]]);
  });
});

describe("GET /api/admin/inventory/movements", () => {
  it("renvoie les mouvements du plus récent au plus ancien, filtrés par variante ou produit", async () => {
    const p = await makeProduct({ variants: [{ stock: 10 }, { stock: 10 }] });
    const other = await makeProduct({ variants: [{ stock: 10 }] });
    const [v1, v2] = p.variants;
    const agent = await adminAgent();
    await move(agent, { variantId: v1!.id, type: "in", quantity: 1, date: "2026-01-01T10:00:00.000Z", reason: "premier" });
    await move(agent, { variantId: v2!.id, type: "in", quantity: 1, date: "2026-01-03T10:00:00.000Z", reason: "troisième" });
    await move(agent, { variantId: v1!.id, type: "out", quantity: 1, date: "2026-01-02T10:00:00.000Z", reason: "deuxième" });
    await move(agent, { variantId: other.variants[0]!.id, type: "in", quantity: 1, date: "2026-01-04T10:00:00.000Z", reason: "autre produit" });

    const reasons = async (q: Record<string, string> = {}) => ((await agent.get("/api/admin/inventory/movements").query(q)).body as Array<{ reason: string }>).map((m) => m.reason);
    expect(await reasons()).toEqual(["autre produit", "troisième", "deuxième", "premier"]);
    expect(await reasons({ variantId: v1!.id })).toEqual(["deuxième", "premier"]);
    expect(await reasons({ productId: p.id })).toEqual(["troisième", "deuxième", "premier"]);
    expect(await reasons({ productId: p.id, variantId: v2!.id })).toEqual(["troisième"]);
  });
});
