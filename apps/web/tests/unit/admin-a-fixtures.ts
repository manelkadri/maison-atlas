import type { Category, Product, ProductVariant } from "@/types/product.types";

export function makeVariant(overrides: Partial<ProductVariant> & Pick<ProductVariant, "color" | "size">): ProductVariant {
  return {
    id: `var_${overrides.color}_${overrides.size}`,
    productId: "prod_1",
    sku: `SKU-${overrides.color}-${overrides.size}`,
    colorCode: "#1a1a1a",
    price: 5000,
    stock: 10,
    alertThreshold: 3,
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod_1",
    reference: "ATL-T-001",
    name: "T-shirt en lin",
    slug: "t-shirt-en-lin",
    description: "Un t-shirt léger en lin pour l'été.",
    categoryId: "cat_1",
    gender: "unisex",
    tags: ["été", "lin"],
    price: 4500,
    costPrice: 2000,
    images: [{ id: "img_1", url: "/images/products/t-shirt/noir-1.svg", alt: "T-shirt noir", position: 0 }],
    variants: [makeVariant({ color: "Noir", size: "M" }), makeVariant({ color: "Noir", size: "L", stock: 0 })],
    soldCount: 3,
    isFeatured: false,
    isPublished: true,
    isArchived: false,
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-10T10:00:00.000Z",
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> & Pick<Category, "id" | "name">): Category {
  return {
    slug: overrides.name.toLowerCase(),
    description: "",
    imageUrl: "",
    kind: "category",
    parentId: null,
    displayOrder: 1,
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
