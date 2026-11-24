import type { CustomerOrder, Order, OrderItem, OrderStatusEvent, PublicTrackedOrder } from "@fashion/types";
import type { Prisma } from "@prisma/client";

/** Relations chargées avec une commande pour produire le type partagé `Order`. */
export const orderInclude = {
  items: { orderBy: { id: "asc" } },
  history: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.OrderInclude;

export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
/** Variante légère (statistiques) : l'historique de statuts n'est pas chargé. */
export type OrderRowLite = Omit<OrderRow, "history"> & { history?: OrderRow["history"] };

type ItemRow = OrderRow["items"][number];

export function toOrderItem(row: ItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    productName: row.productName,
    productSlug: row.productSlug,
    sku: row.sku,
    color: row.color,
    colorCode: row.colorCode,
    size: row.size,
    imageUrl: row.imageUrl,
    unitPrice: row.unitPrice,
    unitCost: row.unitCost,
    quantity: row.quantity,
    lineTotal: row.lineTotal,
  };
}

/** Commande Prisma → `Order` du contrat (dates ISO, champs vides omis). */
export function toOrder(row: OrderRowLite): Order {
  const statusHistory: OrderStatusEvent[] = (row.history ?? []).map((h) => ({
    status: h.status,
    at: h.createdAt.toISOString(),
    ...(h.note ? { note: h.note } : {}),
  }));
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customer: {
      ...(row.customerId ? { customerId: row.customerId } : {}),
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      phone: row.customerPhone,
      ...(row.customerEmail ? { email: row.customerEmail } : {}),
    },
    shippingAddress: {
      wilayaCode: row.wilayaCode,
      wilayaName: row.wilayaName,
      commune: row.commune,
      address: row.address,
      deliveryMethod: row.deliveryMethod,
      ...(row.pickupPointId ? { pickupPointId: row.pickupPointId } : {}),
      ...(row.pickupPointName ? { pickupPointName: row.pickupPointName } : {}),
    },
    items: row.items.map(toOrderItem),
    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    ...(row.promoCode ? { promoCode: row.promoCode } : {}),
    shippingFee: row.shippingFee,
    total: row.total,
    paymentMethod: "cash_on_delivery", // contrainte CHECK : COD uniquement
    paymentStatus: row.paymentStatus,
    deliveryMethod: row.deliveryMethod,
    status: row.status,
    statusHistory,
    ...(row.customerNote ? { customerNote: row.customerNote } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Commande vue par SA propriétaire (espace client, réponse à la création d'une commande).
 * Construite champ par champ (liste blanche) : SANS prix de revient (`unitCost`) ni notes internes de l'historique, et un champ
 * ajouté plus tard à `Order` n'y apparaît jamais automatiquement.
 */
export function toCustomerOrder(row: OrderRowLite): CustomerOrder {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customer: {
      ...(row.customerId ? { customerId: row.customerId } : {}),
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      phone: row.customerPhone,
      ...(row.customerEmail ? { email: row.customerEmail } : {}),
    },
    shippingAddress: {
      wilayaCode: row.wilayaCode,
      wilayaName: row.wilayaName,
      commune: row.commune,
      address: row.address,
      deliveryMethod: row.deliveryMethod,
      ...(row.pickupPointId ? { pickupPointId: row.pickupPointId } : {}),
      ...(row.pickupPointName ? { pickupPointName: row.pickupPointName } : {}),
    },
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      productSlug: item.productSlug,
      sku: item.sku,
      color: item.color,
      colorCode: item.colorCode,
      size: item.size,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    ...(row.promoCode ? { promoCode: row.promoCode } : {}),
    shippingFee: row.shippingFee,
    total: row.total,
    paymentMethod: "cash_on_delivery",
    paymentStatus: row.paymentStatus,
    deliveryMethod: row.deliveryMethod,
    status: row.status,
    statusHistory: (row.history ?? []).map((h) => ({ status: h.status, at: h.createdAt.toISOString() })),
    ...(row.customerNote ? { customerNote: row.customerNote } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Réponse du SUIVI PUBLIC (numéro + téléphone) : voir `PublicTrackedOrder`. Construite champ par champ à partir de la LIGNE de base
 * de données — jamais à partir de `toOrder` / `toCustomerOrder` — pour que rien d'interne ne puisse y passer par accident.
 */
export function toPublicTrackedOrder(row: OrderRowLite): PublicTrackedOrder {
  return {
    orderNumber: row.orderNumber,
    status: row.status,
    statusHistory: (row.history ?? []).map((h) => ({ status: h.status, at: h.createdAt.toISOString() })),
    paymentMethod: "cash_on_delivery",
    paymentStatus: row.paymentStatus,
    customer: { firstName: row.customerFirstName },
    shippingAddress: {
      wilayaName: row.wilayaName,
      commune: row.commune,
      deliveryMethod: row.deliveryMethod,
      ...(row.pickupPointName ? { pickupPointName: row.pickupPointName } : {}),
    },
    items: row.items.map((item) => ({
      productName: item.productName,
      productSlug: item.productSlug,
      color: item.color,
      colorCode: item.colorCode,
      size: item.size,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    ...(row.promoCode ? { promoCode: row.promoCode } : {}),
    shippingFee: row.shippingFee,
    total: row.total,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
