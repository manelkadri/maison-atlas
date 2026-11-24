import supertest from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { CUSTOMER_SESSION_COOKIE } from "../src/config/customer-auth";
import { makeProduct, orderBody, stockOf } from "./api2-factories";
import { ADMIN, CUSTOMER, adminAgent, createCustomerAccount, customerAgent, getApp, http, prisma, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const as = (token: string) => ({ Cookie: `${CUSTOMER_SESSION_COOKIE}=${token}` });

/** Tout ce qu'une commande modifierait : rien de cela ne doit bouger quand elle est refusée. */
async function footprint(variantId: string) {
  return {
    stock: await stockOf(variantId),
    orders: await prisma.order.count(),
    items: await prisma.orderItem.count(),
    movements: await prisma.stockMovement.count(),
    customers: await prisma.customer.count(),
    promoUsage: (await prisma.promotion.findMany({ select: { usageCount: true } })).map((p) => p.usageCount),
    sold: (await prisma.product.findMany({ select: { soldCount: true } })).map((p) => p.soldCount),
  };
}

async function setup() {
  const product = await makeProduct({ price: 10_000, variants: [{ stock: 5 }] });
  await prisma.promotion.create({
    data: { code: "MOINS10", label: "10 %", type: "percentage", value: 10, startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000) },
  });
  return { variantId: product.variants[0]!.id };
}

describe("POST /api/orders : réservé aux clientes connectées", () => {
  it("sans session : 401, et RIEN n'est créé ni modifié (stock, commande, mouvement, client, code promo, ventes)", async () => {
    const { variantId } = await setup();
    const before = await footprint(variantId);
    const res = await http().post("/api/orders").send(orderBody([{ variantId, quantity: 2 }], { promoCode: "MOINS10" }));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHENTICATED", message: "Connexion requise." } });
    expect(await footprint(variantId)).toEqual(before);
  });

  it("jeton forgé, mal formé, expiré, révoqué ou session admin : toujours 401, rien n'est créé", async () => {
    const { variantId } = await setup();
    const body = orderBody([{ variantId, quantity: 1 }]);
    const live = await customerAgent();
    const expired = await customerAgent({ phone: "0661 00 00 02", phoneKey: "0661000002" });
    await prisma.customerSession.updateMany({ where: { customerId: expired.customer.id }, data: { createdAt: new Date(Date.now() - 2000), expiresAt: new Date(Date.now() - 1000) } });
    await supertest(getApp()).post("/api/customers/logout").set(as(live.token)); // la session est révoquée
    const before = await footprint(variantId); // mesuré APRÈS la création des comptes de test

    const attempts: Array<[string, Record<string, string>]> = [
      ["jeton inventé", as("A".repeat(43))],
      ["jeton mal formé", as("pas-un-jeton")],
      ["session expirée", as(expired.token)],
      ["session révoquée (déconnexion)", as(live.token)],
      ["cookie vide", { Cookie: `${CUSTOMER_SESSION_COOKIE}=` }],
    ];
    for (const [label, headers] of attempts) {
      const res = await supertest(getApp()).post("/api/orders").set(headers).send(body);
      expect(res.status, label).toBe(401);
    }
    const admin = await adminAgent();
    expect((await admin.post("/api/orders").send(body)).status).toBe(401); // une session ADMIN n'est pas une session de cliente
    expect(await footprint(variantId)).toEqual(before);
  });

  it("avec une session valide : 201, rattachée au compte, vue cliente sans prix de revient", async () => {
    const { variantId } = await setup();
    const { agent, customer } = await customerAgent();
    const res = await agent.post("/api/orders").send(orderBody([{ variantId, quantity: 1 }]));
    expect(res.status).toBe(201);
    expect(res.body.customer.customerId).toBe(customer.id);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
    expect(JSON.stringify(res.body)).not.toContain("unitCost");
    expect(await stockOf(variantId)).toBe(4);
  });

  it("mot de passe provisoire non changé : 403 PASSWORD_CHANGE_REQUIRED (contrôlé par le serveur), rien n'est créé ; après changement : 201", async () => {
    const { variantId } = await setup();
    const { agent, customer } = await customerAgent();
    await prisma.customer.update({ where: { id: customer.id }, data: { mustChangePassword: true } });
    const before = await footprint(variantId);

    const blocked = await agent.post("/api/orders").send(orderBody([{ variantId, quantity: 1 }]));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(await footprint(variantId)).toEqual(before);

    const changed = await agent.post("/api/customers/me/password").send({ currentPassword: CUSTOMER.password, newPassword: "un-vrai-mot-de-passe-perso" });
    expect(changed.status).toBe(200);
    const fresh = /^customer_session=([^;]*)/.exec((changed.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("customer_session=")) ?? "")?.[1] ?? "";
    const ok = await supertest(getApp()).post("/api/orders").set(as(fresh)).send(orderBody([{ variantId, quantity: 1 }]));
    expect(ok.status).toBe(201);
  }, 60_000);

  it("une origine étrangère est refusée (CSRF, 403) même avec une session valide : aucune commande", async () => {
    const { variantId } = await setup();
    const { agent } = await customerAgent();
    const before = await footprint(variantId);
    const res = await agent.post("/api/orders").set("Origin", "https://site-malveillant.example").send(orderBody([{ variantId, quantity: 1 }]));
    expect(res.status).toBe(403);
    expect(await footprint(variantId)).toEqual(before);
  });

  it("la validation reste appliquée aux clientes connectées (400) et ne consomme rien", async () => {
    const { variantId } = await setup();
    const { agent } = await customerAgent();
    const before = await footprint(variantId);
    for (const body of [{}, orderBody([]), orderBody([{ variantId, quantity: 0 }]), orderBody([{ variantId, quantity: 1 }], { customer: { firstName: "A", lastName: "B", phone: "123" } })]) {
      expect((await agent.post("/api/orders").send(body)).status).toBe(400);
    }
    expect(await footprint(variantId)).toEqual(before);
  });

  it("la suppression du compte invalide aussitôt la session : plus de commande possible", async () => {
    const { variantId } = await setup();
    const { agent, customer } = await customerAgent();
    await prisma.customer.delete({ where: { id: customer.id } });
    expect((await agent.post("/api/orders").send(orderBody([{ variantId, quantity: 1 }]))).status).toBe(401);
  });

  it("les visiteuses non connectées gardent l'accès au catalogue, aux paramètres et au suivi public", async () => {
    for (const path of ["/api/products", "/api/categories", "/api/settings"]) expect((await http().get(path)).status, path).toBe(200);
    expect((await http().get("/api/orders/track").query({ number: "CMD-2026-000001", phone: "0555123456" })).status).toBe(404); // route ouverte, simplement introuvable
    // et le panier n'a besoin d'aucune route serveur : seule la commande exige la connexion
    const customer = await createCustomerAccount();
    expect(customer.phoneKey).toBe(CUSTOMER.phoneKey);
    expect(ADMIN.email).toBeTruthy();
  });
});
