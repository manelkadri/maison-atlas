import { beforeEach, describe, expect, it } from "vitest";
import { makeProduct, orderBody } from "./api2-factories";
import { adminAgent, customerAgent, http, prisma, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

/* ─────────────── Outils : parcours récursif de TOUTES les clés d'une réponse (réponses imbriquées comprises) ─────────────── */

/** « chemin.de.la.clé » de chaque propriété, les éléments de tableau étant notés `[]`. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${prefix}[]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, v]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [path, ...keyPaths(v, path)];
    });
  }
  return [];
}
const lastKey = (path: string) => path.split(".").at(-1)!.replace(/\[\]/g, "");

/** Les SEULES clés que la réponse publique de suivi peut contenir (liste blanche, imbrications comprises). */
const ALLOWED_PUBLIC_KEYS = new Set([
  "orderNumber", "status", "statusHistory", "statusHistory[].status", "statusHistory[].at",
  "paymentMethod", "paymentStatus",
  "customer", "customer.firstName",
  "shippingAddress", "shippingAddress.wilayaName", "shippingAddress.commune", "shippingAddress.deliveryMethod", "shippingAddress.pickupPointName",
  "items", "items[].productName", "items[].productSlug", "items[].color", "items[].colorCode", "items[].size", "items[].imageUrl",
  "items[].unitPrice", "items[].quantity", "items[].lineTotal",
  "subtotal", "discountTotal", "promoCode", "shippingFee", "total", "createdAt", "updatedAt",
]);

/** Noms de clés qui ne doivent JAMAIS apparaître, à aucune profondeur, dans une réponse publique. */
const FORBIDDEN_KEYS = [
  "unitCost", "costPrice", "cost", "margin", "profit",
  "note", "notes", "internalNote", "customerNote", "comment",
  "id", "orderId", "customerId", "productId", "variantId", "sku", "sequence",
  "phone", "customerPhone", "email", "customerEmail", "lastName", "customerLastName", "address", "wilayaCode", "pickupPointId",
  "passwordHash", "mustChangePassword", "isGuest", "history", "adminId", "createdBy", "paymentReference",
];

async function scenario() {
  const COST = 7_654;
  const product = await makeProduct({ name: "Robe Secrète", price: 10_000, costPrice: COST, variants: [{ stock: 20 }] });
  await prisma.promotion.create({
    data: { code: "MOINS10", label: "10 %", type: "percentage", value: 10, startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000) },
  });
  const buyer = await customerAgent();
  const res = await buyer.agent.post("/api/orders").send(
    orderBody([{ variantId: product.variants[0]!.id, quantity: 2 }], {
      promoCode: "MOINS10",
      customerNote: "NOTE-DE-LA-CLIENTE : sonner deux fois",
      customer: { firstName: "Amina", lastName: "NomDeFamilleSecret", phone: "0555 12 34 56", email: "amina.secrete@example.com" },
      shippingAddress: { wilayaCode: "31", commune: "Oran", address: "12 Rue Secrète des Roses", deliveryMethod: "pickup_point", pickupPointId: "31-centre" },
    }),
  );
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const order = res.body as { id: string; orderNumber: string };
  // L'administration confirme la commande avec une NOTE INTERNE.
  const admin = await adminAgent();
  await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: "confirmed", note: "NOTE-INTERNE-ADMIN : cliente à surveiller" }).expect(200);
  return { order, product, COST, buyer, admin, variant: product.variants[0]! };
}

