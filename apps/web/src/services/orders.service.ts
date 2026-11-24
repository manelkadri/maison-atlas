import {
  STOCK_RELEASING_STATUSES,
  buildOrderNumber,
  canTransition,
  computeOrderTotals,
  getShippingFee,
  normalizePhone,
  validatePromotion,
  ORDER_STATUS_LABELS,
} from "@fashion/shared";
import type { Customer } from "@/types/customer.types";
import type { Order, OrderFilters, OrderItem, PaymentStatus } from "@/types/order.types";
import type { OrderService } from "./contracts";
import { ServiceError } from "./errors";
import { commit, getDb, nextId } from "./mock/db";
import { pushMovement } from "./mock/movements";

function matchesFilters(order: Order, f: OrderFilters): boolean {
  if (f.status && f.status !== "all" && order.status !== f.status) return false;
  if (f.deliveryMethod && f.deliveryMethod !== "all" && order.deliveryMethod !== f.deliveryMethod) return false;
  if (f.customerId && order.customer.customerId !== f.customerId) return false;
  if (f.phone && normalizePhone(order.customer.phone) !== normalizePhone(f.phone)) return false;
  // Dates saisies en heure locale (jour entier inclus).
  if (f.dateFrom && new Date(order.createdAt) < new Date(`${f.dateFrom}T00:00:00`)) return false;
  if (f.dateTo && new Date(order.createdAt) > new Date(`${f.dateTo}T23:59:59.999`)) return false;
  if (f.minTotal !== undefined && order.total < f.minTotal) return false;
  if (f.maxTotal !== undefined && order.total > f.maxTotal) return false;
  if (f.search?.trim()) {
    const q = f.search.trim().toLowerCase();
    const hay = `${order.orderNumber} ${order.customer.firstName} ${order.customer.lastName} ${order.customer.phone} ${order.shippingAddress.wilayaName}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export const orderService: OrderService = {
  async getOrders(filters = {}) {
    return structuredClone(
      getDb()
        .orders.filter((o) => matchesFilters(o, filters))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },

  async getOrderById(id) {
    const o = getDb().orders.find((x) => x.id === id);
    return o ? structuredClone(o) : null;
  },

  async getOrderByNumber(orderNumber, phone) {
    const o = getDb().orders.find((x) => x.orderNumber === orderNumber);
    if (!o) return null;
    // Suivi public : le téléphone doit correspondre (comme `GET /orders/track` côté API).
    if (phone !== undefined && normalizePhone(o.customer.phone) !== normalizePhone(phone)) return null;
    return structuredClone(o);
  },

  async createOrder(input) {
    const db = getDb();
    if (input.items.length === 0) throw new ServiceError("VALIDATION", "Votre panier est vide.");

    // 1. Vérifier chaque VARIANTE (jamais le stock global du produit).
    const requested = new Map<string, number>();
    for (const it of input.items) requested.set(it.variantId, (requested.get(it.variantId) ?? 0) + it.quantity);

    const items: OrderItem[] = [];
    let line = 0;
    for (const [variantId, quantity] of requested) {
      const product = db.products.find((p) => p.variants.some((v) => v.id === variantId));
      const variant = product?.variants.find((v) => v.id === variantId);
      if (!product || !variant || !product.isPublished || product.isArchived) {
        throw new ServiceError("NOT_FOUND", "Un article de votre panier n'est plus disponible.");
      }
      if (quantity < 1) throw new ServiceError("VALIDATION", "Quantité invalide.");
      if (variant.stock < quantity) {
        throw new ServiceError(
          "OUT_OF_STOCK",
          variant.stock === 0
            ? `« ${product.name} » (${variant.color}, ${variant.size}) est en rupture de stock.`
            : `« ${product.name} » (${variant.color}, ${variant.size}) : il ne reste que ${variant.stock} pièce(s).`,
        );
      }
      line += 1;
      items.push({
        id: nextId("oi"),
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        productSlug: product.slug,
        sku: variant.sku,
        color: variant.color,
        colorCode: variant.colorCode,
        size: variant.size,
        imageUrl: (product.images.find((im) => im.color === variant.color) ?? product.images[0])?.url ?? "",
        unitPrice: variant.price, // prix figé à l'achat
        unitCost: product.costPrice,
        quantity,
        lineTotal: variant.price * quantity,
      });
    }
    void line;

    // 2. Totaux : sous-total, remise, livraison (séparée), total.
    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    let discount = 0;
    let promoCode: string | undefined;
    if (input.promoCode?.trim()) {
      const promo = db.promotions.find((p) => p.code.toUpperCase() === input.promoCode!.trim().toUpperCase());
      const check = validatePromotion(promo, subtotal);
      if (!check.valid) throw new ServiceError("VALIDATION", check.reason);
      discount = check.discount;
      promoCode = check.promotion.code;
      promo!.usageCount += 1;
    }
    const shippingFee = getShippingFee(db.settings, input.shippingAddress.wilayaCode, input.shippingAddress.deliveryMethod, subtotal);
    const totals = computeOrderTotals({ subtotal, discount, shippingFee });

    // 3. Client : réutilise la fiche correspondant au téléphone, sinon crée un client invité.
    const phoneKey = normalizePhone(input.customer.phone);
    let customer: Customer | undefined = db.customers.find((c) => normalizePhone(c.phone) === phoneKey);
    if (!customer) {
      customer = {
        id: nextId("cust"),
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        phone: input.customer.phone,
        email: input.customer.email,
        wilayaCode: input.shippingAddress.wilayaCode,
        commune: input.shippingAddress.commune,
        address: input.shippingAddress.address,
        isGuest: true,
        createdAt: new Date().toISOString(),
      };
      db.customers.push(customer);
    }

    // 4. Créer la commande.
    const now = new Date();
    const order: Order = {
      id: nextId("ord"),
      orderNumber: buildOrderNumber(db.orderSequence++, now),
      customer: { ...input.customer, customerId: customer.id },
      shippingAddress: input.shippingAddress,
      items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      promoCode,
      shippingFee: totals.shippingFee,
      total: totals.total,
      paymentMethod: "cash_on_delivery",
      paymentStatus: "pending", // COD : rien n'est encaissé à la commande (règle n°7)
      deliveryMethod: input.shippingAddress.deliveryMethod,
      status: "pending",
      statusHistory: [{ status: "pending", at: now.toISOString() }],
      customerNote: input.customerNote?.trim() || undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    db.orders.unshift(order);

    // 5. Réserver le stock par variante + historiser.
    for (const it of items) {
      const product = db.products.find((p) => p.id === it.productId)!;
      const variant = product.variants.find((v) => v.id === it.variantId)!;
      const before = variant.stock;
      variant.stock -= it.quantity;
      product.soldCount += it.quantity;
      pushMovement({
        product, variant, type: "sale", delta: -it.quantity, before,
        reason: "Commande client", reference: order.orderNumber,
      });
    }

    commit();
    return structuredClone(order);
  },

  async updateOrderStatus(id, status, note) {
    const db = getDb();
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new ServiceError("NOT_FOUND", "Commande introuvable.");
    if (!canTransition(order.status, status)) {
      throw new ServiceError(
        "INVALID_TRANSITION",
        `Transition impossible : « ${ORDER_STATUS_LABELS[order.status]} » → « ${ORDER_STATUS_LABELS[status]} ».`,
      );
    }

    // Libération du stock si la commande n'aboutit pas (annulée, refusée, retournée).
    if (STOCK_RELEASING_STATUSES.includes(status)) {
      for (const it of order.items) {
        const product = db.products.find((p) => p.id === it.productId);
        const variant = product?.variants.find((v) => v.id === it.variantId);
        if (!product || !variant) continue;
        const before = variant.stock;
        variant.stock += it.quantity;
        product.soldCount = Math.max(0, product.soldCount - it.quantity);
        pushMovement({
          product, variant, type: "return", delta: it.quantity, before,
          reason: `Commande ${ORDER_STATUS_LABELS[status].toLowerCase()}`, reference: order.orderNumber,
        });
      }
    }

    // COD : le paiement n'est "paid" qu'à la livraison effective.
    const payment: PaymentStatus =
      status === "delivered"
        ? "paid"
        : status === "delivery_failed" || status === "returned"
          ? "failed"
          : status === "shipped"
            ? "pending" // nouvelle tentative de livraison après un échec : à nouveau à encaisser
            : order.paymentStatus;

    const at = new Date().toISOString();
    order.status = status;
    order.paymentStatus = payment;
    order.updatedAt = at;
    order.statusHistory.push({ status, at, note: note?.trim() || undefined });
    commit();
    return structuredClone(order);
  },
};
