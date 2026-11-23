import { beforeEach, describe, expect, it } from "vitest";
import { adminAgent, http, prisma, resetDatabase } from "./helpers";
import { makeProduct, orderBody, stockOf } from "./api2-factories";

beforeEach(resetDatabase);

const post = (body: unknown) => http().post("/api/orders").send(body as object);

describe("POST /api/orders — création nominale", () => {
  it("crée la commande, fige les prix, décrémente le stock et historise", async () => {
    const product = await makeProduct({ price: 10_000, costPrice: 4_000, variants: [{ stock: 10 }, { stock: 5, price: 12_000 }] });
    const [v1, v2] = product.variants;

    const res = await post(orderBody([{ variantId: v1!.id, quantity: 2 }, { variantId: v2!.id, quantity: 1 }], { customerNote: "Appeler avant." }));
    expect(res.status).toBe(201);
    const order = res.body;

    // Totaux : 2×10 000 + 12 000 = 32 000 ; Alger (zone 1) à domicile = 450 ; total = 32 450.
    expect(order.subtotal).toBe(32_000);
    expect(order.discountTotal).toBe(0);
    expect(order.shippingFee).toBe(450);
    expect(order.total).toBe(32_450);
    expect(order.status).toBe("pending");
    expect(order.paymentStatus).toBe("pending");
    expect(order.paymentMethod).toBe("cash_on_delivery");
    expect(order.customerNote).toBe("Appeler avant.");
    expect(order.shippingAddress).toMatchObject({ wilayaCode: "16", wilayaName: "Alger", deliveryMethod: "home" });
    expect(order.orderNumber).toMatch(/^CMD-\d{4}-\d{6}$/);
    expect(order.statusHistory).toHaveLength(1);
    expect(order.statusHistory[0].status).toBe("pending");

    // Lignes figées : prix, coût, nom, SKU, image.
    expect(order.items).toHaveLength(2);
    expect(order.items[0]).toMatchObject({ variantId: v1!.id, unitPrice: 10_000, unitCost: 4_000, quantity: 2, lineTotal: 20_000, sku: v1!.sku, productName: product.name });
    expect(order.items[0].imageUrl).toContain("/img/");
    expect(order.items[1]).toMatchObject({ variantId: v2!.id, unitPrice: 12_000, lineTotal: 12_000 });

    // Stock, ventes et mouvements.
    expect(await stockOf(v1!.id)).toBe(8);
    expect(await stockOf(v2!.id)).toBe(4);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(3);
    const movements = await prisma.stockMovement.findMany({ where: { reference: order.orderNumber }, orderBy: { quantityDelta: "asc" } });
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.type === "sale")).toBe(true);
    expect(movements.find((m) => m.variantId === v1!.id)).toMatchObject({ quantityDelta: -2, quantityBefore: 10, quantityAfter: 8 });
    expect(movements.find((m) => m.variantId === v2!.id)).toMatchObject({ quantityDelta: -1, quantityBefore: 5, quantityAfter: 4 });
  });

  it("numérote chaque commande avec le compteur séquentiel", async () => {
    const product = await makeProduct({ variants: [{ stock: 10 }] });
    const a = await post(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }]));
    const b = await post(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }]));
    const seq = (n: string) => Number(n.slice(-6));
    expect(seq(b.body.orderNumber)).toBe(seq(a.body.orderNumber) + 1);
  });

  it("garde le prix de la commande même si le prix change ensuite", async () => {
    const product = await makeProduct({ price: 9_000, variants: [{ stock: 4 }] });
    const variant = product.variants[0]!;
    const res = await post(orderBody([{ variantId: variant.id, quantity: 1 }]));
    await prisma.productVariant.update({ where: { id: variant.id }, data: { price: 15_000 } });
    await prisma.product.update({ where: { id: product.id }, data: { price: 15_000, costPrice: 9_999 } });

    const agent = await adminAgent();
    const stored = await agent.get(`/api/admin/orders/${res.body.id}`);
    expect(stored.status).toBe(200);
    expect(stored.body.items[0]).toMatchObject({ unitPrice: 9_000, lineTotal: 9_000, unitCost: 4_500 });
    expect(stored.body.subtotal).toBe(9_000);
  });

  it("ignore le prix, le total et les noms envoyés par le client", async () => {
    const product = await makeProduct({ price: 7_000, variants: [{ stock: 3 }] });
    const res = await post(
      orderBody([{ variantId: product.variants[0]!.id, quantity: 1, unitPrice: 1, price: 1, lineTotal: 1 } as { variantId: string; quantity: number }], {
        total: 1,
        subtotal: 1,
        shippingFee: 0,
        discountTotal: 999_999,
        shippingAddress: { wilayaCode: "16", wilayaName: "N'importe quoi", commune: "Bab Ezzouar", address: "Cité 5 Juillet", deliveryMethod: "home" },
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ subtotal: 7_000, discountTotal: 0, shippingFee: 450, total: 7_450 });
    expect(res.body.items[0].unitPrice).toBe(7_000);
    expect(res.body.shippingAddress.wilayaName).toBe("Alger");
  });

  it("fusionne les lignes d'une même variante", async () => {
    const product = await makeProduct({ variants: [{ stock: 10 }] });
    const id = product.variants[0]!.id;
    const res = await post(orderBody([{ variantId: id, quantity: 2 }, { variantId: id, quantity: 3 }]));
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(5);
    expect(await stockOf(id)).toBe(5);
  });
});

