import { prisma } from "./helpers";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter += 1).toString(36)}`;

export async function makeCategory(name = "Catégorie test") {
  const n = unique();
  return prisma.category.create({ data: { name: `${name} ${n}`, slug: `cat-${n}` } });
}

export type VariantSpec = { color?: string; size?: string; stock: number; price?: number; alertThreshold?: number };

/** Produit + variantes (+ une image par couleur) créés directement en base. */
export async function makeProduct(
  options: {
    name?: string;
    price?: number;
    costPrice?: number;
    isPublished?: boolean;
    isArchived?: boolean;
    categoryId?: string;
    variants?: VariantSpec[];
  } = {},
) {
  const n = unique();
  const categoryId = options.categoryId ?? (await makeCategory()).id;
  const price = options.price ?? 10_000;
  const specs = options.variants ?? [{ stock: 10 }];
  const product = await prisma.product.create({
    data: {
      reference: `REF-${n}`,
      name: options.name ?? `Produit ${n}`,
      slug: `produit-${n}`,
      description: "Description de test suffisamment longue.",
      categoryId,
      price,
      costPrice: options.costPrice ?? Math.round(price / 2),
      isPublished: options.isPublished ?? true,
      isArchived: options.isArchived ?? false,
      images: { create: [{ url: `/img/${n}.jpg`, alt: "image", position: 0 }] },
      variants: {
        create: specs.map((s, i) => ({
          sku: `SKU-${n}-${i}`,
          color: s.color ?? "Noir",
          colorCode: "#000000",
          size: s.size ?? ["S", "M", "L", "XL", "XXL", "3XL"][i] ?? `T${i}`,
          price: s.price ?? price,
          stock: s.stock,
          alertThreshold: s.alertThreshold ?? 3,
        })),
      },
    },
    include: { variants: { orderBy: { sku: "asc" } } },
  });
  return product;
}

/** Corps valide de commande à domicile (Alger, zone 1 par défaut). */
export function orderBody(items: Array<{ variantId: string; quantity: number }>, overrides: Record<string, unknown> = {}) {
  return {
    customer: { firstName: "Amina", lastName: "Benali", phone: "0555 12 34 56" },
    shippingAddress: { wilayaCode: "16", commune: "Bab Ezzouar", address: "Cité 5 Juillet, bloc C", deliveryMethod: "home" },
    items,
    ...overrides,
  };
}

export const stockOf = async (variantId: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
