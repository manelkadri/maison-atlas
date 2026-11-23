import { z } from "zod";

const money = z.number().int("Entier requis (DZD).").min(0, "Un montant ne peut pas être négatif.").max(100_000_000);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.");
const slugField = z
  .string()
  .trim()
  .max(120)
  .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Slug invalide (minuscules, chiffres et tirets).");

/** Les images sont affichées par `<img src>` : on n'accepte que des URL http(s) ou des chemins du site. */
const imageUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((u) => /^(https?:\/\/|\/(?!\/))/i.test(u), "URL d'image invalide.");

export const variantInputSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, "SKU requis.").max(64),
  color: z.string().trim().min(1).max(40),
  colorCode: hexColor,
  size: z.string().trim().min(1).max(20),
  price: money,
  stock: z.number().int("Entier requis.").min(0, "Le stock ne peut pas être négatif.").max(1_000_000),
  alertThreshold: z.number().int().min(0).max(1_000_000),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

const imageInputSchema = z.object({
  id: z.string().optional(),
  url: imageUrl,
  alt: z.string().trim().max(200).default(""),
  color: z.string().trim().min(1).max(40).nullish(),
  position: z.number().int().min(0).max(1000).default(0),
});

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(30)
  .transform((tags) => [...new Set(tags)]);

const fields = {
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(120),
  slug: slugField,
  reference: z.string().trim().min(1, "La référence est obligatoire.").max(30),
  description: z.string().trim().max(4000),
  categoryId: z.string().min(1, "Veuillez choisir une catégorie."),
  gender: z.enum(["women", "men", "unisex"]),
  tags: tagsSchema,
  price: money.min(1, "Le prix de vente est obligatoire."),
  costPrice: money,
  /** `null` = effacer le prix barré (le JSON ne transporte pas `undefined`). */
  compareAtPrice: money.nullable(),
  images: z.array(imageInputSchema).max(30),
  variants: z.array(variantInputSchema).min(1, "Un produit doit avoir au moins une variante.").max(300),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
};

/** Création : `slug` (déduit du nom si absent/vide), `compareAtPrice`, `tags`, `images` et les drapeaux sont optionnels. */
export const createProductSchema = z.object({
  ...fields,
  slug: fields.slug.optional(),
  tags: fields.tags.default([]),
  compareAtPrice: fields.compareAtPrice.optional(),
  images: fields.images.default([]),
  isFeatured: fields.isFeatured.default(false),
  isPublished: fields.isPublished.default(false),
});
export type CreateProductBody = z.infer<typeof createProductSchema>;

/**
 * Modification partielle : une clé absente = inchangée.
 * `compareAtPrice: null` efface le prix barré ; `variants` (si présent) remplace la liste complète des variantes.
 */
export const updateProductSchema = z.object(fields).partial();
export type UpdateProductBody = z.infer<typeof updateProductSchema>;

export const publishSchema = z.object({ isPublished: z.boolean() });

export const idParams = z.object({ id: z.string().min(1).max(100) });
export const slugParams = z.object({ slug: z.string().min(1).max(200) });

/* ---------- Requête publique ---------- */

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalInt = (min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional());
const csv = z.preprocess(
  (v) => (Array.isArray(v) ? v.join(",") : v),
  z
    .string()
    .max(500)
    .optional()
    .transform((s) =>
      s
        ? s
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : undefined,
    ),
);

export const searchQuerySchema = z.object({
  search: z.string().max(100).optional(),
  category: z.string().max(200).optional(),
  collection: z.preprocess(emptyToUndefined, z.enum(["new", "sale"]).optional()),
  sizes: csv,
  colors: csv,
  minPrice: optionalInt(0, 100_000_000),
  maxPrice: optionalInt(0, 100_000_000),
  inStockOnly: z.preprocess(emptyToUndefined, z.enum(["true", "false", "1", "0"]).optional()).transform((v) => v === "true" || v === "1"),
  sort: z.preprocess(emptyToUndefined, z.enum(["newest", "price_asc", "price_desc", "popular"]).optional()),
  page: optionalInt(1, 100_000),
  pageSize: optionalInt(1, 100),
});

export const relatedQuerySchema = z.object({ limit: optionalInt(1, 50) });