describe("POST /api/orders — client", () => {
  it("crée un client invité, puis réutilise la fiche pour le même téléphone (formats différents)", async () => {
    const product = await makeProduct({ variants: [{ stock: 10 }] });
    const id = product.variants[0]!.id;

    const first = await post(orderBody([{ variantId: id, quantity: 1 }]));
    expect(first.status).toBe(201);
    expect(first.body.customer.customerId).toBeTruthy();
    const customers = await prisma.customer.findMany();
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({ phoneKey: "0555123456", isGuest: true });

    const second = await post(
      orderBody([{ variantId: id, quantity: 1 }], { customer: { firstName: "Autre", lastName: "Nom", phone: "+213 555 12 34 56" } }),
    );
    expect(second.status).toBe(201);
    expect(second.body.customer.customerId).toBe(first.body.customer.customerId);
    expect(await prisma.customer.count()).toBe(1);
    // L'instantané de la commande garde les coordonnées saisies à ce moment-là.
    expect(second.body.customer.firstName).toBe("Autre");
  });

  it("rattache la commande à un client existant (créé directement en base)", async () => {
    const existing = await prisma.customer.create({
      data: { firstName: "Yacine", lastName: "Merzouk", phone: "0661 00 00 01", phoneKey: "0661000001", wilayaCode: "31", commune: "Oran", isGuest: false },
    });
    const product = await makeProduct({ variants: [{ stock: 10 }] });
    const res = await post(
      orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }], { customer: { firstName: "Yacine", lastName: "Merzouk", phone: "00213661000001" } }),
    );
    expect(res.status).toBe(201);
    expect(res.body.customer.customerId).toBe(existing.id);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: existing.id } })).isGuest).toBe(false);
  });
});

