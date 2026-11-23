/**
 * Types métier "catalogue".
 * Tous les montants sont des entiers exprimés en DZD (pas de décimales).
 * Ces types sont volontairement indépendants de Prisma.
 */

export type Gender = "women" | "men" | "unisex";

export type CategoryKind = "category" | "collection";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  /** "collection" = regroupement dynamique (ex. Nouveautés), sans produits rattachés directement. */
  kind: CategoryKind;
  parentId: string | null;
  displayOrder: number;
  isArchived: boolean;
  createdAt: string;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  /** Couleur à laquelle l'image est associée (optionnel). */
  color?: string;
  position: number;
};

export type ProductVariant = {
  id: string;
  productId: string;
  /** SKU unique sur l'ensemble du catalogue. */
  sku: string;
  color: string;
  /** Code hexadécimal, ex. "#1a1a1a". */
  colorCode: string;
  size: string;
  /** Prix de la variante (DZD). Par défaut égal au prix du produit. */
  price: number;
  /** Quantité disponible pour CETTE combinaison taille/couleur. */
  stock: number;
  alertThreshold: number;
};

export type Product = {
  id: string;
  /** Référence commerciale visible (ex. "ATL-W-014"). */
  reference: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  gender: Gender;
  tags: string[];
  /** Prix de vente actuel (prix affiché). */
  price: number;
  /** Prix d'achat unitaire, utilisé uniquement pour estimer les marges. */
  costPrice: number;
  /** Ancien prix barré. Si défini et > price, le produit est en promotion. */
  compareAtPrice?: number;
  images: ProductImage[];
  variants: ProductVariant[];
  /** Nombre d'unités vendues (indicateur de popularité). */
  soldCount: number;
  isFeatured: boolean;
  isPublished: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockStatus = "available" | "low" | "out_of_stock";

/** Entrée de création d'un produit (sans champs générés côté serveur). */
export type CreateProductInput = Omit<
  Product,
  "id" | "createdAt" | "updatedAt" | "soldCount" | "isArchived" | "variants"
> & {
  variants: Array<
    Omit<ProductVariant, "id" | "productId"> & { id?: string }
  >;
};

export type UpdateProductInput = Partial<CreateProductInput>;

export type CreateCategoryInput = Omit<Category, "id" | "createdAt" | "isArchived">;
export type UpdateCategoryInput = Partial<CreateCategoryInput> & { isArchived?: boolean };

export type ProductSort = "newest" | "price_asc" | "price_desc" | "popular";

export type ProductFilters = {
  search?: string;
  /** Slug de catégorie (inclut les sous-catégories). */
  category?: string;
  /** "new" = nouveautés, "sale" = promotions. */
  collection?: "new" | "sale";
  sizes?: string[];
  colors?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: ProductSort;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
