import type { Order, OrderItem, OrderStatus, OrderStatusEvent } from "@/types/order.types";
import {
  buildOrderNumber,
  computeOrderTotals,
  computePromoDiscount,
  getPickupPointsForWilaya,
  getShippingFee,
  getWilaya,
} from "@fashion/shared";
import { customersMock } from "./customers.mock";
import { createRng, daysAgo } from "./helpers";
import { productsMock } from "./products.mock";
import { promotionsMock } from "./promotions.mock";
import { settingsMock } from "./settings.mock";

/**
 * Commandes de démonstration générées de façon déterministe sur ~90 jours.
 * Les prix et coûts sont figés dans chaque ligne (règle métier n°6).
 */

const rng = createRng(20260101);
const sellable = productsMock.filter((p) => p.isPublished && !p.isArchived);
// Pondération : les produits populaires reviennent plus souvent.
const weighted = sellable.flatMap((p) => Array<typeof p>(Math.max(1, Math.round(p.soldCount / 40))).fill(p));

const STATUS_PATH: Record<OrderStatus, OrderStatus[]> = {
  pending: ["pending"],
  confirmed: ["pending", "confirmed"],
  processing: ["pending", "confirmed", "processing"],
  shipped: ["pending", "confirmed", "processing", "shipped"],
  delivered: ["pending", "confirmed", "processing", "shipped", "delivered"],
  cancelled: ["pending", "cancelled"],
  rejected: ["pending", "rejected"],
  delivery_failed: ["pending", "confirmed", "processing", "shipped", "delivery_failed"],
  returned: ["pending", "confirmed", "processing", "shipped", "delivered", "returned"],
};

function pickStatus(ageDays: number): OrderStatus {
  if (ageDays <= 1) return rng.pick<OrderStatus>(["pending", "pending", "confirmed"]);
  if (ageDays <= 3) return rng.pick<OrderStatus>(["confirmed", "processing", "pending", "cancelled"]);
  if (ageDays <= 6) return rng.pick<OrderStatus>(["processing", "shipped", "shipped", "confirmed", "rejected"]);
  const r = rng.next();
  if (r < 0.66) return "delivered";
  if (r < 0.74) return "cancelled";
  if (r < 0.8) return "rejected";
  if (r < 0.88) return "delivery_failed";
  if (r < 0.94) return "returned";
  return "shipped";
}

const ORDER_COUNT = 72;

const drafts = Array.from({ length: ORDER_COUNT }, (_, i) => {
  // Les commandes récentes sont un peu plus nombreuses que les anciennes.
  const ageDays = Math.floor(Math.pow(rng.next(), 1.35) * 90);
  return { index: i, ageDays, hour: rng.int(8, 21), minute: rng.int(0, 59) };
}).sort((a, b) => b.ageDays - a.ageDays || a.hour - b.hour);

let sequence = 0;

export const ordersMock: Order[] = drafts.map((d) => {
  sequence += 1;
  const createdAt = daysAgo(d.ageDays, d.hour, d.minute);
  const customer = rng.pick(customersMock);
  const wilaya = getWilaya(customer.wilayaCode)!;
  const deliveryMethod = rng.chance(0.62) ? ("home" as const) : ("pickup_point" as const);
  const pickup = deliveryMethod === "pickup_point" ? rng.pick(getPickupPointsForWilaya(wilaya.code)) : undefined;

  // 1 à 3 lignes distinctes
  const lineCount = rng.pick([1, 1, 1, 2, 2, 3]);
  const items: OrderItem[] = [];
  for (let l = 0; l < lineCount; l++) {
    const product = rng.pick(weighted);
    const variant = rng.pick(product.variants);
    if (items.some((it) => it.variantId === variant.id)) continue;
    const quantity = rng.chance(0.2) ? 2 : 1;
    items.push({
      id: `oi_${sequence}_${l + 1}`,
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      productSlug: product.slug,
      sku: variant.sku,
      color: variant.color,
      colorCode: variant.colorCode,
      size: variant.size,
      imageUrl: product.images.find((im) => im.color === variant.color)?.url ?? product.images[0]!.url,
      unitPrice: variant.price,
      unitCost: product.costPrice,
      quantity,
      lineTotal: variant.price * quantity,
    });
  }

  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
  const promo = rng.chance(0.2) ? promotionsMock[0]! : undefined;
  const promoApplies = promo && subtotal >= promo.minOrderAmount;
  const discount = promoApplies ? computePromoDiscount(promo, subtotal) : 0;
  const shippingFee = getShippingFee(settingsMock, wilaya.code, deliveryMethod, subtotal);
  const totals = computeOrderTotals({ subtotal, discount, shippingFee });

  const status = pickStatus(d.ageDays);
  const path = STATUS_PATH[status];
  const history: OrderStatusEvent[] = path.map((s, idx) => ({
    status: s,
    at: new Date(new Date(createdAt).getTime() + idx * (7 + idx * 5) * 3600 * 1000).toISOString(),
  }));
  const lastAt = history[history.length - 1]!.at;

  return {
    id: `ord_${String(sequence).padStart(4, "0")}`,
    orderNumber: buildOrderNumber(sequence, new Date(createdAt)),
    customer: {
      customerId: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email,
    },
    shippingAddress: {
      wilayaCode: wilaya.code,
      wilayaName: wilaya.name,
      commune: customer.commune,
      address: deliveryMethod === "home" ? customer.address : "",
      deliveryMethod,
      pickupPointId: pickup?.id,
      pickupPointName: pickup?.name,
    },
    items,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    promoCode: promoApplies ? promo.code : undefined,
    shippingFee: totals.shippingFee,
    total: totals.total,
    paymentMethod: "cash_on_delivery" as const,
    // COD : rien n'est encaissé avant la livraison effective.
    paymentStatus: status === "delivered" ? ("paid" as const) : status === "delivery_failed" || status === "returned" ? ("failed" as const) : ("pending" as const),
    deliveryMethod,
    status,
    statusHistory: history,
    customerNote: rng.chance(0.12) ? "Merci d'appeler avant la livraison." : undefined,
    createdAt,
    updatedAt: lastAt,
  };
});

/** Numéro de séquence à utiliser pour la prochaine commande créée. */
export const ORDER_SEQUENCE_START = sequence + 1;
