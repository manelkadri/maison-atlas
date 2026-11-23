import { describe, expect, it } from "vitest";
import { categoryHref, getRootCategories } from "@/components/layout/category-links";
import { buildTimeline, describePayment, isOwnOrder, normalizePhone, paymentCaption } from "@/components/store/account/order-utils";
import type { Order } from "@/types/order.types";
import type { Category } from "@/types/product.types";

describe("normalizePhone / isOwnOrder", () => {
  it("considère les formats +213, 00213 et 0 comme identiques", () => {
    expect(normalizePhone("+213 555 12 34 56")).toBe("0555123456");
    expect(normalizePhone("00213555123456")).toBe("0555123456");
    expect(normalizePhone("0555 12 34 56")).toBe("0555123456");
  });

  it("n'autorise que les commandes du même téléphone", () => {
    const order = { customer: { phone: "0555 12 34 56" } } as Pick<Order, "customer">;
    expect(isOwnOrder(order, "+213555123456")).toBe(true);
    expect(isOwnOrder(order, "0661234567")).toBe(false);
    expect(isOwnOrder(order, null)).toBe(false);
  });
});

describe("buildTimeline", () => {
  it("ajoute les étapes à venir pour une commande en cours", () => {
    const steps = buildTimeline({
      status: "confirmed",
      createdAt: "2026-01-01T10:00:00.000Z",
      statusHistory: [
        { status: "confirmed", at: "2026-01-01T12:00:00.000Z" },
        { status: "pending", at: "2026-01-01T10:00:00.000Z" },
      ],
    });
    expect(steps.map((s) => [s.status, s.state])).toEqual([
      ["pending", "done"],
      ["confirmed", "current"],
      ["processing", "upcoming"],
      ["shipped", "upcoming"],
      ["delivered", "upcoming"],
    ]);
  });

  it("n'ajoute rien après une livraison ni après un échec", () => {
    const delivered = buildTimeline({
      status: "delivered",
      createdAt: "2026-01-01T10:00:00.000Z",
      statusHistory: [{ status: "delivered", at: "2026-01-02T10:00:00.000Z" }],
    });
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.state).toBe("done");

    const cancelled = buildTimeline({
      status: "cancelled",
      createdAt: "2026-01-01T10:00:00.000Z",
      statusHistory: [
        { status: "pending", at: "2026-01-01T10:00:00.000Z" },
        { status: "cancelled", at: "2026-01-01T11:00:00.000Z" },
      ],
    });
    expect(cancelled.map((s) => s.state)).toEqual(["done", "failed"]);
  });

  it("retombe sur le statut courant si l'historique est vide", () => {
    const steps = buildTimeline({ status: "pending", createdAt: "2026-01-01T10:00:00.000Z", statusHistory: [] });
    expect(steps[0]).toMatchObject({ status: "pending", state: "current" });
  });
});

describe("paiement à la livraison", () => {
  it("n'affirme jamais qu'une commande non livrée est encaissée", () => {
    expect(describePayment({ paymentStatus: "pending", status: "shipped" }).detail).toMatch(/non encaissé/i);
    expect(paymentCaption({ paymentStatus: "pending", status: "shipped" })).toBe("à payer à la livraison");
    expect(paymentCaption({ paymentStatus: "pending", status: "cancelled" })).toBeNull();
    expect(paymentCaption({ paymentStatus: "paid", status: "delivered" })).toBe("payée à la livraison");
  });
});

describe("categoryHref / getRootCategories", () => {
  const cat = (over: Partial<Category>): Category => ({
    id: "1",
    name: "X",
    slug: "x",
    description: "",
    imageUrl: "",
    kind: "category",
    parentId: null,
    displayOrder: 1,
    isArchived: false,
    createdAt: "",
    ...over,
  });

  it("route les collections vers le filtre collection", () => {
    expect(categoryHref(cat({ slug: "nouveautes", kind: "collection" }))).toBe("/shop?collection=new");
    expect(categoryHref(cat({ slug: "femme" }))).toBe("/shop?category=femme");
  });

  it("ne garde que les racines non archivées, triées", () => {
    const list = [
      cat({ id: "b", slug: "b", displayOrder: 2 }),
      cat({ id: "a", slug: "a", displayOrder: 1 }),
      cat({ id: "c", parentId: "a" }),
      cat({ id: "d", isArchived: true }),
    ];
    expect(getRootCategories(list).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
