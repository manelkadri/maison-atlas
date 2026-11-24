/**
 * Point d'entrée unique des services.
 *
 * `NEXT_PUBLIC_DATA_SOURCE=api` → implémentations HTTP (`services/api/*.api.ts`, contrat : docs/API_CONTRACT.md).
 * Sinon (défaut)              → implémentations mock (en mémoire + localStorage, phase 1).
 *
 * Les composants n'importent que `@/services` : ils ne savent jamais quelle source est active.
 * La sélection se fait à l'import du module ; Next.js remplace la variable à la compilation.
 */
import { apiAnalyticsService } from "./api/analytics.api";
import { apiAuthService } from "./api/auth.api";
import { apiCategoryService } from "./api/categories.api";
import { apiCustomerAccountService } from "./api/customer-account.api";
import { apiCustomerService } from "./api/customers.api";
import { apiInventoryService } from "./api/inventory.api";
import { apiNewsletterService } from "./api/newsletter.api";
import { apiOrderService } from "./api/orders.api";
import { apiProductService } from "./api/products.api";
import { apiPromotionService } from "./api/promotions.api";
import { apiSettingsService } from "./api/settings.api";
import { apiUploadService } from "./api/upload.api";
import { analyticsService as mockAnalyticsService } from "./analytics.service";
import { authService as mockAuthService } from "./auth.service";
import { categoryService as mockCategoryService } from "./categories.service";
import type {
  AnalyticsService,
  AuthService,
  CategoryService,
  CustomerAccountService,
  CustomerService,
  InventoryService,
  NewsletterService,
  OrderService,
  ProductService,
  PromotionService,
  SettingsService,
  UploadService,
} from "./contracts";
import { customerAccountService as mockCustomerAccountService } from "./customer-account.service";
import { customerService as mockCustomerService } from "./customers.service";
import { inventoryService as mockInventoryService } from "./inventory.service";
import { newsletterService as mockNewsletterService } from "./newsletter.service";
import { orderService as mockOrderService } from "./orders.service";
import { productService as mockProductService } from "./products.service";
import { promotionService as mockPromotionService } from "./promotions.service";
import { settingsService as mockSettingsService } from "./settings.service";
import { uploadService as mockUploadService } from "./upload.service";

const useApi = process.env.NEXT_PUBLIC_DATA_SOURCE === "api";

export const productService: ProductService = useApi ? apiProductService : mockProductService;
export const categoryService: CategoryService = useApi ? apiCategoryService : mockCategoryService;
export const orderService: OrderService = useApi ? apiOrderService : mockOrderService;
export const inventoryService: InventoryService = useApi ? apiInventoryService : mockInventoryService;
export const customerService: CustomerService = useApi ? apiCustomerService : mockCustomerService;
export const customerAccountService: CustomerAccountService = useApi ? apiCustomerAccountService : mockCustomerAccountService;
export const promotionService: PromotionService = useApi ? apiPromotionService : mockPromotionService;
export const settingsService: SettingsService = useApi ? apiSettingsService : mockSettingsService;
export const analyticsService: AnalyticsService = useApi ? apiAnalyticsService : mockAnalyticsService;
export const authService: AuthService = useApi ? apiAuthService : mockAuthService;
export const uploadService: UploadService = useApi ? apiUploadService : mockUploadService;
export const newsletterService: NewsletterService = useApi ? apiNewsletterService : mockNewsletterService;

export { NEWSLETTER_STORAGE_KEY, saveNewsletterEmail } from "./newsletter.service";
export { ServiceError, getErrorMessage } from "./errors";
export type * from "./contracts";
