import type {
  AnalyticsPeriod,
  AnalyticsReport,
  ActivityEvent,
  DashboardKpis,
  StatusBreakdownItem,
  TimeSeriesPoint,
  TopProduct,
} from "@/types/analytics.types";
import type { Customer, CustomerSummary } from "@/types/customer.types";
import type {
  CreateStockMovementInput,
  InventoryFilters,
  InventoryItem,
  StockMovement,
} from "@/types/inventory.types";
import type { CreateOrderInput, Order, OrderFilters, OrderStatus } from "@/types/order.types";
import type {
  Category,
  CreateCategoryInput,
  CreateProductInput,
  PaginatedResult,
  Product,
  ProductFilters,
  UpdateCategoryInput,
  UpdateProductInput,
} from "@/types/product.types";
import type {
  CreatePromotionInput,
  Promotion,
  PromotionValidation,
  UpdatePromotionInput,
} from "@/types/promotion.types";
import type { StoreSettings } from "@/types/settings.types";

/**
 * CONTRATS DE SERVICES
 * ─────────────────────
 * L'interface utilisateur ne dépend que de ces interfaces. En phase 1 elles sont implémentées
 * par des services mock (services/*.service.ts). En phase 2, une implémentation `*.api.ts`
 * appellera le backend Express : aucun composant n'aura à changer.
 */

export interface ProductService {
  /** Catalogue complet (admin) ; `onlyPublic` ne renvoie que les produits publiés et non archivés. */
  getProducts(options?: { onlyPublic?: boolean }): Promise<Product[]>;
  /** Recherche filtrée + paginée de la boutique (produits publics uniquement). */
  searchProducts(filters: ProductFilters, page?: number, pageSize?: number): Promise<PaginatedResult<Product>>;
  getProductBySlug(slug: string, options?: { onlyPublic?: boolean }): Promise<Product | null>;
  getProductById(id: string): Promise<Product | null>;
  getRelatedProducts(productId: string, limit?: number): Promise<Product[]>;
  createProduct(data: CreateProductInput): Promise<Product>;
  updateProduct(id: string, data: UpdateProductInput): Promise<Product>;
  setPublished(id: string, isPublished: boolean): Promise<Product>;
  archiveProduct(id: string): Promise<void>;
  restoreProduct(id: string): Promise<void>;
  /** Suppression définitive : refusée si le produit apparaît dans des commandes. */
  deleteProduct(id: string): Promise<void>;
}

export interface CategoryService {
  getCategories(options?: { includeArchived?: boolean }): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | null>;
  createCategory(data: CreateCategoryInput): Promise<Category>;
  updateCategory(id: string, data: UpdateCategoryInput): Promise<Category>;
  archiveCategory(id: string): Promise<void>;
  restoreCategory(id: string): Promise<void>;
}

export interface OrderService {
  getOrders(filters?: OrderFilters): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | null>;
  /**
   * Sans `phone` : recherche administrateur par numéro (session requise en mode API).
   * Avec `phone` : suivi public — le numéro ET le téléphone doivent correspondre, sinon `null`
   * (même réponse dans les deux cas : rien n'est révélé).
   */
  getOrderByNumber(orderNumber: string, phone?: string): Promise<Order | null>;
  /** Crée la commande, réserve le stock par variante et fige les prix. */
  createOrder(input: CreateOrderInput): Promise<Order>;
  updateOrderStatus(id: string, status: OrderStatus, note?: string): Promise<Order>;
}

export interface InventoryService {
  getInventory(filters?: InventoryFilters): Promise<InventoryItem[]>;
  getMovements(filters?: { variantId?: string; productId?: string }): Promise<StockMovement[]>;
  recordMovement(input: CreateStockMovementInput): Promise<StockMovement>;
}

export interface CustomerService {
  getCustomers(): Promise<CustomerSummary[]>;
  getCustomerById(id: string): Promise<{ customer: CustomerSummary; orders: Order[] } | null>;
  /** Mock uniquement. En mode API : renvoie toujours `null` (aucune recherche de client par téléphone en public). */
  findByPhone(phone: string): Promise<Customer | null>;
}

export interface PromotionService {
  getPromotions(): Promise<Promotion[]>;
  createPromotion(data: CreatePromotionInput): Promise<Promotion>;
  updatePromotion(id: string, data: UpdatePromotionInput): Promise<Promotion>;
  deletePromotion(id: string): Promise<void>;
  /** Vérifie un code pour un sous-total donné (n'incrémente pas l'usage). */
  validateCode(code: string, subtotal: number): Promise<PromotionValidation>;
}

export interface SettingsService {
  getSettings(): Promise<StoreSettings>;
  updateSettings(data: Partial<StoreSettings>): Promise<StoreSettings>;
  /** Mock uniquement : revient aux données de démonstration d'origine (lève `FORBIDDEN` en mode API). */
  resetDemoData(): Promise<void>;
}

export type DashboardData = {
  kpis: DashboardKpis;
  revenueSeries: TimeSeriesPoint[];
  statusBreakdown: StatusBreakdownItem[];
  topProducts: TopProduct[];
  recentOrders: Order[];
  outOfStock: InventoryItem[];
  activity: ActivityEvent[];
};

export interface AnalyticsService {
  getDashboard(): Promise<DashboardData>;
  getReport(period: AnalyticsPeriod): Promise<AnalyticsReport>;
}

export interface UploadService {
  /**
   * Téléverse une image et renvoie l'URL à enregistrer.
   * Mock : image redimensionnée en data-URL ; API : `POST /admin/uploads` (multipart).
   */
  uploadImage(file: File): Promise<{ url: string }>;
}

export interface AuthService {
  /** Ouvre la session propriétaire. Échec : `ServiceError` (message unique, sans détail). */
  login(email: string, password: string): Promise<{ email: string }>;
  logout(): Promise<void>;
  /** Session courante, ou `null` si aucune session valide. */
  me(): Promise<{ email: string } | null>;
}

export interface NewsletterService {
  /** Inscription à la newsletter (idempotente). */
  subscribe(email: string): Promise<void>;
}