describe("GET /api/orders/track : réponse publique DÉDIÉE, sans aucune information interne", () => {
  it("ne contient QUE les clés autorisées, à tous les niveaux d'imbrication (liste blanche stricte)", async () => {
    const { order } = await scenario();
    const res = await http().get("/api/orders/track").query({ number: order.orderNumber, phone: "0555123456" });
    expect(res.status).toBe(200);
    const paths = keyPaths(res.body);
    const unexpected = paths.filter((p) => !ALLOWED_PUBLIC_KEYS.has(p));
    expect(unexpected, `clés inattendues : ${unexpected.join(", ")}`).toEqual([]);
    // Et les champs utiles au suivi sont bien là.
    for (const required of ["orderNumber", "status", "statusHistory[].status", "statusHistory[].at", "customer.firstName", "shippingAddress.wilayaName", "shippingAddress.commune", "items[].productName", "items[].lineTotal", "total", "shippingFee", "paymentStatus", "promoCode", "shippingAddress.pickupPointName"]) {
      expect(paths, required).toContain(required);
    }
  });

  it("ne contient jamais un nom de clé interne (prix de revient, notes, identifiants, coordonnées…), à aucune profondeur", async () => {
    const { order } = await scenario();
    const res = await http().get("/api/orders/track").query({ number: order.orderNumber, phone: "0555123456" });
    const forbidden = keyPaths(res.body).filter((p) => FORBIDDEN_KEYS.includes(lastKey(p)));
    expect(forbidden, `clés interdites : ${forbidden.join(", ")}`).toEqual([]);
  });

  it("ne contient jamais une VALEUR interne : prix de revient, notes (admin et cliente), nom de famille, téléphone, e-mail, rue, identifiants, SKU", async () => {
    const { order, COST, variant, product, buyer } = await scenario();
    const res = await http().get("/api/orders/track").query({ number: order.orderNumber, phone: "0555123456" });
    const json = JSON.stringify(res.body);
    const secrets: Array<[string, string]> = [
      ["prix de revient", String(COST)],
      ["note interne de l'administration", "NOTE-INTERNE-ADMIN"],
      ["note de la cliente", "NOTE-DE-LA-CLIENTE"],
      ["nom de famille", "NomDeFamilleSecret"],
      ["téléphone", "555123456"],
      ["e-mail", "amina.secrete"],
      ["rue", "Rue Secrète"],
      ["identifiant de commande", order.id],
      ["identifiant de produit", product.id],
      ["identifiant de variante", variant.id],
      ["SKU", variant.sku],
      ["identifiant de cliente", buyer.customer.id],
      ["code wilaya brut du formulaire", '"wilayaCode"'],
    ];
    for (const [label, secret] of secrets) expect(json, `fuite : ${label}`).not.toContain(secret);
    // Ce que le suivi doit au contraire montrer : prénom, commune, totaux, étapes.
    expect(res.body.customer).toEqual({ firstName: "Amina" });
    expect(res.body.shippingAddress).toMatchObject({ wilayaName: "Oran", commune: "Oran", deliveryMethod: "pickup_point" });
    expect(res.body.statusHistory.map((e: { status: string }) => e.status)).toEqual(["pending", "confirmed"]);
  });

  it("reste inchangée quel que soit le format du téléphone, et les erreurs restent uniformes (404 identique)", async () => {
    const { order } = await scenario();
    const reference = (await http().get("/api/orders/track").query({ number: order.orderNumber, phone: "0555123456" })).body;
    for (const phone of ["0555 12 34 56", "+213555123456", "00213555123456"]) {
      expect((await http().get("/api/orders/track").query({ number: order.orderNumber, phone })).body, phone).toEqual(reference);
    }
    const wrong = await http().get("/api/orders/track").query({ number: order.orderNumber, phone: "0666000000" });
    const unknown = await http().get("/api/orders/track").query({ number: "CMD-2026-999999", phone: "0555123456" });
    expect(wrong.status).toBe(404);
    expect(wrong.body).toEqual(unknown.body);
    expect(JSON.stringify(wrong.body)).not.toContain(order.orderNumber);
    expect(JSON.stringify(wrong.body)).not.toContain("Amina");
  });

  it("n'est pas mise en cache et une commande sans code promo ni bureau n'a pas ces clés", async () => {
    const product = await makeProduct({ variants: [{ stock: 5 }] });
    const buyer = await customerAgent();
    const order = (await buyer.agent.post("/api/orders").send(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }]))).body as { orderNumber: string };
    const res = await http().get("/api/orders/track").query({ number: order.orderNumber, phone: "0555123456" });
    expect(res.headers["cache-control"]).toMatch(/no-store/);
    const paths = keyPaths(res.body);
    expect(paths).not.toContain("promoCode");
    expect(paths).not.toContain("shippingAddress.pickupPointName");
    expect(paths.filter((p) => !ALLOWED_PUBLIC_KEYS.has(p))).toEqual([]);
  });
});

describe("les autres vues clientes : jamais de prix de revient ni de note interne", () => {
  it("création de commande et « mes commandes » : aucune clé interne à aucune profondeur", async () => {
    const { buyer, order, COST } = await scenario();
    const detail = await buyer.agent.get(`/api/customers/me/orders/${order.orderNumber}`);
    const list = await buyer.agent.get("/api/customers/me/orders");
    for (const [label, body] of [["détail", detail.body], ["liste", list.body]] as const) {
      const bad = keyPaths(body).filter((p) => ["unitCost", "costPrice", "note", "notes", "internalNote", "history", "passwordHash"].includes(lastKey(p)));
      expect(bad, label).toEqual([]);
      const json = JSON.stringify(body);
      for (const secret of ["NOTE-INTERNE-ADMIN", String(COST)]) expect(json, `${label} : ${secret}`).not.toContain(secret);
    }
    // La cliente voit en revanche SES informations (adresse, téléphone, sa propre note).
    expect(detail.body.shippingAddress.address).toBe("12 Rue Secrète des Roses");
    expect(detail.body.customerNote).toContain("NOTE-DE-LA-CLIENTE");
  });

  it("les clés de la vue cliente forment une liste blanche : un champ ajouté plus tard à Order n'y apparaît pas tout seul", async () => {
    const { buyer, order } = await scenario();
    const paths = new Set(keyPaths((await buyer.agent.get(`/api/customers/me/orders/${order.orderNumber}`)).body));
    const allowed = new Set([
      "id", "orderNumber", "customer", "customer.customerId", "customer.firstName", "customer.lastName", "customer.phone", "customer.email",
      "shippingAddress", "shippingAddress.wilayaCode", "shippingAddress.wilayaName", "shippingAddress.commune", "shippingAddress.address",
      "shippingAddress.deliveryMethod", "shippingAddress.pickupPointId", "shippingAddress.pickupPointName",
      "items", "items[].id", "items[].productId", "items[].variantId", "items[].productName", "items[].productSlug", "items[].sku", "items[].color",
      "items[].colorCode", "items[].size", "items[].imageUrl", "items[].unitPrice", "items[].quantity", "items[].lineTotal",
      "subtotal", "discountTotal", "promoCode", "shippingFee", "total", "paymentMethod", "paymentStatus", "deliveryMethod", "status",
      "statusHistory", "statusHistory[].status", "statusHistory[].at", "customerNote", "createdAt", "updatedAt",
    ]);
    expect([...paths].filter((p) => !allowed.has(p))).toEqual([]);
  });

  it("l'ADMINISTRATION, elle, continue de voir le prix de revient et les notes internes (fonctionnalité existante inchangée)", async () => {
    const { order, admin, COST } = await scenario();
    const detail = await admin.get(`/api/admin/orders/${order.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.items[0].unitCost).toBe(COST);
    expect(detail.body.statusHistory.some((e: { note?: string }) => e.note?.includes("NOTE-INTERNE-ADMIN"))).toBe(true);
  });
});
