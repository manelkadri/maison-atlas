import { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS, canTransition } from "@fashion/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
  countByStatus,
  getAllowedTransitions,
  getPaymentDisplay,
  isFinalStatus,
  parseAmount,
  parseOrderStatusParam,
  requiresConfirmation,
  sortOrders,
} from "@/features/orders/logic";
import { inventoryService, orderService, productService } from "@/services";
import { resetDb } from "@/services/mock/db";
import type { CreateOrderInput, Order } from "@/types/order.types";

beforeEach(() => {
  resetDb();
});

/** Crée une commande réelle (stock réservé) sur une variante publiée ayant assez de stock. */
async function createTestOrder(quantity = 2): Promise<{ order: Order; variantId: string; stockBefore: number }> {
  const products = await productService.getProducts({ onlyPublic: true });
  const product = products.find((p) => p.variants.some((v) => v.stock >= quantity + 1))!;
  const variant = product.variants.find((v) => v.stock >= quantity + 1)!;
  const input: CreateOrderInput = {
    customer: { firstName: "Test", lastName: "Client", phone: "0555123456" },
    shippingAddress: { wilayaCode: "16", wilayaName: "Alger", commune: "Bab Ezzouar", address: "12 rue Test", deliveryMethod: "home" },
    items: [{ variantId: variant.id, quantity }],
  };
  const order = (await orderService.createOrder(input)) as Order; // le mock renvoie la commande complète
  return { order, variantId: variant.id, stockBefore: variant.stock };
}

async function stockOf(variantId: string): Promise<number> {
  return (await inventoryService.getInventory()).find((i) => i.variantId === variantId)!.stock;
}

