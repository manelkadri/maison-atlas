import { beforeEach, describe, expect, it } from "vitest";
import { customerAgent, prisma, resetDatabase } from "./helpers";
import { makeProduct, orderBody, stockOf } from "./api2-factories";

beforeEach(resetDatabase);

/** N clientes connectées distinctes (comptes et sessions créés directement en base). */
async function customers(n: number, prefix: string) {
  return Promise.all(
    Array.from({ length: n }, (_, i) =>
      customerAgent({ phone: `${prefix}${String(10_000_000 + i)}`, phoneKey: `${prefix}${String(10_000_000 + i)}`, firstName: "Client", lastName: `N${i}` }),
    ),
  );
}

describe("concurrence sur le dernier stock", () => {
  it("15 commandes simultanées sur une variante au stock 5 : exactement 5 réussissent", async () => {
    const product = await makeProduct({ price: 10_000, variants: [{ stock: 5 }] });
    const variant = product.variants[0]!;

    const buyers = await customers(15, "05");
    const results = await Promise.all(
      buyers.map(({ agent }, i) =>
        agent.post("/api/orders").send(orderBody([{ variantId: variant.id, quantity: 1 }], { customer: { firstName: "Client", lastName: `N${i}`, phone: `05${String(10_000_000 + i)}` } })),
      ),
    );

    const ok = results.filter((r) => r.status === 201);
    const refused = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(5);
    expect(refused).toHaveLength(10);
    expect(refused.every((r) => r.body.error.code === "OUT_OF_STOCK")).toBe(true);
    expect(results.filter((r) => r.status >= 500)).toHaveLength(0);

    expect(await stockOf(variant.id)).toBe(0);
    expect(await prisma.order.count()).toBe(5);
    expect(new Set(ok.map((r) => r.body.orderNumber)).size).toBe(5); // numéros tous distincts
    const sales = await prisma.stockMovement.findMany({ where: { variantId: variant.id, type: "sale" }, orderBy: { quantityAfter: "desc" } });
    expect(sales).toHaveLength(5);
    // Chaîne de mouvements sans trou : 5→4, 4→3, …, 1→0.
    expect(sales.map((m) => [m.quantityBefore, m.quantityAfter])).toEqual([[5, 4], [4, 3], [3, 2], [2, 1], [1, 0]]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(5);
  });

  it("des commandes multi-lignes croisées ne s'interbloquent pas et ne survendent jamais", async () => {
    const a = await makeProduct({ variants: [{ stock: 6 }] });
    const b = await makeProduct({ variants: [{ stock: 6 }] });
    const va = a.variants[0]!.id;
    const vb = b.variants[0]!.id;

    const buyers = await customers(12, "06");
    const results = await Promise.all(
      buyers.map(({ agent }, i) =>
        agent
          .post("/api/orders")
          .send(
            orderBody(i % 2 === 0 ? [{ variantId: va, quantity: 2 }, { variantId: vb, quantity: 1 }] : [{ variantId: vb, quantity: 2 }, { variantId: va, quantity: 1 }], {
              customer: { firstName: "Client", lastName: `N${i}`, phone: `06${String(20_000_000 + i)}` },
            }),
          ),
      ),
    );
    expect(results.filter((r) => r.status >= 500)).toHaveLength(0);
    const ok = results.filter((r) => r.status === 201);
    expect(await stockOf(va)).toBeGreaterThanOrEqual(0);
    expect(await stockOf(vb)).toBeGreaterThanOrEqual(0);
    // Chaque commande réussie a consommé 3 pièces au total (2 + 1) : le stock restant le prouve.
    expect(await stockOf(va)).toBe(6 - ok.reduce((s, r) => s + (r.body.items.find((it: { variantId: string }) => it.variantId === va)?.quantity ?? 0), 0));
    expect(await stockOf(vb)).toBe(6 - ok.reduce((s, r) => s + (r.body.items.find((it: { variantId: string }) => it.variantId === vb)?.quantity ?? 0), 0));
    expect(ok.length).toBeGreaterThan(0);
  });

  it("6 commandes simultanées de la même cliente : toutes rattachées à son compte, aucune fiche créée", async () => {
    const product = await makeProduct({ variants: [{ stock: 10 }] });
    const { agent, customer } = await customerAgent();
    const results = await Promise.all(Array.from({ length: 6 }, () => agent.post("/api/orders").send(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }]))));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await prisma.customer.count()).toBe(1);
    expect(new Set(results.map((r) => r.body.customer.customerId))).toEqual(new Set([customer.id]));
    expect(await stockOf(product.variants[0]!.id)).toBe(4);
  });
});
