import { checkoutSchema, type CheckoutFormValues } from "@fashion/validators";
import { beforeEach, describe, expect, it } from "vitest";
import { applyCartReconciliation } from "@/features/cart/apply-reconciliation";
import { getCheckoutDefaults } from "@/features/checkout/defaults";
import { buildCreateOrderInput, isCartConflictError } from "@/features/checkout/place-order";
import { buildCartItem } from "@/features/products/variant-selection";
import { productService, orderService, ServiceError } from "@/services";
import { resetDb } from "@/services/mock/db";
import { useCartStore } from "@/stores/cart.store";

const homeValues: CheckoutFormValues = {
  lastName: "Benali",
  firstName: "Amine",
  phone: "0555 12 34 56",
  wilayaCode: "16",
  commune: "Bab Ezzouar",
  address: "12 rue des Oliviers, cité 5 juillet",
  deliveryMethod: "home",
  pickupPointId: undefined,
  note: "",
};

const pickupValues: CheckoutFormValues = {
  ...homeValues,
  address: "",
  deliveryMethod: "pickup_point",
  pickupPointId: "16-centre",
};

const issuesOf = (values: unknown) => {
  const result = checkoutSchema.safeParse(values);
  if (result.success) return {} as Record<string, string>;
  const first: Record<string, string> = {};
  for (const issue of result.error.issues) first[String(issue.path[0])] ??= issue.message;
  return first;
};

describe("validation du formulaire de commande (checkoutSchema)", () => {
  it("accepte une commande à domicile complète", () => {
    expect(checkoutSchema.safeParse(homeValues).success).toBe(true);
  });

  it("accepte une commande en bureau sans adresse, avec un bureau choisi", () => {
    expect(checkoutSchema.safeParse(pickupValues).success).toBe(true);
  });

  it("le domicile exige l'adresse", () => {
    expect(issuesOf({ ...homeValues, address: "" }).address).toMatch(/adresse complète est obligatoire/i);
    expect(issuesOf({ ...homeValues, address: "abc" }).address).toBeDefined();
  });

  it("le bureau exige un bureau de livraison", () => {
    expect(issuesOf({ ...pickupValues, pickupPointId: undefined }).pickupPointId).toMatch(/bureau de livraison/i);
  });

  it("rejette un téléphone invalide et accepte les formats algériens", () => {
    expect(issuesOf({ ...homeValues, phone: "12345" }).phone).toMatch(/invalide/i);
    expect(issuesOf({ ...homeValues, phone: "" }).phone).toMatch(/obligatoire/i); // premier message : champ requis
    expect(issuesOf({ ...homeValues, phone: "0455 12 34 56" }).phone).toBeDefined(); // préfixe 04 non mobile
    for (const phone of ["0555123456", "+213 555 12 34 56", "0661 23 45 67", "00213770123456"]) {
      expect(issuesOf({ ...homeValues, phone }).phone, phone).toBeUndefined();
    }
  });

  it("exige nom, prénom, wilaya et commune", () => {
    const issues = issuesOf({ ...homeValues, lastName: "", firstName: " ", wilayaCode: "", commune: "" });
    expect(Object.keys(issues).sort()).toEqual(["commune", "firstName", "lastName", "wilayaCode"]);
  });

  it("limite la remarque à 300 caractères", () => {
    expect(issuesOf({ ...homeValues, note: "x".repeat(301) }).note).toMatch(/300/);
    expect(issuesOf({ ...homeValues, note: "x".repeat(300) }).note).toBeUndefined();
  });
});

describe("construction de l'entrée de commande (place-order)", () => {
  const items = [
    { variantId: "var-a", quantity: 2 },
    { variantId: "var-b", quantity: 1 },
  ];

  it("domicile : adresse saisie, aucun bureau, wilaya nommée", () => {
    const input = buildCreateOrderInput({ values: homeValues, items, promoCode: "BIENVENUE10" });
    expect(input).toEqual({
      customer: { firstName: "Amine", lastName: "Benali", phone: "0555 12 34 56" },
      shippingAddress: {
        wilayaCode: "16",
        wilayaName: "Alger",
        commune: "Bab Ezzouar",
        address: "12 rue des Oliviers, cité 5 juillet",
        deliveryMethod: "home",
      },
      items: [
        { variantId: "var-a", quantity: 2 },
        { variantId: "var-b", quantity: 1 },
      ],
      promoCode: "BIENVENUE10",
    });
  });

  it("bureau : renseigne le bureau (id + nom) et reprend son adresse", () => {
    const input = buildCreateOrderInput({ values: pickupValues, items });
    expect(input.shippingAddress).toMatchObject({
      deliveryMethod: "pickup_point",
      pickupPointId: "16-centre",
      pickupPointName: "Bureau Alger Centre",
      address: "Centre-ville, Alger",
    });
  });

  it("refuse un bureau qui n'appartient pas à la wilaya choisie", () => {
    expect(() => buildCreateOrderInput({ values: { ...pickupValues, pickupPointId: "31-centre" }, items })).toThrow(/bureau/i);
    expect(() => buildCreateOrderInput({ values: { ...pickupValues, pickupPointId: undefined }, items })).toThrow();
  });

  it("n'envoie ni prix ni stock : seulement variante + quantité (le service les revérifie)", () => {
    const input = buildCreateOrderInput({ values: homeValues, items: [{ variantId: "v", quantity: 1, unitPrice: 1, maxStock: 9 } as never] });
    expect(input.items).toEqual([{ variantId: "v", quantity: 1 }]);
  });

  it("nettoie les espaces, joint remarque et e-mail seulement s'ils sont renseignés", () => {
    const input = buildCreateOrderInput({
      values: { ...homeValues, firstName: "  Amine ", note: "  Sonner deux fois  " },
      items,
      promoCode: "  ",
      email: " amine@example.com ",
    });
    expect(input.customer).toMatchObject({ firstName: "Amine", email: "amine@example.com" });
    expect(input.customerNote).toBe("Sonner deux fois");
    expect(input).not.toHaveProperty("promoCode");
    expect(buildCreateOrderInput({ values: homeValues, items }).customer).not.toHaveProperty("email");
    expect(buildCreateOrderInput({ values: homeValues, items })).not.toHaveProperty("customerNote");
  });

  it("préremplit le formulaire depuis la session client et l'estimation de livraison du panier", () => {
    const account = { firstName: "Sara", lastName: "Haddad", phone: "0661234567", wilayaCode: "31", commune: "Es Senia", address: "12 rue des Roses" };
    const defaults = getCheckoutDefaults(account, { wilayaCode: "31", method: "pickup_point" });
    expect(defaults).toMatchObject({ firstName: "Sara", lastName: "Haddad", phone: "0661234567", wilayaCode: "31", deliveryMethod: "pickup_point", commune: "Es Senia", address: "12 rue des Roses" });
    // Autre wilaya que celle du compte : commune et adresse ne sont pas proposées (elles ne correspondraient pas).
    expect(getCheckoutDefaults(account, { wilayaCode: "16", method: "home" })).toMatchObject({ commune: "", address: "", wilayaCode: "16" });
    expect(getCheckoutDefaults(null, { wilayaCode: "16", method: "home" })).toMatchObject({ firstName: "", phone: "", wilayaCode: "16", deliveryMethod: "home" });
  });
});

