import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch, json } from "./web-api-helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const SERVICE_NAMES = [
  "productService",
  "categoryService",
  "orderService",
  "inventoryService",
  "customerService",
  "promotionService",
  "settingsService",
  "analyticsService",
  "authService",
  "uploadService",
  "newsletterService",
] as const;

describe("sélection mock / api de services/index.ts", () => {
  it("par défaut (variable absente) : implémentations mock", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "");
    vi.resetModules();
    const services = await import("@/services");
    const mock = await import("@/services/products.service");
    const api = await import("@/services/api/products.api");
    expect(services.productService).toBe(mock.productService);
    expect(services.productService).not.toBe(api.apiProductService);
  });

  it("NEXT_PUBLIC_DATA_SOURCE=mock : implémentations mock pour tous les services", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");
    vi.resetModules();
    const services = await import("@/services");
    const { fn } = stubFetch(() => json([]));
    await services.productService.getProducts({ onlyPublic: true });
    await services.categoryService.getCategories();
    await services.settingsService.getSettings();
    expect(fn).not.toHaveBeenCalled(); // le mode mock ne fait aucun appel réseau
    for (const name of SERVICE_NAMES) expect(services[name]).toBeDefined();
  });

  it("NEXT_PUBLIC_DATA_SOURCE=api : implémentations API pour tous les services", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "api");
    vi.resetModules();
    const services = await import("@/services");
    const apiModules = {
      productService: (await import("@/services/api/products.api")).apiProductService,
      categoryService: (await import("@/services/api/categories.api")).apiCategoryService,
      orderService: (await import("@/services/api/orders.api")).apiOrderService,
      inventoryService: (await import("@/services/api/inventory.api")).apiInventoryService,
      customerService: (await import("@/services/api/customers.api")).apiCustomerService,
      promotionService: (await import("@/services/api/promotions.api")).apiPromotionService,
      settingsService: (await import("@/services/api/settings.api")).apiSettingsService,
      analyticsService: (await import("@/services/api/analytics.api")).apiAnalyticsService,
      authService: (await import("@/services/api/auth.api")).apiAuthService,
      uploadService: (await import("@/services/api/upload.api")).apiUploadService,
      newsletterService: (await import("@/services/api/newsletter.api")).apiNewsletterService,
    };
    for (const name of SERVICE_NAMES) expect(services[name]).toBe(apiModules[name]);
  });

  it("mode API : un service appelle réellement fetch", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "api");
    vi.resetModules();
    const { calls } = stubFetch(() => json([]));
    const services = await import("@/services");
    await services.productService.getProducts({ onlyPublic: true });
    expect(calls[0]?.url).toBe("/api/products/catalog");
  });

  it("valeur inconnue : retombe sur le mock", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "n'importe quoi");
    vi.resetModules();
    const services = await import("@/services");
    const mock = await import("@/services/orders.service");
    expect(services.orderService).toBe(mock.orderService);
  });
});

describe("mock : contrats ajustés restent rétro-compatibles", () => {
  it("getOrderByNumber sans téléphone : comportement d'origine ; avec téléphone : doit correspondre", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");
    vi.resetModules();
    const { orderService } = await import("@/services");
    const [first] = await orderService.getOrders();
    expect(first).toBeDefined();
    const number = first!.orderNumber;
    expect((await orderService.getOrderByNumber(number))?.orderNumber).toBe(number);
    expect((await orderService.getOrderByNumber(number, first!.customer.phone))?.orderNumber).toBe(number);
    expect(await orderService.getOrderByNumber(number, "0555000000")).toBeNull();
    expect(await orderService.getOrderByNumber("CMD-0000-000000", first!.customer.phone)).toBeNull();
  });

  it("authService mock : login accepte tout, me() reflète le store de session simulé", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");
    vi.resetModules();
    const { authService } = await import("@/services");
    const { useAdminSessionStore } = await import("@/stores/admin-session.store");
    expect(await authService.me()).toBeNull();
    useAdminSessionStore.setState({ isAuthenticated: true, email: "a@b.dz" });
    expect(await authService.me()).toEqual({ email: "a@b.dz" });
    await authService.logout();
    expect(await authService.me()).toBeNull();
  });

  it("newsletterService mock : stockage local en minuscules, sans doublon", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");
    vi.resetModules();
    const { newsletterService, NEWSLETTER_STORAGE_KEY } = await import("@/services");
    await newsletterService.subscribe("Client@Example.com");
    await newsletterService.subscribe("client@example.com");
    expect(JSON.parse(window.localStorage.getItem(NEWSLETTER_STORAGE_KEY) ?? "[]")).toEqual(["client@example.com"]);
  });
});
