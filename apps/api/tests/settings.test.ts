import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/modules/settings/defaults";
import { adminAgent, http, prisma, resetDatabase } from "./helpers";

type Agent = Awaited<ReturnType<typeof adminAgent>>;
let admin: Agent;

beforeAll(async () => {
  await resetDatabase();
  admin = await adminAgent();
});

describe("GET /api/settings (public)", () => {
  it("crée la ligne unique avec les valeurs par défaut si elle est absente", async () => {
    expect(await prisma.storeSettings.count()).toBe(0);
    const res = await http().get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DEFAULT_SETTINGS);
    expect(res.body.currency).toBe("DZD");
    expect(await prisma.storeSettings.count()).toBe(1);
    // Deuxième appel : toujours une seule ligne.
    await http().get("/api/settings").expect(200);
    expect(await prisma.storeSettings.count()).toBe(1);
  });
});

describe("PATCH /api/admin/settings", () => {
  it("exige une session", async () => {
    expect((await http().patch("/api/admin/settings").send({ tagline: "x" })).status).toBe(401);
  });

  it("modifie partiellement et conserve le reste", async () => {
    const res = await admin.patch("/api/admin/settings").send({ storeName: "Maison Atlas Plus", freeShippingThreshold: 10000 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...DEFAULT_SETTINGS, storeName: "Maison Atlas Plus", freeShippingThreshold: 10000 });
    const read = await http().get("/api/settings");
    expect(read.body.storeName).toBe("Maison Atlas Plus");
    expect(read.body.shippingFees).toEqual(DEFAULT_SETTINGS.shippingFees);
  });

  it("met à jour les objets imbriqués (tarifs, réseaux sociaux)", async () => {
    const shippingFees = { ...DEFAULT_SETTINGS.shippingFees, "1": { home: 500, pickupPoint: 350 } };
    const res = await admin.patch("/api/admin/settings").send({ shippingFees, social: { instagram: "https://instagram.com/x", tiktok: "" } });
    expect(res.status).toBe(200);
    expect(res.body.shippingFees["1"]).toEqual({ home: 500, pickupPoint: 350 });
    expect(res.body.social).toEqual({ instagram: "https://instagram.com/x", tiktok: "" });
  });

  it("accepte l'objet complet renvoyé par le client (devise DZD ignorée) et un patch vide", async () => {
    const current = (await http().get("/api/settings")).body;
    const full = await admin.patch("/api/admin/settings").send(current);
    expect(full.status).toBe(200);
    expect(full.body).toEqual(current);
    const empty = await admin.patch("/api/admin/settings").send({});
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual(current);
  });

  it("ne permet jamais de changer la devise", async () => {
    const res = await admin.patch("/api/admin/settings").send({ currency: "EUR" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect((await http().get("/api/settings")).body.currency).toBe("DZD");
  });

  it("valide les champs comme le formulaire d'administration", async () => {
    const bad: Array<Record<string, unknown>> = [
      { phone: "12345" },
      { email: "pas-un-email" },
      { storeName: "A" },
      { whatsapp: "abc" },
      { freeShippingThreshold: -1 },
      { defaultAlertThreshold: 1.5 },
      { shippingFees: { "1": { home: -5, pickupPoint: 1 }, "2": { home: 1, pickupPoint: 1 }, "3": { home: 1, pickupPoint: 1 } } },
      { social: { instagram: "x" } },
    ];
    for (const patch of bad) {
      const res = await admin.patch("/api/admin/settings").send(patch);
      expect(res.status, JSON.stringify(patch)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
  });

  it("permet de vider le WhatsApp (bouton masqué) et ignore les clés inconnues", async () => {
    const res = await admin.patch("/api/admin/settings").send({ whatsapp: "", id: 99, evil: "x" });
    expect(res.status).toBe(200);
    expect(res.body.whatsapp).toBe("");
    expect(res.body).not.toHaveProperty("evil");
    expect(await prisma.storeSettings.count()).toBe(1);
    expect((await prisma.storeSettings.findFirstOrThrow()).id).toBe(1);
  });
});