describe("passage de commande avec le service mock (stock par variante)", () => {
  beforeEach(() => {
    resetDb();
    useCartStore.setState({ items: [], promoCode: null, shipping: { wilayaCode: "16", method: "home" } });
  });

  it("crée la commande, fige le prix et décrémente le stock de la variante uniquement", async () => {
    const products = await productService.getProducts({ onlyPublic: true });
    const product = products.find((p) => p.variants.some((v) => v.stock >= 3))!;
    const variant = product.variants.find((v) => v.stock >= 3)!;
    const other = product.variants.find((v) => v.id !== variant.id);

    const input = buildCreateOrderInput({ values: homeValues, items: [{ variantId: variant.id, quantity: 2 }] });
    const order = await orderService.createOrder(input);

    expect(order.items[0]).toMatchObject({ variantId: variant.id, quantity: 2, unitPrice: variant.price });
    expect(order.total).toBe(order.subtotal - order.discountTotal + order.shippingFee);
    expect(order.paymentMethod).toBe("cash_on_delivery");
    expect(order.paymentStatus).toBe("pending");

    const after = (await productService.getProductById(product.id))!;
    expect(after.variants.find((v) => v.id === variant.id)?.stock).toBe(variant.stock - 2);
    if (other) expect(after.variants.find((v) => v.id === other.id)?.stock).toBe(other.stock);
  });

  it("refuse une quantité supérieure au stock de la variante : OUT_OF_STOCK, panier réconcilié", async () => {
    const products = await productService.getProducts({ onlyPublic: true });
    const product = products.find((p) => p.variants.some((v) => v.stock > 0 && v.stock < 10))!;
    const variant = product.variants.find((v) => v.stock > 0 && v.stock < 10)!;

    // Le panier contient la variante avec un ancien stock (plus élevé que le stock réel).
    useCartStore.getState().addItem({ ...buildCartItem(product, variant), maxStock: 20 }, variant.stock + 3);
    const cart = useCartStore.getState().items;
    expect(cart[0]?.quantity).toBe(variant.stock + 3);

    const input = buildCreateOrderInput({ values: homeValues, items: cart });
    let caught: unknown;
    await orderService.createOrder(input).catch((e: unknown) => {
      caught = e;
    });
    expect(caught).toBeInstanceOf(ServiceError);
    expect(isCartConflictError(caught)).toBe(true);
    expect((caught as ServiceError).code).toBe("OUT_OF_STOCK");

    // Réconciliation après l'échec : la quantité est ramenée au stock réel, aucune donnée perdue.
    const fresh = await productService.getProducts({ onlyPublic: true });
    const result = applyCartReconciliation(fresh, { removeInvalid: true });
    expect(result.notices.length).toBeGreaterThan(0);
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: variant.stock, maxStock: variant.stock });

    // Le stock n'a pas bougé après l'échec.
    const after = (await productService.getProductById(product.id))!;
    expect(after.variants.find((v) => v.id === variant.id)?.stock).toBe(variant.stock);
  });

  it("une variante épuisée est refusée même si le produit a du stock sur d'autres variantes", async () => {
    const products = await productService.getProducts({ onlyPublic: true });
    const product = products.find((p) => p.variants.some((v) => v.stock === 0) && p.variants.some((v) => v.stock > 0))!;
    const soldOut = product.variants.find((v) => v.stock === 0)!;
    const input = buildCreateOrderInput({ values: homeValues, items: [{ variantId: soldOut.id, quantity: 1 }] });
    await expect(orderService.createOrder(input)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
  });
});