describe("POST /api/orders — stock et disponibilité", () => {
  it("refuse en OUT_OF_STOCK et annule TOUT (aucun stock, mouvement, client ou commande créés)", async () => {
    const a = await makeProduct({ name: "Veste A", variants: [{ stock: 5 }] });
    const b = await makeProduct({ name: "Veste B", variants: [{ stock: 1, color: "Rouge", size: "M" }] });
    const va = a.variants[0]!;
    const vb = b.variants[0]!;

    const res = await post(orderBody([{ variantId: va.id, quantity: 2 }, { variantId: vb.id, quantity: 3 }]));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OUT_OF_STOCK");
    expect(res.body.error.message).toBe("« Veste B » (Rouge, M) : il ne reste que 1 pièce(s).");

    expect(await stockOf(va.id)).toBe(5);
    expect(await stockOf(vb.id)).toBe(1);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.stockMovement.count()).toBe(0);
    expect(await prisma.customer.count()).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).soldCount).toBe(0);
  });

  it("annule aussi la remise : l'usage du code n'est pas incrémenté si la commande échoue", async () => {
    const product = await makeProduct({ price: 10_000, variants: [{ stock: 1 }] });
    await prisma.promotion.create({
      data: { code: "PROMO10", label: "10 %", type: "percentage", value: 10, startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000) },
    });
    const res = await post(orderBody([{ variantId: product.variants[0]!.id, quantity: 2 }], { promoCode: "promo10" }));
    expect(res.status).toBe(409);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { code: "PROMO10" } })).usageCount).toBe(0);
  });

  it("indique la rupture totale avec le message du mock", async () => {
    const product = await makeProduct({ name: "Robe", variants: [{ stock: 0, color: "Noir", size: "S" }] });
    const res = await post(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }]));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "OUT_OF_STOCK", message: "« Robe » (Noir, S) est en rupture de stock." });
  });

  it("refuse (404) la variante d'un produit archivé, brouillon ou inexistante", async () => {
    const archived = await makeProduct({ isArchived: true, isPublished: true, variants: [{ stock: 5 }] });
    const draft = await makeProduct({ isPublished: false, variants: [{ stock: 5 }] });
    const ok = await makeProduct({ variants: [{ stock: 5 }] });

    for (const variantId of [archived.variants[0]!.id, draft.variants[0]!.id, "variante-inconnue"]) {
      const res = await post(orderBody([{ variantId: ok.variants[0]!.id, quantity: 1 }, { variantId, quantity: 1 }]));
      expect(res.status, variantId).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    // Rien n'a bougé, y compris la variante valide de la même commande.
    expect(await stockOf(ok.variants[0]!.id)).toBe(5);
    expect(await stockOf(archived.variants[0]!.id)).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("POST /api/orders — validation des entrées", () => {
  it("rejette panier vide, quantité invalide, trop de lignes", async () => {
    const product = await makeProduct({ variants: [{ stock: 50 }] });
    const id = product.variants[0]!.id;
    const bad: unknown[] = [
      orderBody([]),
      orderBody([{ variantId: id, quantity: 0 }]),
      orderBody([{ variantId: id, quantity: -2 }]),
      orderBody([{ variantId: id, quantity: 1.5 }]),
      orderBody([{ variantId: id, quantity: 21 }]),
      orderBody(Array.from({ length: 21 }, (_, i) => ({ variantId: `${id}-${i}`, quantity: 1 }))),
      orderBody([{ variantId: id, quantity: "2" as unknown as number }]),
      {},
      "pas un objet",
    ];
    for (const body of bad) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
    expect(await stockOf(id)).toBe(50);
  });

  it("rejette téléphone, nom, adresse (domicile) et e-mail invalides", async () => {
    const product = await makeProduct({ variants: [{ stock: 5 }] });
    const items = [{ variantId: product.variants[0]!.id, quantity: 1 }];
    const home = { wilayaCode: "16", commune: "Bab Ezzouar", address: "Cité 5 Juillet", deliveryMethod: "home" };
    const cases: Array<Record<string, unknown>> = [
      { customer: { firstName: "A", lastName: "Benali", phone: "0555123456" }, shippingAddress: home },
      { customer: { firstName: "Amina", lastName: "Benali", phone: "12345" }, shippingAddress: home },
      { customer: { firstName: "Amina", lastName: "Benali", phone: "0555123456", email: "pas-un-mail" }, shippingAddress: home },
      { customer: { firstName: "Amina", lastName: "Benali", phone: "0555123456" }, shippingAddress: { ...home, address: "" } },
    ];
    for (const c of cases) {
      const res = await post({ ...c, items });
      expect(res.status, JSON.stringify(c)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
  });

  it("refuse une wilaya inconnue", async () => {
    const product = await makeProduct({ variants: [{ stock: 5 }] });
    const res = await post(
      orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }], {
        shippingAddress: { wilayaCode: "99", commune: "X", address: "Une adresse", deliveryMethod: "home" },
      }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("refuse un bureau d'une autre wilaya ou inexistant, accepte celui de la wilaya", async () => {
    const product = await makeProduct({ variants: [{ stock: 5 }] });
    const items = [{ variantId: product.variants[0]!.id, quantity: 1 }];
    const pickup = (pickupPointId: string) => ({ wilayaCode: "16", commune: "Alger Centre", address: "", deliveryMethod: "pickup_point", pickupPointId });

    for (const id of ["31-centre", "inconnu"]) {
      const res = await post(orderBody(items, { shippingAddress: pickup(id) }));
      expect(res.status, id).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
    const ok = await post(orderBody(items, { shippingAddress: pickup("16-centre") }));
    expect(ok.status).toBe(201);
    expect(ok.body.shippingAddress).toMatchObject({ pickupPointId: "16-centre", pickupPointName: "Bureau Alger Centre", deliveryMethod: "pickup_point" });
    expect(ok.body.deliveryMethod).toBe("pickup_point");
    expect(ok.body.shippingFee).toBe(300);
  });
});

describe("POST /api/orders — livraison et paramètres", () => {
  it("calcule la livraison par zone et par mode (paramètres par défaut sans ligne en base)", async () => {
    const product = await makeProduct({ variants: [{ stock: 20 }] });
    const items = [{ variantId: product.variants[0]!.id, quantity: 1 }];
    const home = (wilayaCode: string) => ({ wilayaCode, commune: "Commune", address: "Adresse complète 12", deliveryMethod: "home" });
    const pickup = (wilayaCode: string) => ({ wilayaCode, commune: "Commune", address: "", deliveryMethod: "pickup_point", pickupPointId: `${wilayaCode}-nord` });

    const fee = async (shippingAddress: object) => (await post(orderBody(items, { shippingAddress }))).body.shippingFee as number;
    expect(await fee(home("16"))).toBe(450); // zone 1
    expect(await fee(pickup("16"))).toBe(300);
    expect(await fee(home("31"))).toBe(700); // zone 2 (Oran)
    expect(await fee(pickup("31"))).toBe(450);
    expect(await fee(home("11"))).toBe(1200); // zone 3 (Tamanrasset)
    expect(await fee(pickup("11"))).toBe(800);
  });

  it("utilise les paramètres en base : tarifs modifiés et livraison offerte au-delà du seuil", async () => {
    await prisma.storeSettings.create({
      data: {
        id: 1,
        storeName: "Boutique",
        phone: "0555000000",
        email: "a@b.dz",
        address: "Adresse",
        social: { instagram: "", tiktok: "" },
        shippingFees: { "1": { home: 100, pickupPoint: 50 }, "2": { home: 200, pickupPoint: 100 }, "3": { home: 300, pickupPoint: 150 } },
        freeShippingThreshold: 25_000,
      },
    });
    const product = await makeProduct({ price: 10_000, variants: [{ stock: 20 }] });
    const id = product.variants[0]!.id;
    const small = await post(orderBody([{ variantId: id, quantity: 1 }]));
    expect(small.body.shippingFee).toBe(100);
    const big = await post(orderBody([{ variantId: id, quantity: 3 }]));
    expect(big.body.shippingFee).toBe(0);
    expect(big.body.total).toBe(30_000);
  });
});

describe("POST /api/orders — codes promotionnels", () => {
  const promo = (over: Record<string, unknown> = {}) =>
    prisma.promotion.create({
      data: {
        code: "BIENVENUE10",
        label: "10 %",
        type: "percentage",
        value: 10,
        minOrderAmount: 5_000,
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: new Date(Date.now() + 86_400_000),
        ...over,
      },
    });

  it("applique un code valide (insensible à la casse) et incrémente l'usage", async () => {
    await promo();
    const product = await makeProduct({ price: 10_000, variants: [{ stock: 5 }] });
    const res = await post(orderBody([{ variantId: product.variants[0]!.id, quantity: 2 }], { promoCode: " bienvenue10 " }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ subtotal: 20_000, discountTotal: 2_000, promoCode: "BIENVENUE10", shippingFee: 450, total: 18_450 });
    expect((await prisma.promotion.findUniqueOrThrow({ where: { code: "BIENVENUE10" } })).usageCount).toBe(1);
  });

  it("applique un montant fixe plafonné au sous-total", async () => {
    await promo({ code: "FIXE", type: "fixed", value: 50_000, minOrderAmount: 0 });
    const product = await makeProduct({ price: 8_000, variants: [{ stock: 5 }] });
    const res = await post(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }], { promoCode: "FIXE" }));
    expect(res.body).toMatchObject({ subtotal: 8_000, discountTotal: 8_000, total: 450 });
  });

  it.each([
    ["inconnu", { promoCode: "NOPE" }, null, /n'existe pas/],
    ["expiré", { promoCode: "OLD" }, { code: "OLD", startsAt: new Date(Date.now() - 5 * 86_400_000), endsAt: new Date(Date.now() - 86_400_000) }, /expiré/],
    ["inactif", { promoCode: "OFF" }, { code: "OFF", isActive: false }, /plus actif/],
    ["pas encore valable", { promoCode: "SOON" }, { code: "SOON", startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 5 * 86_400_000) }, /pas encore/],
    ["sous le minimum", { promoCode: "MIN" }, { code: "MIN", minOrderAmount: 50_000 }, /Montant minimum/],
  ])("refuse un code %s sans rien modifier", async (_label, extra, promoData, reason) => {
    if (promoData) await promo(promoData);
    const product = await makeProduct({ price: 10_000, variants: [{ stock: 5 }] });
    const res = await post(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }], extra));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.message).toMatch(reason);
    expect(await stockOf(product.variants[0]!.id)).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("GET /api/orders/track", () => {
  async function placeOrder() {
    const product = await makeProduct({ variants: [{ stock: 5 }] });
    const res = await post(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }]));
    return res.body as { orderNumber: string; id: string };
  }

  it("renvoie la commande pour le bon couple, quel que soit le format du téléphone", async () => {
    const order = await placeOrder();
    for (const phone of ["0555123456", "0555 12 34 56", "+213555123456", "00213555123456"]) {
      const res = await http().get("/api/orders/track").query({ number: order.orderNumber, phone });
      expect(res.status, phone).toBe(200);
      expect(res.body.id).toBe(order.id);
      expect(res.body.statusHistory).toHaveLength(1);
    }
  });

  it("renvoie exactement la même 404 pour un mauvais téléphone, un numéro inconnu ou une requête incomplète", async () => {
    const order = await placeOrder();
    const attempts = [
      { number: order.orderNumber, phone: "0666000000" },
      { number: "CMD-2026-999999", phone: "0555123456" },
      { number: order.orderNumber },
      { phone: "0555123456" },
      {},
    ];
    const results = await Promise.all(attempts.map((q) => http().get("/api/orders/track").query(q)));
    for (const r of results) {
      expect(r.status).toBe(404);
      expect(r.body).toEqual(results[0]!.body);
      expect(r.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("ne fournit aucune liste de commandes par téléphone seul", async () => {
    await placeOrder();
    const res = await http().get("/api/orders").query({ phone: "0555123456" });
    expect(res.status).toBe(404);
  });
});

describe("administration — consultation des commandes", () => {
  it("exige une session", async () => {
    expect((await http().get("/api/admin/orders")).status).toBe(401);
    expect((await http().patch("/api/admin/orders/x/status").send({ status: "confirmed" })).status).toBe(401);
  });

  it("liste par ordre décroissant, retrouve par id et par numéro", async () => {
    const product = await makeProduct({ variants: [{ stock: 20 }] });
    const id = product.variants[0]!.id;
    const a = (await post(orderBody([{ variantId: id, quantity: 1 }]))).body;
    const b = (await post(orderBody([{ variantId: id, quantity: 1 }]))).body;
    const agent = await adminAgent();

    const list = await agent.get("/api/admin/orders");
    expect(list.status).toBe(200);
    expect(list.body.map((o: { id: string }) => o.id)).toEqual([b.id, a.id]);
    expect((await agent.get(`/api/admin/orders/${a.id}`)).body.orderNumber).toBe(a.orderNumber);
    expect((await agent.get(`/api/admin/orders/by-number/${b.orderNumber}`)).body.id).toBe(b.id);
    expect((await agent.get("/api/admin/orders/inconnue")).status).toBe(404);
    expect((await agent.get("/api/admin/orders/by-number/CMD-0000-000000")).status).toBe(404);
  });

  it("applique les filtres (statut, mode, recherche, téléphone, montants, dates en heure d'Algérie)", async () => {
    const product = await makeProduct({ price: 10_000, variants: [{ stock: 50 }] });
    const id = product.variants[0]!.id;
    const o1 = (await post(orderBody([{ variantId: id, quantity: 1 }]))).body; // 10 450, domicile, Amina Benali
    const o2 = (
      await post(
        orderBody([{ variantId: id, quantity: 3 }], {
          customer: { firstName: "Karim", lastName: "Haddad", phone: "0661 22 33 44" },
          shippingAddress: { wilayaCode: "31", commune: "Oran", address: "", deliveryMethod: "pickup_point", pickupPointId: "31-centre" },
        }),
      )
    ).body; // 30 450
    const agent = await adminAgent();
    await agent.patch(`/api/admin/orders/${o2.id}/status`).send({ status: "confirmed" });

    const ids = async (q: Record<string, string>) => ((await agent.get("/api/admin/orders").query(q)).body as Array<{ id: string }>).map((o) => o.id).sort();
    const sorted = (...x: Array<{ id: string }>) => x.map((o) => o.id).sort();

    expect(await ids({ status: "confirmed" })).toEqual(sorted(o2));
    expect(await ids({ status: "all" })).toEqual(sorted(o1, o2));
    expect(await ids({ deliveryMethod: "pickup_point" })).toEqual(sorted(o2));
    expect(await ids({ search: "amina" })).toEqual(sorted(o1));
    expect(await ids({ search: "karim haddad" })).toEqual(sorted(o2));
    expect(await ids({ search: o1.orderNumber.toLowerCase() })).toEqual(sorted(o1));
    expect(await ids({ search: "oran" })).toEqual(sorted(o2));
    expect(await ids({ search: "100%" })).toEqual([]);
    expect(await ids({ phone: "+213 661 22 33 44" })).toEqual(sorted(o2));
    expect(await ids({ phone: "0555123456" })).toEqual(sorted(o1));
    expect(await ids({ minTotal: "20000" })).toEqual(sorted(o2));
    expect(await ids({ maxTotal: "20000" })).toEqual(sorted(o1));
    expect(await ids({ customerId: o1.customer.customerId })).toEqual(sorted(o1));
    expect(await ids({ status: "", search: "" })).toEqual(sorted(o1, o2));

    // Dates : le jour entier, interprété en heure d'Algérie (UTC+1).
    const ref = new Date(o1.createdAt);
    const algeriaDay = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10);
    const day = algeriaDay(ref);
    expect(await ids({ dateFrom: day, dateTo: day })).toEqual(sorted(o1, o2));
    const next = algeriaDay(new Date(ref.getTime() + 86_400_000));
    const prev = algeriaDay(new Date(ref.getTime() - 86_400_000));
    expect(await ids({ dateFrom: next })).toEqual([]);
    expect(await ids({ dateTo: prev })).toEqual([]);

    // Un instant situé à 23h30 UTC appartient déjà au lendemain en Algérie.
    await prisma.order.update({ where: { id: o1.id }, data: { createdAt: new Date("2026-03-10T23:30:00Z") } });
    expect(await ids({ dateFrom: "2026-03-11", dateTo: "2026-03-11" })).toEqual(sorted(o1));
    expect(await ids({ dateFrom: "2026-03-10", dateTo: "2026-03-10" })).toEqual([]);

    expect((await agent.get("/api/admin/orders").query({ dateFrom: "12/03/2026" })).status).toBe(400);
    expect((await agent.get("/api/admin/orders").query({ status: "bizarre" })).status).toBe(400);
  });
});

describe("PATCH /api/admin/orders/:id/status", () => {
  async function pending(quantity = 2, stock = 10) {
    const product = await makeProduct({ price: 10_000, costPrice: 4_000, variants: [{ stock }] });
    const variant = product.variants[0]!;
    const order = (await post(orderBody([{ variantId: variant.id, quantity }]))).body as { id: string; orderNumber: string };
    return { product, variant, order };
  }
  const setStatus = (agent: Awaited<ReturnType<typeof adminAgent>>, id: string, status: string, note?: string) =>
    agent.patch(`/api/admin/orders/${id}/status`).send({ status, note });

  it("suit le cycle nominal avec paiement COD et historique complété", async () => {
    const { order } = await pending();
    const agent = await adminAgent();

    const confirmed = await setStatus(agent, order.id, "confirmed", "  Client joint  ");
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.paymentStatus).toBe("pending");
    expect(confirmed.body.statusHistory.map((h: { status: string }) => h.status)).toEqual(["pending", "confirmed"]);
    expect(confirmed.body.statusHistory[1].note).toBe("Client joint");

    for (const s of ["processing", "shipped"]) expect((await setStatus(agent, order.id, s)).body.paymentStatus).toBe("pending");
    const delivered = await setStatus(agent, order.id, "delivered");
    expect(delivered.body.paymentStatus).toBe("paid");
    expect(delivered.body.statusHistory.map((h: { status: string }) => h.status)).toEqual(["pending", "confirmed", "processing", "shipped", "delivered"]);
  });

  it("refuse les transitions interdites (INVALID_TRANSITION, message du mock) et les statuts inconnus", async () => {
    const { order } = await pending();
    const agent = await adminAgent();
    const res = await setStatus(agent, order.id, "delivered");
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "INVALID_TRANSITION", message: "Transition impossible : « En attente » → « Livrée »." });
    expect((await setStatus(agent, order.id, "nimporte")).status).toBe(400);
    expect((await setStatus(agent, "commande-inconnue", "confirmed")).status).toBe(404);
    // Aucune trace de la tentative refusée.
    expect((await agent.get(`/api/admin/orders/${order.id}`)).body.statusHistory).toHaveLength(1);
  });

  it.each(["cancelled", "rejected"] as const)("« %s » restitue le stock, écrit un mouvement return et décrémente soldCount", async (target) => {
    const { product, variant, order } = await pending(3, 10);
    expect(await stockOf(variant.id)).toBe(7);
    const agent = await adminAgent();
    const res = await setStatus(agent, order.id, target, "Client injoignable");
    expect(res.status).toBe(200);
    expect(await stockOf(variant.id)).toBe(10);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(0);
    const ret = await prisma.stockMovement.findMany({ where: { variantId: variant.id, type: "return" } });
    expect(ret).toHaveLength(1);
    expect(ret[0]).toMatchObject({ quantityDelta: 3, quantityBefore: 7, quantityAfter: 10, reference: order.orderNumber });
    expect(ret[0]!.reason).toBe(target === "cancelled" ? "Commande annulée" : "Commande refusée");
    // Statut final : plus aucune transition possible, donc plus de seconde restitution.
    expect((await setStatus(agent, order.id, "cancelled")).status).toBe(409);
    expect(await stockOf(variant.id)).toBe(10);
  });

  it("un retour après livraison restitue le stock ; échec de livraison puis relance : paiement à nouveau « à encaisser »", async () => {
    const { variant, order } = await pending(2, 10);
    const agent = await adminAgent();
    for (const s of ["confirmed", "processing", "shipped"]) await setStatus(agent, order.id, s);

    const failed = await setStatus(agent, order.id, "delivery_failed");
    expect(failed.body.paymentStatus).toBe("failed");
    expect(await stockOf(variant.id)).toBe(8); // pas de restitution pour un simple échec

    const reshipped = await setStatus(agent, order.id, "shipped");
    expect(reshipped.body.paymentStatus).toBe("pending");
    expect((await setStatus(agent, order.id, "delivered")).body.paymentStatus).toBe("paid");

    const returned = await setStatus(agent, order.id, "returned");
    expect(returned.body.paymentStatus).toBe("failed");
    expect(await stockOf(variant.id)).toBe(10);
    expect(await prisma.stockMovement.count({ where: { variantId: variant.id, type: "return" } })).toBe(1);
  });

  it("restitue le stock une seule fois même si l'annulation est envoyée deux fois simultanément", async () => {
    const { variant, order } = await pending(4, 10);
    const agent = await adminAgent();
    const results = await Promise.all([setStatus(agent, order.id, "cancelled"), setStatus(agent, order.id, "cancelled"), setStatus(agent, order.id, "cancelled")]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === "INVALID_TRANSITION")).toBe(true);
    expect(await stockOf(variant.id)).toBe(10); // 6 + 4, pas 14
    expect(await prisma.stockMovement.count({ where: { variantId: variant.id, type: "return" } })).toBe(1);
    expect((await agent.get(`/api/admin/orders/${order.id}`)).body.statusHistory.filter((h: { status: string }) => h.status === "cancelled")).toHaveLength(1);
  });

  it("un client peut recommander le dernier article après une annulation", async () => {
    const { variant, order } = await pending(1, 1);
    expect((await post(orderBody([{ variantId: variant.id, quantity: 1 }]))).status).toBe(409);
    const agent = await adminAgent();
    await setStatus(agent, order.id, "cancelled");
    expect((await post(orderBody([{ variantId: variant.id, quantity: 1 }]))).status).toBe(201);
  });
});
