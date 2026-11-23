import type { DeliveryMethod, OrderStatus } from "@fashion/types";
import { checkoutSchema } from "@fashion/validators";
import { z } from "zod";
import { validation } from "../../utils/errors";

/** "" (champ de formulaire vide) → absent. */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalInt = z.preprocess(blankToUndefined, z.coerce.number().int().min(0).max(1_000_000_000).optional());
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const dateOnly = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Date invalide.")
    .optional(),
);

export const MAX_LINES = 20;
export const MAX_QUANTITY = 20;

const STATUS_VALUES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "rejected", "delivery_failed", "returned"] as const satisfies readonly OrderStatus[];
const DELIVERY_VALUES = ["home", "pickup_point"] as const satisfies readonly DeliveryMethod[];

/** Forme de `CreateOrderInput` (montants, prix, noms de wilaya/bureau éventuellement envoyés sont ignorés). */
export const createOrderShape = z.object({
  customer: z.object({
    firstName: z.string().max(200),
    lastName: z.string().max(200),
    phone: z.string().max(40),
    email: z.string().trim().max(200).optional(),
  }),
  shippingAddress: z.object({
    wilayaCode: z.string().max(10),
    commune: z.string().max(200),
    address: z.string().max(400),
    deliveryMethod: z.enum(DELIVERY_VALUES),
    pickupPointId: z.string().max(60).optional(),
  }),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1).max(64),
        quantity: z
          .number("Quantité invalide.")
          .int("Quantité entière requise.")
          .min(1, "Quantité invalide.")
          .max(MAX_QUANTITY, `Quantité maximale : ${MAX_QUANTITY} par ligne.`),
      }),
    )
    .min(1, "Votre panier est vide.")
    .max(MAX_LINES, `Un panier ne peut pas dépasser ${MAX_LINES} lignes.`),
  promoCode: z.string().trim().max(60).optional(),
  customerNote: z.string().max(1000).optional(),
});

export type ParsedCreateOrder = {
  customer: { firstName: string; lastName: string; phone: string; email: string | undefined };
  shippingAddress: {
    wilayaCode: string;
    commune: string;
    address: string;
    deliveryMethod: DeliveryMethod;
    pickupPointId: string | undefined;
  };
  items: Array<{ variantId: string; quantity: number }>;
  promoCode: string | undefined;
  customerNote: string | undefined;
};

const emailSchema = z.string().trim().email("Adresse e-mail invalide.");

/**
 * Valide le corps d'une commande. Client + adresse passent par `checkoutSchema` (mêmes règles et mêmes
 * messages que le formulaire du site) ; la cohérence wilaya / bureau est vérifiée ensuite par le service.
 */
export function parseCreateOrder(body: unknown): ParsedCreateOrder {
  const shape = createOrderShape.safeParse(body);
  if (!shape.success) {
    const issue = shape.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")} : ` : "";
    throw validation(`Commande invalide — ${path}${issue?.message ?? "valeur incorrecte"}`, shape.error.issues);
  }
  const { customer, shippingAddress, items, promoCode, customerNote } = shape.data;

  const checkout = checkoutSchema.safeParse({
    lastName: customer.lastName,
    firstName: customer.firstName,
    phone: customer.phone,
    wilayaCode: shippingAddress.wilayaCode,
    commune: shippingAddress.commune,
    address: shippingAddress.address,
    deliveryMethod: shippingAddress.deliveryMethod,
    pickupPointId: shippingAddress.pickupPointId,
    note: customerNote?.trim() || undefined,
  });
  if (!checkout.success) {
    const issue = checkout.error.issues[0];
    throw validation(issue?.message ?? "Informations de commande invalides.", checkout.error.issues);
  }

  let email: string | undefined;
  if (customer.email) {
    const parsed = emailSchema.safeParse(customer.email);
    if (!parsed.success) throw validation("Adresse e-mail invalide.");
    email = parsed.data;
  }

  const c = checkout.data;
  return {
    customer: { firstName: c.firstName, lastName: c.lastName, phone: c.phone, email },
    shippingAddress: {
      wilayaCode: c.wilayaCode,
      commune: c.commune,
      address: c.address,
      deliveryMethod: c.deliveryMethod,
      pickupPointId: c.deliveryMethod === "pickup_point" ? c.pickupPointId : undefined,
    },
    items,
    promoCode: promoCode || undefined,
    customerNote: c.note || undefined,
  };
}

/** Suivi public : numéro + téléphone (toute entrée invalide aboutit à la même 404 que « introuvable »). */
export const trackQuerySchema = z.object({ number: z.string().trim().min(1).max(40), phone: z.string().trim().min(1).max(40) });

export const orderFiltersSchema = z.object({
  search: optionalText(100),
  status: z.preprocess(blankToUndefined, z.enum([...STATUS_VALUES, "all"]).optional()),
  deliveryMethod: z.preprocess(blankToUndefined, z.enum([...DELIVERY_VALUES, "all"]).optional()),
  dateFrom: dateOnly,
  dateTo: dateOnly,
  minTotal: optionalInt,
  maxTotal: optionalInt,
  customerId: optionalText(64),
  phone: optionalText(40),
});
export type ParsedOrderFilters = z.infer<typeof orderFiltersSchema>;

export const idParamSchema = z.object({ id: z.string().min(1).max(64) });
export const numberParamSchema = z.object({ number: z.string().trim().min(1).max(40) });

export const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES),
  note: z.string().trim().max(300).optional(),
});
