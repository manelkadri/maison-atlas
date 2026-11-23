import { describe, expect, it } from "vitest";
import { categoriesMock } from "@/mocks/categories.mock";
import { customersMock } from "@/mocks/customers.mock";
import { stockMovementsMock } from "@/mocks/inventory.mock";
import { ordersMock } from "@/mocks/orders.mock";
import { productsMock } from "@/mocks/products.mock";

describe("données mockées — cohérence", () => {
  it("chaque SKU est unique sur tout le catalogue", () => {
    const skus = productsMock.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("chaque variante est unique par couleur + taille dans son produit", () => {
    for (const p of productsMock) {
      const keys = p.variants.map((v) => `${v.color}|${v.size}`);
      expect(new Set(keys).size, p.slug).toBe(keys.length);
    }
  });

  it("slugs produits uniques et catégories valides", () => {
    expect(new Set(productsMock.map((p) => p.slug)).size).toBe(productsMock.length);
    const catIds = new Set(categoriesMock.map((c) => c.id));
    for (const p of productsMock) expect(catIds.has(p.categoryId), p.slug).toBe(true);
  });

  it("contient des ruptures, des stocks faibles et des produits disponibles (démo réaliste)", () => {
    const variants = productsMock.flatMap((p) => p.variants);
    expect(variants.some((v) => v.stock === 0)).toBe(true);
    expect(variants.some((v) => v.stock > 0 && v.stock <= v.alertThreshold)).toBe(true);
    expect(variants.some((v) => v.stock > v.alertThreshold)).toBe(true);
  });

  it("chaque image référencée possède une couleur existante", () => {
    for (const p of productsMock) {
      const colors = new Set(p.variants.map((v) => v.color));
      for (const im of p.images) expect(colors.has(im.color ?? ""), `${p.slug}:${im.url}`).toBe(true);
    }
  });

  it("les totaux de commande sont cohérents (sous-total − remise + livraison = total)", () => {
    expect(ordersMock.length).toBeGreaterThan(30);
    for (const o of ordersMock) {
      const subtotal = o.items.reduce((s, it) => s + it.lineTotal, 0);
      expect(o.subtotal, o.orderNumber).toBe(subtotal);
      expect(o.total, o.orderNumber).toBe(o.subtotal - o.discountTotal + o.shippingFee);
      for (const it of o.items) expect(it.lineTotal).toBe(it.unitPrice * it.quantity);
    }
  });

  it("les numéros de commande sont uniques et COD n'est jamais 'paid' avant livraison", () => {
    expect(new Set(ordersMock.map((o) => o.orderNumber)).size).toBe(ordersMock.length);
    for (const o of ordersMock) if (o.paymentStatus === "paid") expect(o.status).toBe("delivered");
  });

  it("les commandes référencent des clients et variantes existants", () => {
    const customers = new Set(customersMock.map((c) => c.id));
    const variants = new Set(productsMock.flatMap((p) => p.variants.map((v) => v.id)));
    for (const o of ordersMock) {
      expect(customers.has(o.customer.customerId ?? "")).toBe(true);
      for (const it of o.items) expect(variants.has(it.variantId), it.variantId).toBe(true);
    }
  });

  it("l'historique de stock aboutit exactement au stock courant de chaque variante", () => {
    for (const p of productsMock) {
      for (const v of p.variants) {
        const history = stockMovementsMock.filter((m) => m.variantId === v.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        expect(history.length, v.sku).toBeGreaterThan(0);
        let running = 0;
        for (const m of history) {
          expect(m.quantityBefore, `${v.sku} avant`).toBe(running);
          running += m.quantityDelta;
          expect(m.quantityAfter, `${v.sku} après`).toBe(running);
          expect(running).toBeGreaterThanOrEqual(0);
        }
        expect(running, `${v.sku} final`).toBe(v.stock);
      }
    }
  });
});
