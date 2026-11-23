import { beforeEach, describe, expect, it } from "vitest";
import { adminAgent, http, prisma, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const day = 86_400_000;
const body = (over: Record<string, unknown> = {}) => ({
  code: "bienvenue10",
  label: "10 % pour une première commande",
  type: "percentage",
  value: 10,
  startsAt: new Date(Date.now() - day).toISOString(),
  endsAt: new Date(Date.now() + 30 * day).toISOString(),
  minOrderAmount: 5_000,
  isActive: true,
  ...over,
});

describe("promotions — administration", () => {
  it("exige une session", async () => {
    expect((await http().get("/api/admin/promotions")).status).toBe(401);
    expect((await http().post("/api/admin/promotions").send(body())).status).toBe(401);
    expect((await http().patch("/api/admin/promotions/x").send({})).status).toBe(401);
    expect((await http().delete("/api/admin/promotions/x")).status).toBe(401);
  });

  it("crée (code en majuscules, usage à 0), liste du plus récent au plus ancien", async () => {
    const agent = await adminAgent();
    const created = await agent.post("/api/admin/promotions").send(body());
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "BIENVENUE10", type: "percentage", value: 10, minOrderAmount: 5_000, isActive: true, usageCount: 0 });
    expect(created.body.id).toBeTruthy();
    expect(created.body.createdAt).toBeTruthy();

    const second = await agent.post("/api/admin/promotions").send(body({ code: "FIXE1500", type: "fixed", value: 1_500, minOrderAmount: 15_000 }));
    expect(second.status).toBe(201);
    const list = await agent.get("/api/admin/promotions");
    expect(list.body.map((p: { code: string }) => p.code)).toEqual(["FIXE1500", "BIENVENUE10"]);
  });

  it("refuse un code en double, insensible à la casse (création et modification)", async () => {
    const agent = await adminAgent();
    await agent.post("/api/admin/promotions").send(body({ code: "SOLDES20" }));
    const dup = await agent.post("/api/admin/promotions").send(body({ code: "soldes20" }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("CONFLICT");

    const other = await agent.post("/api/admin/promotions").send(body({ code: "AUTRE" }));
    const clash = await agent.patch(`/api/admin/promotions/${other.body.id}`).send({ code: "Soldes20" });
    expect(clash.status).toBe(409);
    // Garder son propre code (même casse différente) n'est pas un doublon.
    const same = await agent.patch(`/api/admin/promotions/${other.body.id}`).send({ code: "autre", label: "Nouveau libellé" });
    expect(same.status).toBe(200);
    expect(same.body).toMatchObject({ code: "AUTRE", label: "Nouveau libellé" });
  });

  it("crée sans doublon sous requêtes simultanées", async () => {
    const agent = await adminAgent();
    const results = await Promise.all(Array.from({ length: 5 }, () => agent.post("/api/admin/promotions").send(body({ code: "COURSE" }))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await prisma.promotion.count()).toBe(1);
  });

  it("valide avec promotionFormSchema : pourcentage > 100, valeur nulle, code invalide, dates inversées", async () => {
    const agent = await adminAgent();
    const bad: Array<Record<string, unknown>> = [
      { type: "percentage", value: 101 },
      { value: 0 },
      { value: 1.5 },
      { code: "ab" },
      { code: "code avec espaces" },
      { label: "x" },
      { minOrderAmount: -1 },
      { startsAt: new Date(Date.now() + 10 * day).toISOString(), endsAt: new Date(Date.now() + day).toISOString() },
      { startsAt: "pas-une-date" },
      { isActive: "oui" },
    ];
    for (const over of bad) {
      const res = await agent.post("/api/admin/promotions").send(body(over));
      expect(res.status, JSON.stringify(over)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
    expect(await prisma.promotion.count()).toBe(0);
  });

  it("modifie partiellement (revalidé en entier) et supprime", async () => {
    const agent = await adminAgent();
    const { body: promo } = await agent.post("/api/admin/promotions").send(body());

    const off = await agent.patch(`/api/admin/promotions/${promo.id}`).send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ isActive: false, code: "BIENVENUE10", value: 10 });

    const bad = await agent.patch(`/api/admin/promotions/${promo.id}`).send({ value: 150 });
    expect(bad.status).toBe(400);
    expect((await agent.patch(`/api/admin/promotions/${promo.id}`).send({ type: "fixed", value: 2_000 })).body).toMatchObject({ type: "fixed", value: 2_000 });
    expect((await agent.patch("/api/admin/promotions/inconnue").send({ isActive: true })).status).toBe(404);

    expect((await agent.delete(`/api/admin/promotions/${promo.id}`)).status).toBe(204);
    expect((await agent.delete(`/api/admin/promotions/${promo.id}`)).status).toBe(404);
    expect(await prisma.promotion.count()).toBe(0);
  });
});

describe("POST /api/promotions/validate (public)", () => {
  const seed = (over: Record<string, unknown> = {}) =>
    prisma.promotion.create({
      data: {
        code: "BIENVENUE10",
        label: "10 %",
        type: "percentage",
        value: 10,
        minOrderAmount: 5_000,
        startsAt: new Date(Date.now() - day),
        endsAt: new Date(Date.now() + day),
        usageCount: 14,
        ...over,
      },
    });
  const validate = (code: string, subtotal: number) => http().post("/api/promotions/validate").send({ code, subtotal });

  it("valide un code (insensible à la casse), calcule la remise et n'incrémente pas l'usage", async () => {
    await seed();
    const res = await validate("  bienvenue10 ", 20_000);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ valid: true, discount: 2_000, promotion: { code: "BIENVENUE10", label: "10 %", type: "percentage", value: 10 } });
    expect((await prisma.promotion.findUniqueOrThrow({ where: { code: "BIENVENUE10" } })).usageCount).toBe(14);
  });

  it("ne divulgue pas le compteur d'usage", async () => {
    await seed();
    const res = await validate("BIENVENUE10", 20_000);
    expect(res.body.promotion.usageCount).toBe(0);
  });

  it("plafonne un montant fixe au sous-total", async () => {
    await seed({ code: "FIXE", type: "fixed", value: 3_000, minOrderAmount: 0 });
    expect((await validate("FIXE", 2_000)).body).toMatchObject({ valid: true, discount: 2_000 });
  });

  it.each([
    ["inconnu", "NOPE", {}, /n'existe pas/],
    ["inactif", "OFF", { code: "OFF", isActive: false }, /plus actif/],
    ["expiré", "OLD", { code: "OLD", startsAt: new Date(Date.now() - 5 * day), endsAt: new Date(Date.now() - day) }, /expiré/],
    ["à venir", "SOON", { code: "SOON", startsAt: new Date(Date.now() + day), endsAt: new Date(Date.now() + 3 * day) }, /pas encore/],
    ["sous le minimum", "MIN", { code: "MIN", minOrderAmount: 50_000 }, /Montant minimum/],
  ])("code %s : valid=false avec la raison", async (_label, code, data, reason) => {
    if (code !== "NOPE") await seed(data);
    const res = await validate(code, 10_000);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(reason);
    expect(Object.keys(res.body).sort()).toEqual(["reason", "valid"]);
  });

  it("valide l'entrée (code vide, sous-total négatif ou non entier)", async () => {
    for (const bad of [{}, { code: "", subtotal: 1 }, { code: "X", subtotal: -1 }, { code: "X", subtotal: 1.5 }, { code: "X", subtotal: "12" }]) {
      const res = await http().post("/api/promotions/validate").send(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("n'expose aucune liste de promotions en public", async () => {
    await seed();
    expect((await http().get("/api/promotions")).status).toBe(404);
  });
});
