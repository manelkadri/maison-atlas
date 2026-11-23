import { beforeEach, describe, expect, it } from "vitest";
import { adminAgent, http, prisma, resetDatabase } from "./helpers";
import { makeProduct, orderBody } from "./api2-factories";

beforeEach(resetDatabase);

type Agent = Awaited<ReturnType<typeof adminAgent>>;
const place = async (variantId: string, quantity: number, phone: string, name = "Client") =>
  (await http().post("/api/orders").send(orderBody([{ variantId, quantity }], { customer: { firstName: name, lastName: "Test", phone } }))).body as {
    id: string;
    customer: { customerId: string };
    subtotal: number;
  };
const status = (agent: Agent, id: string, s: string) => agent.patch(`/api/admin/orders/${id}/status`).send({ status: s });
async function deliver(agent: Agent, id: string) {
  for (const s of ["confirmed", "processing", "shipped", "delivered"]) await status(agent, id, s);
}

describe("clients", () => {
  it("exige une session", async () => {
    expect((await http().get("/api/admin/customers")).status).toBe(401);
    expect((await http().get("/api/admin/customers/x")).status).toBe(401);
  });

  it("agrège commandes, total dépensé (LIVRÉ hors livraison, remise déduite) et dernière commande", async () => {
    const product = await makeProduct({ price: 10_000, variants: [{ stock: 50 }] });
    const v = product.variants[0]!.id;
    await prisma.promotion.create({
      data: { code: "MOINS10", label: "10 %", type: "percentage", value: 10, startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000) },
    });
    const agent = await adminAgent();

    // Amina : 1 livrée (2 × 10 000 − 10 % = 18 000), 1 annulée, 1 en attente.
    const a1 = (await http().post("/api/orders").send(orderBody([{ variantId: v, quantity: 2 }], { promoCode: "MOINS10" }))).body;
    const a2 = await place(v, 1, "0555 12 34 56");
    const a3 = await place(v, 1, "0555123456");
    // Karim : une seule commande en attente.
    const k1 = await place(v, 1, "0661 22 33 44", "Karim");
    await deliver(agent, a1.id);
    await status(agent, a2.id, "cancelled");

    const list = await agent.get("/api/admin/customers");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    const amina = list.body.find((c: { id: string }) => c.id === a1.customer.customerId);
    const karim = list.body.find((c: { id: string }) => c.id === k1.customer.customerId);
    expect(amina).toMatchObject({ ordersCount: 3, totalSpent: 18_000, isGuest: true, phone: "0555 12 34 56" });
    expect(amina.lastOrderAt).toBeTruthy();
    expect(new Date(amina.lastOrderAt).getTime()).toBeGreaterThanOrEqual(new Date((await agent.get(`/api/admin/orders/${a3.id}`)).body.createdAt).getTime());
    expect(karim).toMatchObject({ ordersCount: 1, totalSpent: 0 });

    // Le détail donne les mêmes chiffres + les commandes, plus récentes d'abord.
    const detail = await agent.get(`/api/admin/customers/${a1.customer.customerId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.customer).toMatchObject({ ordersCount: 3, totalSpent: 18_000, lastOrderAt: amina.lastOrderAt });
    expect(detail.body.orders.map((o: { id: string }) => o.id)).toEqual([a3.id, a2.id, a1.id]);
    expect(detail.body.orders[2].statusHistory.length).toBe(5);
  });

  it("un client sans commande a des totaux à zéro ; client inconnu = 404", async () => {
    const c = await prisma.customer.create({
      data: { firstName: "Nora", lastName: "Seul", phone: "0770 00 00 01", phoneKey: "0770000001", wilayaCode: "16", commune: "Alger", email: "nora@example.com", isGuest: false },
    });
    const agent = await adminAgent();
    const list = await agent.get("/api/admin/customers");
    expect(list.body).toEqual([expect.objectContaining({ id: c.id, ordersCount: 0, totalSpent: 0, lastOrderAt: null, email: "nora@example.com", isGuest: false })]);
    const detail = await agent.get(`/api/admin/customers/${c.id}`);
    expect(detail.body.orders).toEqual([]);
    expect((await agent.get("/api/admin/customers/inconnu")).status).toBe(404);
  });

  it("n'expose aucune recherche de client par téléphone en public", async () => {
    await prisma.customer.create({ data: { firstName: "N", lastName: "S", phone: "0770000001", phoneKey: "0770000001", wilayaCode: "16", commune: "Alger" } });
    for (const path of ["/api/customers", "/api/customers?phone=0770000001", "/api/customers/by-phone/0770000001"]) {
      expect((await http().get(path)).status, path).toBe(404);
    }
  });
});
