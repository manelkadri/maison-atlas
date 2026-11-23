import { z } from "zod";

/* ---------- Primitives ---------- */

/** Téléphone algérien : 05/06/07 + 8 chiffres (formats +213 / 00213 acceptés). */
export const algerianPhoneRegex = /^(?:(?:\+|00)213|0)\s?[5-7](?:[\s.-]?\d){8}$/;

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Le numéro de téléphone est obligatoire.")
  .regex(algerianPhoneRegex, "Numéro invalide. Exemple : 0555 12 34 56.");

const requiredText = (label: string, min = 2, max = 80) =>
  z
    .string()
    .trim()
    .min(1, `${label} est obligatoire.`)
    .min(min, `${label} doit contenir au moins ${min} caractères.`)
    .max(max, `${label} ne peut pas dépasser ${max} caractères.`);

const money = (label: string) =>
  z.number({ error: `${label} doit être un nombre.` }).int(`${label} doit être un entier (DZD).`).min(0, `${label} ne peut pas être négatif.`);

/* ---------- Checkout ---------- */

export const checkoutSchema = z
  .object({
    lastName: requiredText("Le nom"),
    firstName: requiredText("Le prénom"),
    phone: phoneSchema,
    wilayaCode: z.string().min(1, "Veuillez choisir une wilaya."),
    commune: requiredText("La commune"),
    address: z.string().trim().max(200, "L'adresse est trop longue."),
    deliveryMethod: z.enum(["home", "pickup_point"], { error: "Choisissez un mode de livraison." }),
    pickupPointId: z.string().optional(),
    note: z.string().trim().max(300, "La remarque ne peut pas dépasser 300 caractères.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMethod === "home" && data.address.trim().length < 5) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "L'adresse complète est obligatoire pour la livraison à domicile." });
    }
    if (data.deliveryMethod === "pickup_point" && !data.pickupPointId) {
      ctx.addIssue({ code: "custom", path: ["pickupPointId"], message: "Veuillez choisir un bureau de livraison." });
    }
  });
export type CheckoutFormValues = z.infer<typeof checkoutSchema>;

/* ---------- Newsletter / auth simulée ---------- */

export const newsletterSchema = z.object({
  email: z.string().trim().min(1, "L'e-mail est obligatoire.").email("Adresse e-mail invalide."),
});
export type NewsletterValues = z.infer<typeof newsletterSchema>;

export const adminLoginSchema = z.object({
  email: z.string().trim().min(1, "L'e-mail est obligatoire.").email("Adresse e-mail invalide."),
  password: z.string().min(1, "Le mot de passe est obligatoire."),
});
export type AdminLoginValues = z.infer<typeof adminLoginSchema>;

export const customerLoginSchema = z.object({
  phone: phoneSchema,
});
export type CustomerLoginValues = z.infer<typeof customerLoginSchema>;

export const profileSchema = z.object({
  firstName: requiredText("Le prénom"),
  lastName: requiredText("Le nom"),
  phone: phoneSchema,
  email: z.string().trim().email("Adresse e-mail invalide.").or(z.literal("")).optional(),
});
export type ProfileValues = z.infer<typeof profileSchema>;

/* ---------- Produit (admin) ---------- */

export const variantFormSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, "SKU requis."),
  color: z.string().min(1),
  colorCode: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  size: z.string().min(1),
  price: money("Le prix de la variante"),
  stock: z.number().int("Entier requis.").min(0, "Le stock ne peut pas être négatif."),
  alertThreshold: z.number().int().min(0),
});

export const productImageSchema = z.object({
  id: z.string(),
  url: z.string().min(1),
  alt: z.string(),
  color: z.string().optional(),
  position: z.number().int(),
});

