import type { Product, ProductVariant } from "@/types/product.types";

/**
 * Produit de test : le stock GLOBAL (somme) est confortable, mais certaines COMBINAISONS sont épuisées
 * ou inexistantes — c'est exactement le cas qui ne doit jamais rendre une variante commandable.
 *
 *   Noir  : S = 0 (épuisée) · M = 5 · L = 2 (stock faible, seuil 3)
 *   Beige : S = 4 · M n'existe pas · L = 0 (épuisée)
 */
const variant = (color: string, colorCode: string, size: string, stock: number, price = 10000): ProductVariant => ({
  id: `var-${color.toLowerCase()}-${size.toLowerCase()}`,
  productId: "prod-test",
  sku: `TST-${color.slice(0, 3).toUpperCase()}-${size}`,
  color,
  colorCode,
  size,
  price,
  stock,
  alertThreshold: 3,
});

export const testProduct: Product = {
  id: "prod-test",
  reference: "TST-001",
  name: "Robe de test",
  slug: "robe-de-test",
  description: "Une robe de test. Elle sert aux tests unitaires.",
  categoryId: "cat_robes",
  gender: "women",
  tags: ["test"],
  price: 10000,
  costPrice: 4000,
  compareAtPrice: 12500,
  images: [
    { id: "im-1", url: "/images/products/test/noir-1.svg", alt: "Noir 1", color: "Noir", position: 1 },
    { id: "im-2", url: "/images/products/test/noir-2.svg", alt: "Noir 2", color: "Noir", position: 2 },
    { id: "im-3", url: "/images/products/test/beige-1.svg", alt: "Beige 1", color: "Beige", position: 3 },
  ],
  variants: [
    variant("Noir", "#1a1a1a", "S", 0),
    variant("Noir", "#1a1a1a", "M", 5),
    variant("Noir", "#1a1a1a", "L", 2),
    variant("Beige", "#d8c3a5", "S", 4),
    variant("Beige", "#d8c3a5", "L", 0),
  ],
  soldCount: 10,
  isFeatured: false,
  isPublished: true,
  isArchived: false,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
};