describe("changement de statut des commandes (service)", () => {
  it("accepte une transition valide et l'ajoute à l'historique avec sa note", async () => {
    const { order } = await createTestOrder();
    const updated = await orderService.updateOrderStatus(order.id, "confirmed", "Client joint par téléphone");
    expect(updated.status).toBe("confirmed");
    const last = updated.statusHistory.at(-1)!;
    expect(last.status).toBe("confirmed");
    expect(last.note).toBe("Client joint par téléphone");
  });

  it("refuse une transition interdite avec INVALID_TRANSITION", async () => {
    const { order } = await createTestOrder();
    await expect(orderService.updateOrderStatus(order.id, "delivered")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect((await orderService.getOrderById(order.id))!.status).toBe("pending");
  });

  it("annulation : le stock réservé est restitué (variante exacte)", async () => {
    const { order, variantId, stockBefore } = await createTestOrder(2);
    expect(await stockOf(variantId)).toBe(stockBefore - 2);
    await orderService.updateOrderStatus(order.id, "cancelled");
    expect(await stockOf(variantId)).toBe(stockBefore);
  });

  it("refus : stock restitué ; échec de livraison : stock NON restitué", async () => {
    const a = await createTestOrder(1);
    await orderService.updateOrderStatus(a.order.id, "rejected");
    expect(await stockOf(a.variantId)).toBe(a.stockBefore);

    const b = await createTestOrder(1);
    for (const s of ["confirmed", "processing", "shipped", "delivery_failed"] as const) await orderService.updateOrderStatus(b.order.id, s);
    expect(await stockOf(b.variantId)).toBe(b.stockBefore - 1);
    expect((await orderService.getOrderById(b.order.id))!.paymentStatus).toBe("failed");
  });

  it("COD : le paiement reste « pending » jusqu'à la livraison, puis passe à « paid »", async () => {
    const { order } = await createTestOrder();
    expect(order.paymentStatus).toBe("pending");
    for (const s of ["confirmed", "processing", "shipped"] as const) {
      const o = await orderService.updateOrderStatus(order.id, s);
      expect(o.paymentStatus).toBe("pending");
    }
    const delivered = await orderService.updateOrderStatus(order.id, "delivered");
    expect(delivered.paymentStatus).toBe("paid");
  });

  it("retour après livraison : stock restitué et paiement en échec", async () => {
    const { order, variantId, stockBefore } = await createTestOrder(2);
    for (const s of ["confirmed", "processing", "shipped", "delivered"] as const) await orderService.updateOrderStatus(order.id, s);
    const returned = await orderService.updateOrderStatus(order.id, "returned");
    expect(returned.paymentStatus).toBe("failed");
    expect(await stockOf(variantId)).toBe(stockBefore);
  });

  it("statuts finaux : plus aucune modification possible", async () => {
    const { order } = await createTestOrder();
    await orderService.updateOrderStatus(order.id, "cancelled");
    for (const s of ORDER_STATUSES) {
      await expect(orderService.updateOrderStatus(order.id, s)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    }
  });

  it("commande inconnue : NOT_FOUND", async () => {
    await expect(orderService.updateOrderStatus("nope", "confirmed")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("logique des commandes (pure)", () => {
  it("n'expose que les transitions autorisées par la machine à états", () => {
    for (const from of ORDER_STATUSES) {
      const allowed = getAllowedTransitions(from);
      expect(allowed).toEqual([...ORDER_STATUS_TRANSITIONS[from]]);
      for (const to of ORDER_STATUSES) expect(allowed.includes(to)).toBe(canTransition(from, to));
    }
    expect(getAllowedTransitions("pending")).toEqual(["confirmed", "cancelled", "rejected"]);
  });

  it("identifie les statuts finaux et les changements sensibles à confirmer", () => {
    expect(["cancelled", "rejected", "returned"].every((s) => isFinalStatus(s as never))).toBe(true);
    expect(isFinalStatus("delivered")).toBe(false);
    for (const s of ["cancelled", "rejected", "delivery_failed", "returned", "delivered"] as const) expect(requiresConfirmation(s)).toBe(true);
    for (const s of ["confirmed", "processing", "shipped"] as const) expect(requiresConfirmation(s)).toBe(false);
  });

  it("affiche l'état du paiement COD sans ambiguïté", () => {
    expect(getPaymentDisplay({ paymentStatus: "pending", status: "shipped" }).label).toBe("À encaisser");
    expect(getPaymentDisplay({ paymentStatus: "paid", status: "delivered" }).label).toBe("Encaissé");
    expect(getPaymentDisplay({ paymentStatus: "failed", status: "delivery_failed" }).label).toBe("Échec");
    // Commande annulée : rien à encaisser, on n'affiche pas « À encaisser ».
    expect(getPaymentDisplay({ paymentStatus: "pending", status: "cancelled" }).label).toBe("Sans objet");
    // Expédition relancée après un échec : le service garde « failed », mais il y a de nouveau quelque chose à encaisser.
    expect(getPaymentDisplay({ paymentStatus: "failed", status: "shipped" }).label).toBe("À encaisser");
    expect(getPaymentDisplay({ paymentStatus: "failed", status: "returned" }).label).toBe("Échec");
  });

  it("compte les commandes par statut et trie par date / montant", async () => {
    const orders = await orderService.getOrders();
    const counts = countByStatus(orders);
    expect(counts.all).toBe(orders.length);
    expect(ORDER_STATUSES.reduce((s, st) => s + counts[st], 0)).toBe(orders.length);
    const byTotal = sortOrders(orders, "total_desc");
    for (let i = 1; i < byTotal.length; i++) expect(byTotal[i]!.total).toBeLessThanOrEqual(byTotal[i - 1]!.total);
    const byDate = sortOrders(orders, "date_asc");
    expect(byDate[0]!.createdAt <= byDate.at(-1)!.createdAt).toBe(true);
  });

  it("filtre le service par statut, dates et montants", async () => {
    const delivered = await orderService.getOrders({ status: "delivered" });
    expect(delivered.length).toBeGreaterThan(0);
    expect(delivered.every((o) => o.status === "delivered")).toBe(true);
    const big = await orderService.getOrders({ minTotal: 10000 });
    expect(big.every((o) => o.total >= 10000)).toBe(true);
  });

  it("interprète les paramètres d'URL et les montants saisis", () => {
    expect(parseOrderStatusParam("pending")).toBe("pending");
    expect(parseOrderStatusParam("zzz")).toBe("all");
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
    expect(parseAmount("-5")).toBeUndefined();
    expect(parseAmount("2500")).toBe(2500);
  });
});