export const productFormSchema = z
  .object({
    name: requiredText("Le nom du produit", 3, 120),
    slug: z
      .string()
      .trim()
      .min(1, "Le slug est obligatoire.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (minuscules, chiffres et tirets)."),
    reference: requiredText("La référence", 3, 30),
    description: requiredText("La description", 10, 2000),
    categoryId: z.string().min(1, "Veuillez choisir une catégorie."),
    gender: z.enum(["women", "men", "unisex"]),
    tags: z.array(z.string()),
    /** Prix de vente "normal". */
    regularPrice: money("Le prix de vente").min(1, "Le prix de vente est obligatoire."),
    /** Prix promotionnel (optionnel) — doit être inférieur au prix de vente. */
    promoPrice: money("Le prix promotionnel").optional(),
    costPrice: money("Le prix d'achat"),
    images: z.array(productImageSchema).min(1, "Ajoutez au moins une image."),
    colors: z.array(z.object({ name: z.string().min(1), code: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).min(1, "Choisissez au moins une couleur."),
    sizes: z.array(z.string().min(1)).min(1, "Choisissez au moins une taille."),
    variants: z.array(variantFormSchema).min(1, "Aucune variante générée."),
    defaultAlertThreshold: z.number().int().min(0),
    isPublished: z.boolean(),
    isFeatured: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.promoPrice !== undefined && data.promoPrice >= data.regularPrice) {
      ctx.addIssue({ code: "custom", path: ["promoPrice"], message: "Le prix promotionnel doit être inférieur au prix de vente." });
    }
    const skus = data.variants.map((v) => v.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Chaque variante doit avoir un SKU unique." });
    }
  });
export type ProductFormValues = z.infer<typeof productFormSchema>;

/* ---------- Catégorie ---------- */

export const categoryFormSchema = z.object({
  name: requiredText("Le nom", 2, 60),
  slug: z.string().trim().min(1, "Le slug est obligatoire.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide."),
  description: z.string().trim().max(300, "300 caractères maximum."),
  imageUrl: z.string().trim(),
  parentId: z.string().nullable(),
  displayOrder: z.number().int().min(0),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

/* ---------- Stock ---------- */

export const stockMovementSchema = z
  .object({
    variantId: z.string().min(1, "Choisissez une variante."),
    type: z.enum(["in", "out", "adjustment", "return"]),
    quantity: z.number({ error: "Quantité invalide." }).int("Quantité entière requise.").min(0, "La quantité ne peut pas être négative."),
    reason: requiredText("Le motif", 3, 160),
    date: z.string().min(1, "La date est obligatoire."),
  })
  .superRefine((d, ctx) => {
    if (d.type !== "adjustment" && d.quantity < 1) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "La quantité doit être d'au moins 1." });
    }
  });
export type StockMovementValues = z.infer<typeof stockMovementSchema>;

/* ---------- Promotion ---------- */

export const promotionFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Le code doit contenir au moins 3 caractères.")
      .max(24)
      .regex(/^[A-Z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement."),
    label: requiredText("Le libellé", 3, 80),
    type: z.enum(["percentage", "fixed"]),
    value: z.number({ error: "Valeur invalide." }).int().min(1, "La valeur doit être supérieure à 0."),
    startsAt: z.string().min(1, "Date de début requise."),
    endsAt: z.string().min(1, "Date de fin requise."),
    minOrderAmount: money("Le montant minimum"),
    isActive: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "percentage" && d.value > 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Un pourcentage ne peut pas dépasser 100." });
    }
    if (d.startsAt && d.endsAt && new Date(d.endsAt) < new Date(d.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "La date de fin doit être postérieure au début." });
    }
  });
export type PromotionFormValues = z.infer<typeof promotionFormSchema>;

/* ---------- Paramètres ---------- */

const zoneFees = z.object({ home: money("Tarif domicile"), pickupPoint: money("Tarif bureau") });

export const settingsFormSchema = z.object({
  storeName: requiredText("Le nom de la boutique", 2, 60),
  tagline: z.string().trim().max(120),
  logoUrl: z.string().trim(),
  phone: phoneSchema,
  email: z.string().trim().email("E-mail invalide."),
  address: requiredText("L'adresse", 5, 200),
  openingHours: z.string().trim().max(200, "200 caractères maximum."),
  plusCode: z.string().trim().max(80, "80 caractères maximum."),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v === "" || algerianPhoneRegex.test(v), "Numéro invalide. Exemple : 0552 82 60 75."),
  social: z.object({
    instagram: z.string().trim(),
    tiktok: z.string().trim(),
  }),
  shippingFees: z.object({ "1": zoneFees, "2": zoneFees, "3": zoneFees }),
  freeShippingThreshold: money("Le seuil de livraison offerte"),
  defaultAlertThreshold: z.number().int().min(0, "Seuil invalide."),
});
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
