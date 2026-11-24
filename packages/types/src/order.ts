export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "rejected"
  | "delivery_failed"
  | "returned";

export type PaymentMethod = "cash_on_delivery";
/** COD : "pending" jusqu'à la livraison effective, puis "paid". */
export type PaymentStatus = "pending" | "paid" | "failed";
export type DeliveryMethod = "home" | "pickup_point";

/** Informations client figées au moment de la commande (commande invité autorisée). */
export type OrderCustomer = {
  /** Renseigné si la commande est rattachée à une fiche client. */
  customerId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
};

export type ShippingAddress = {
  wilayaCode: string;
  wilayaName: string;
  commune: string;
  address: string;
  deliveryMethod: DeliveryMethod;
  pickupPointId?: string;
  pickupPointName?: string;
};

/** Ligne de commande : les prix sont figés à l'achat (règle métier n°6). */
export type OrderItem = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  sku: string;
  color: string;
  colorCode: string;
  size: string;
  imageUrl: string;
  unitPrice: number;
  /** Coût unitaire au moment de la vente, pour le calcul de marge. */
  unitCost: number;
  quantity: number;
  lineTotal: number;
};

export type OrderStatusEvent = {
  status: OrderStatus;
  at: string;
  note?: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  customer: OrderCustomer;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  promoCode?: string;
  shippingFee: number;
  /** subtotal - discountTotal + shippingFee */
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryMethod: DeliveryMethod;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  customerNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderInput = {
  customer: OrderCustomer;
  shippingAddress: ShippingAddress;
  items: Array<{ variantId: string; quantity: number }>;
  promoCode?: string;
  customerNote?: string;
};

export type OrderFilters = {
  search?: string;
  status?: OrderStatus | "all";
  deliveryMethod?: DeliveryMethod | "all";
  dateFrom?: string;
  dateTo?: string;
  minTotal?: number;
  maxTotal?: number;
  customerId?: string;
  phone?: string;
};

/** Ligne de commande vue par la cliente : SANS le prix de revient (donnée interne de la boutique). */
export type CustomerOrderItem = Omit<OrderItem, "unitCost">;
/** Étape de l'historique vue par la cliente : SANS la note interne de l'administration. */
export type CustomerOrderStatusEvent = Omit<OrderStatusEvent, "note">;
/** Commande telle que la voit sa propriétaire (espace client). */
export type CustomerOrder = Omit<Order, "items" | "statusHistory"> & {
  items: CustomerOrderItem[];
  statusHistory: CustomerOrderStatusEvent[];
};

/**
 * Réponse du SUIVI PUBLIC d'une commande (numéro + téléphone) : le strict nécessaire pour suivre sa commande.
 * Volontairement SANS : identifiants internes (commande, client, produit, variante, SKU), prix de revient, notes internes de
 * l'administration, nom de famille, téléphone, e-mail, adresse postale, note de la cliente.
 * Construite champ par champ (liste blanche) : un champ ajouté plus tard à `Order` n'apparaît JAMAIS ici automatiquement.
 */
export type PublicTrackedOrder = {
  orderNumber: string;
  status: OrderStatus;
  statusHistory: Array<{ status: OrderStatus; at: string }>;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Prénom seulement. */
  customer: { firstName: string };
  /** Wilaya et commune seulement (pas la rue). */
  shippingAddress: { wilayaName: string; commune: string; deliveryMethod: DeliveryMethod; pickupPointName?: string };
  items: Array<{
    productName: string;
    productSlug: string;
    color: string;
    colorCode: string;
    size: string;
    imageUrl: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountTotal: number;
  promoCode?: string;
  shippingFee: number;
  total: number;
  createdAt: string;
  updatedAt: string;
};
