import { beforeEach, describe, expect, it } from "vitest";
import { applyCartReconciliation } from "@/features/cart/apply-reconciliation";
import { reconcileCart } from "@/features/cart/reconcile";
import { computeCartSummary } from "@/features/cart/summary";
import { buildCartItem } from "@/features/products/variant-selection";
import { getCartCount, getCartSubtotal, useCartStore, type CartItem } from "@/stores/cart.store";
import type { Product } from "@/types/product.types";
import { testProduct } from "./storefront-b-fixtures";

const item = (color: string, size: string, product: Product = testProduct): Omit<CartItem, "quantity"> => {
  const variant = product.variants.find((v) => v.color === color && v.size === size)!;
  return buildCartItem(product, variant);
};

const resetStore = () => useCartStore.setState({ items: [], promoCode: null, shipping: { wilayaCode: "16", method: "home" } });

describe("store du panier", () => {
  beforeEach(() => {
    resetStore();
  });

  it("deux variantes d'un même produit sont deux lignes distinctes", () => {
    const { addItem } = useCartStore.getState();
    addItem(item("Noir", "M"), 1);
    addItem(item("Noir", "L"), 1);
    addItem(item("Beige", "S"), 2);
    const items = useCartStore.getState().items;
    expect(items.map((i) => i.variantId)).toEqual(["var-noir-m", "var-noir-l", "var-beige-s"]);
    expect(getCartCount(items)).toBe(4);
  });

  it("ajouter deux fois la même variante cumule la quantité sur une seule ligne", () => {
    const { addItem } = useCartStore.getState();
    expect(addItem(item("Noir", "M"), 2)).toBe(2);
    expect(addItem(item("Noir", "M"), 1)).toBe(1);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(3);
  });

  it("plafonne l'ajout au stock de la variante et retourne la quantité réellement ajoutée", () => {
    const { addItem } = useCartStore.getState();
    expect(addItem(item("Noir", "L"), 5)).toBe(2); // stock 2
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
    // Stock déjà atteint dans le panier : rien n'est ajouté (l'UI affiche un avertissement).
    expect(addItem(item("Noir", "L"), 1)).toBe(0);
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
  });

  it("refuse d'ajouter une variante épuisée, même si le produit a du stock ailleurs", () => {
    const { addItem } = useCartStore.getState();
    expect(addItem(item("Noir", "S"), 1)).toBe(0); // stock 0
    expect(addItem(item("Beige", "L"), 1)).toBe(0); // stock 0
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("refuse une quantité nulle ou négative", () => {
    expect(useCartStore.getState().addItem(item("Noir", "M"), 0)).toBe(0);
    expect(useCartStore.getState().addItem(item("Noir", "M"), -2)).toBe(0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("updateQuantity reste dans [1, stock]", () => {
    const { addItem, updateQuantity } = useCartStore.getState();
    addItem(item("Noir", "M"), 1); // stock 5
    updateQuantity("var-noir-m", 4);
    expect(useCartStore.getState().items[0]?.quantity).toBe(4);
    updateQuantity("var-noir-m", 50);
    expect(useCartStore.getState().items[0]?.quantity).toBe(5);
    updateQuantity("var-noir-m", 0);
    expect(useCartStore.getState().items[0]?.quantity).toBe(1);
  });

  it("removeItem retire uniquement la ligne ciblée ; clear vide le panier et le code promo", () => {
    const { addItem, removeItem, setPromoCode, clear } = useCartStore.getState();
    addItem(item("Noir", "M"), 1);
    addItem(item("Beige", "S"), 1);
    setPromoCode("BIENVENUE10");
    removeItem("var-noir-m");
    expect(useCartStore.getState().items.map((i) => i.variantId)).toEqual(["var-beige-s"]);
    clear();
    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().promoCode).toBeNull();
  });

  it("calcule le sous-total à partir des lignes", () => {
    const { addItem } = useCartStore.getState();
    addItem(item("Noir", "M"), 2);
    addItem(item("Beige", "S"), 1);
    expect(getCartSubtotal(useCartStore.getState().items)).toBe(30000);
  });

  it("persiste dans le localStorage et se réhydrate", async () => {
    useCartStore.getState().addItem(item("Noir", "M"), 3);
    useCartStore.getState().setShipping({ wilayaCode: "31", method: "pickup_point" });

    const raw = window.localStorage.getItem("fashion-cart-v1");
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!) as { state: { items: CartItem[]; shipping: { wilayaCode: string; method: string } } };
    expect(saved.state.items[0]).toMatchObject({ variantId: "var-noir-m", quantity: 3 });
    expect(saved.state.shipping).toEqual({ wilayaCode: "31", method: "pickup_point" });

    // Simule un rechargement : état en mémoire perdu, localStorage conservé.
    useCartStore.setState({ items: [], shipping: { wilayaCode: "16", method: "home" } });
    window.localStorage.setItem("fashion-cart-v1", raw!);
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().items[0]).toMatchObject({ variantId: "var-noir-m", quantity: 3 });
    expect(useCartStore.getState().shipping).toEqual({ wilayaCode: "31", method: "pickup_point" });
  });
});

describe("réconciliation du panier avec le catalogue", () => {
  beforeEach(() => {
    resetStore();
  });

  const cartWith = (...entries: Array<[string, string, number]>) => {
    for (const [color, size, qty] of entries) useCartStore.getState().addItem(item(color, size), qty);
    return useCartStore.getState().items;
  };

  it("ne propose aucune correction quand tout est à jour", () => {
    const result = reconcileCart(cartWith(["Noir", "M", 2]), [testProduct]);
    expect(result.patches).toEqual([]);
    expect(result.notices).toEqual([]);
    expect(result.issues).toEqual({});
  });

  it("met à jour prix et stock, et signale le changement de prix", () => {
    const items = cartWith(["Noir", "M", 2]);
    const changed: Product = {
      ...testProduct,
      variants: testProduct.variants.map((v) => (v.id === "var-noir-m" ? { ...v, price: 9000, stock: 8 } : v)),
    };
    const result = reconcileCart(items, [changed]);
    expect(result.patches).toEqual([{ variantId: "var-noir-m", patch: { unitPrice: 9000, maxStock: 8 } }]);
    expect(result.notices[0]?.message).toContain("prix");
  });

  it("ramène la quantité au stock restant (via syncItem)", () => {
    cartWith(["Noir", "M", 5]);
    const lowStock: Product = { ...testProduct, variants: testProduct.variants.map((v) => (v.id === "var-noir-m" ? { ...v, stock: 2 } : v)) };
    const result = applyCartReconciliation([lowStock]);
    expect(result.notices.some((n) => n.message.includes("ramenée à 2"))).toBe(true);
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 2, maxStock: 2 });
  });

  it("signale une variante en rupture et une variante disparue, et peut les retirer", () => {
    const items = cartWith(["Noir", "M", 1], ["Beige", "S", 1], ["Noir", "L", 1]);
    const catalog: Product = {
      ...testProduct,
      variants: testProduct.variants
        .filter((v) => v.id !== "var-beige-s") // variante supprimée
        .map((v) => (v.id === "var-noir-m" ? { ...v, stock: 0 } : v)), // épuisée
    };
    const result = reconcileCart(items, [catalog]);
    expect(result.issues["var-noir-m"]?.kind).toBe("out_of_stock");
    expect(result.issues["var-beige-s"]?.kind).toBe("unavailable");
    expect(result.issues["var-noir-l"]).toBeUndefined();

    applyCartReconciliation([catalog], { removeInvalid: true });
    expect(useCartStore.getState().items.map((i) => i.variantId)).toEqual(["var-noir-l"]);
  });

  it("un produit dépublié, archivé ou absent rend ses lignes indisponibles", () => {
    const items = cartWith(["Noir", "M", 1]);
    expect(reconcileCart(items, []).issues["var-noir-m"]?.kind).toBe("unavailable");
    expect(reconcileCart(items, [{ ...testProduct, isPublished: false }]).issues["var-noir-m"]?.kind).toBe("unavailable");
    expect(reconcileCart(items, [{ ...testProduct, isArchived: true }]).issues["var-noir-m"]?.kind).toBe("unavailable");
  });

  it("l'application est idempotente (pas de boucle d'effet)", () => {
    cartWith(["Noir", "M", 2]);
    const changed: Product = { ...testProduct, variants: testProduct.variants.map((v) => (v.id === "var-noir-m" ? { ...v, price: 9500 } : v)) };
    expect(applyCartReconciliation([changed]).patches).toHaveLength(1);
    expect(applyCartReconciliation([changed]).patches).toHaveLength(0);
  });
});

describe("totaux du panier", () => {
  it("la livraison est séparée du sous-total et s'ajoute au total", () => {
    useCartStore.setState({ items: [], promoCode: null });
    useCartStore.getState().addItem(item("Noir", "M"), 2);
    const summary = computeCartSummary({ items: useCartStore.getState().items, discount: 2000, shippingFee: 700 });
    expect(summary).toEqual({ itemCount: 2, subtotal: 20000, discount: 2000, shippingFee: 700, total: 18700 });
  });

  it("la remise ne dépasse jamais le sous-total", () => {
    useCartStore.setState({ items: [], promoCode: null });
    useCartStore.getState().addItem(item("Noir", "M"), 1);
    const summary = computeCartSummary({ items: useCartStore.getState().items, discount: 50000, shippingFee: 450 });
    expect(summary.discount).toBe(10000);
    expect(summary.total).toBe(450);
  });
});
