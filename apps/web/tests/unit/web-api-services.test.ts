import { afterEach, describe, expect, it, vi } from "vitest";
import { apiAnalyticsService } from "@/services/api/analytics.api";
import { apiAuthService } from "@/services/api/auth.api";
import { apiCategoryService } from "@/services/api/categories.api";
import { apiCustomerService } from "@/services/api/customers.api";
import { apiInventoryService } from "@/services/api/inventory.api";
import { apiNewsletterService } from "@/services/api/newsletter.api";
import { apiOrderService } from "@/services/api/orders.api";
import { apiProductService } from "@/services/api/products.api";
import { apiPromotionService } from "@/services/api/promotions.api";
import { apiSettingsService } from "@/services/api/settings.api";
import { apiUploadService } from "@/services/api/upload.api";
import { ServiceError } from "@/services/errors";
import type { CreateOrderInput } from "@/types/order.types";
import type { CreateProductInput, Product } from "@/types/product.types";
import { apiError, bodyOf, json, noContent, stubFetch } from "./web-api-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("produits", () => {
  it("getProducts : onlyPublic ⇒ /products/catalog ; sinon /admin/products", async () => {
    const { calls } = stubFetch(() => json([]));
    await apiProductService.getProducts({ onlyPublic: true });
    await apiProductService.getProducts();
    expect(calls.map((c) => c.url)).toEqual(["/api/products/catalog", "/api/admin/products"]);
  });

  it("searchProducts : GET /products, tableaux en listes séparées par des virgules, page et pageSize", async () => {
    const page = { items: [], total: 0, page: 2, pageSize: 8, totalPages: 0 };
    const { calls } = stubFetch(() => json(page));
    const result = await apiProductService.searchProducts(
      { search: "  robe  ", category: "femme", collection: "sale", sizes: ["S", "M"], colors: ["Noir", "Bleu nuit"], minPrice: 1000, maxPrice: 9000, inStockOnly: true, sort: "price_asc" },
      2,
      8,
    );
    expect(result).toEqual(page);
    const url = new URL(calls[0]!.url, "http://x");
    expect(url.pathname).toBe("/api/products");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: "robe",
      category: "femme",
      collection: "sale",
      sizes: "S,M",
      colors: "Noir,Bleu nuit",
      minPrice: "1000",
      maxPrice: "9000",
      inStockOnly: "true",
      sort: "price_asc",
      page: "2",
      pageSize: "8",
    });
  });

  it("searchProducts : filtres vides ⇒ seulement page et pageSize (valeurs par défaut)", async () => {
    const { calls } = stubFetch(() => json({}));
    await apiProductService.searchProducts({ sizes: [], inStockOnly: false });
    expect(calls[0]?.url).toBe("/api/products?page=1&pageSize=12");
  });

  it("getProductBySlug : public ou admin, slug encodé, 404 ⇒ null", async () => {
    const { calls } = stubFetch((call) => (call.url.includes("inconnu") ? apiError(404, "NOT_FOUND", "x") : json({ id: "p1", slug: "robe é" })));
    await apiProductService.getProductBySlug("robe é", { onlyPublic: true });
    await apiProductService.getProductBySlug("robe é");
    await expect(apiProductService.getProductBySlug("inconnu", { onlyPublic: true })).resolves.toBeNull();
    expect(calls[0]?.url).toBe("/api/products/by-slug/robe%20%C3%A9");
    expect(calls[1]?.url).toBe("/api/admin/products/by-slug/robe%20%C3%A9");
  });

  it("getProductById (admin) et getRelatedProducts (public, limit)", async () => {
    const { calls } = stubFetch(() => json([]));
    await apiProductService.getProductById("p1");
    await apiProductService.getRelatedProducts("p1", 3);
    await apiProductService.getRelatedProducts("p1");
    expect(calls.map((c) => c.url)).toEqual(["/api/admin/products/p1", "/api/products/p1/related?limit=3", "/api/products/p1/related?limit=4"]);
  });

  it("getRelatedProducts : produit inconnu ⇒ liste vide", async () => {
    stubFetch(() => apiError(404, "NOT_FOUND", "x"));
    await expect(apiProductService.getRelatedProducts("nope")).resolves.toEqual([]);
  });

  it("createProduct : POST /admin/products avec le corps du formulaire", async () => {
    const input = { name: "Robe", slug: "robe", variants: [] } as unknown as CreateProductInput;
    const { calls } = stubFetch(() => json({ id: "p1" }, 201));
    await apiProductService.createProduct(input);
    expect(calls[0]?.url).toBe("/api/admin/products");
    expect(calls[0]?.init.method).toBe("POST");
    expect(bodyOf(calls[0]!)).toEqual(input);
  });

  it("updateProduct : compareAtPrice explicitement undefined ⇒ envoyé comme null (effacé)", async () => {
    const { calls } = stubFetch(() => json({ id: "p1" }));
    await apiProductService.updateProduct("p1", { name: "Robe", price: 4000, compareAtPrice: undefined });
    expect(calls[0]?.url).toBe("/api/admin/products/p1");
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(calls[0]?.init.body).toContain('"compareAtPrice":null');
    expect(bodyOf(calls[0]!)).toEqual({ name: "Robe", price: 4000, compareAtPrice: null });
  });

  it("updateProduct : compareAtPrice absent ⇒ champ non envoyé ; défini ⇒ conservé", async () => {
    const { calls } = stubFetch(() => json({ id: "p1" }));
    await apiProductService.updateProduct("p1", { name: "Robe" });
    await apiProductService.updateProduct("p1", { compareAtPrice: 6000 });
    expect(bodyOf(calls[0]!)).toEqual({ name: "Robe" });
    expect(bodyOf(calls[1]!)).toEqual({ compareAtPrice: 6000 });
  });

  it("publier, archiver, restaurer, supprimer", async () => {
    const { calls } = stubFetch((call) => (call.url.endsWith("/publish") ? json({ id: "p1" }) : noContent()));
    await apiProductService.setPublished("p1", true);
    await apiProductService.archiveProduct("p1");
    await apiProductService.restoreProduct("p1");
    await apiProductService.deleteProduct("p1");
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "POST /api/admin/products/p1/publish",
      "POST /api/admin/products/p1/archive",
      "POST /api/admin/products/p1/restore",
      "DELETE /api/admin/products/p1",
    ]);
    expect(bodyOf(calls[0]!)).toEqual({ isPublished: true });
  });

  it("deleteProduct : CONFLICT du serveur remonté tel quel", async () => {
    stubFetch(() => apiError(409, "CONFLICT", "Ce produit figure dans des commandes."));
    await expect(apiProductService.deleteProduct("p1")).rejects.toMatchObject({ code: "CONFLICT", message: "Ce produit figure dans des commandes." });
  });

  it("le type Product renvoyé est transmis tel quel", async () => {
    const product = { id: "p1", name: "Robe" } as unknown as Product;
    stubFetch(() => json(product));
    await expect(apiProductService.getProductById("p1")).resolves.toEqual(product);
  });
});

describe("catégories", () => {
  it("getCategories : public par défaut, admin avec includeArchived", async () => {
    const { calls } = stubFetch(() => json([]));
    await apiCategoryService.getCategories();
    await apiCategoryService.getCategories({ includeArchived: false });
    await apiCategoryService.getCategories({ includeArchived: true });
    expect(calls.map((c) => c.url)).toEqual(["/api/categories", "/api/categories", "/api/admin/categories?includeArchived=true"]);
  });

  it("getCategoryBySlug : 404 ⇒ null", async () => {
    stubFetch(() => apiError(404, "NOT_FOUND", "x"));
    await expect(apiCategoryService.getCategoryBySlug("nope")).resolves.toBeNull();
  });

  it("créer, modifier, archiver, restaurer", async () => {
    const { calls } = stubFetch((call) => (call.url.endsWith("archive") || call.url.endsWith("restore") ? noContent() : json({ id: "c1" })));
    await apiCategoryService.createCategory({ name: "Robes", slug: "robes", description: "", imageUrl: "", kind: "category", parentId: null, displayOrder: 1 });
    await apiCategoryService.updateCategory("c1", { name: "Robes d'été" });
    await apiCategoryService.archiveCategory("c1");
    await apiCategoryService.restoreCategory("c1");
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "POST /api/admin/categories",
      "PATCH /api/admin/categories/c1",
      "POST /api/admin/categories/c1/archive",
      "POST /api/admin/categories/c1/restore",
    ]);
  });
});

describe("commandes", () => {
  it("getOrderByNumber AVEC téléphone ⇒ route publique de suivi (numéro + téléphone)", async () => {
    const { calls } = stubFetch(() => json({ id: "o1" }));
    await apiOrderService.getOrderByNumber("CMD-2026-000001", "0555 12 34 56");
    const url = new URL(calls[0]!.url, "http://x");
    expect(url.pathname).toBe("/api/orders/track");
    expect(url.searchParams.get("number")).toBe("CMD-2026-000001");
    expect(url.searchParams.get("phone")).toBe("0555 12 34 56");
  });

  it("getOrderByNumber SANS téléphone ⇒ route admin by-number", async () => {
    const { calls } = stubFetch(() => json({ id: "o1" }));
    await apiOrderService.getOrderByNumber("CMD-2026-000001");
    expect(calls[0]?.url).toBe("/api/admin/orders/by-number/CMD-2026-000001");
  });

  it("getOrderByNumber : 404 ⇒ null (suivi public : même réponse quel que soit le motif)", async () => {
    stubFetch(() => apiError(404, "NOT_FOUND", "Commande introuvable."));
    await expect(apiOrderService.getOrderByNumber("CMD-X", "0555123456")).resolves.toBeNull();
  });

  it("getOrders : filtres admin, « all » omis", async () => {
    const { calls } = stubFetch(() => json([]));
    await apiOrderService.getOrders({ status: "all", deliveryMethod: "home", search: " Ali ", dateFrom: "2026-01-01", minTotal: 500, phone: "0555123456" });
    const url = new URL(calls[0]!.url, "http://x");
    expect(url.pathname).toBe("/api/admin/orders");
    expect(Object.fromEntries(url.searchParams)).toEqual({ deliveryMethod: "home", search: "Ali", dateFrom: "2026-01-01", minTotal: "500", phone: "0555123456" });
    await apiOrderService.getOrders();
    expect(calls[1]?.url).toBe("/api/admin/orders");
  });

  it("getOrderById : admin, 404 ⇒ null", async () => {
    const { calls } = stubFetch(() => apiError(404, "NOT_FOUND", "x"));
    await expect(apiOrderService.getOrderById("o1")).resolves.toBeNull();
    expect(calls[0]?.url).toBe("/api/admin/orders/o1");
  });

  it("createOrder : POST /orders, OUT_OF_STOCK remonté", async () => {
    const input = { items: [{ variantId: "v1", quantity: 1 }] } as unknown as CreateOrderInput;
    const { calls } = stubFetch(() => apiError(409, "OUT_OF_STOCK", "Il ne reste que 1 pièce."));
    await expect(apiOrderService.createOrder(input)).rejects.toMatchObject({ code: "OUT_OF_STOCK", message: "Il ne reste que 1 pièce." });
    expect(calls[0]?.url).toBe("/api/orders");
    expect(calls[0]?.init.method).toBe("POST");
    expect(bodyOf(calls[0]!)).toEqual(input);
  });

  it("updateOrderStatus : PATCH /admin/orders/:id/status avec la note (rognée) ; INVALID_TRANSITION remonté", async () => {
    const { calls } = stubFetch(() => json({ id: "o1" }));
    await apiOrderService.updateOrderStatus("o1", "confirmed", "  Appelé  ");
    await apiOrderService.updateOrderStatus("o1", "shipped");
    expect(calls[0]?.url).toBe("/api/admin/orders/o1/status");
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(bodyOf(calls[0]!)).toEqual({ status: "confirmed", note: "Appelé" });
    expect(bodyOf(calls[1]!)).toEqual({ status: "shipped" });
    stubFetch(() => apiError(409, "INVALID_TRANSITION", "Transition impossible."));
    await expect(apiOrderService.updateOrderStatus("o1", "delivered")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("stock, clients, promotions, paramètres, statistiques", () => {
  it("inventaire : filtres (status « all » omis) et mouvements", async () => {
    const { calls } = stubFetch(() => json([]));
    await apiInventoryService.getInventory({ search: "robe", status: "low", productId: "p1", color: "Noir", size: "M" });
    await apiInventoryService.getInventory({ status: "all" });
    await apiInventoryService.getMovements({ variantId: "v1" });
    expect(Object.fromEntries(new URL(calls[0]!.url, "http://x").searchParams)).toEqual({ search: "robe", status: "low", productId: "p1", color: "Noir", size: "M" });
    expect(calls[1]?.url).toBe("/api/admin/inventory");
    expect(calls[2]?.url).toBe("/api/admin/inventory/movements?variantId=v1");
  });

  it("recordMovement : POST /admin/inventory/movements", async () => {
    const { calls } = stubFetch(() => json({ id: "m1" }, 201));
    await apiInventoryService.recordMovement({ variantId: "v1", type: "in", quantity: 5, reason: "Réassort" });
    expect(calls[0]?.url).toBe("/api/admin/inventory/movements");
    expect(bodyOf(calls[0]!)).toEqual({ variantId: "v1", type: "in", quantity: 5, reason: "Réassort" });
  });

  it("clients : liste et fiche (admin) ; findByPhone ⇒ TOUJOURS null, sans aucune requête", async () => {
    const { calls, fn } = stubFetch(() => json([]));
    await apiCustomerService.getCustomers();
    await apiCustomerService.getCustomerById("c1");
    expect(calls.map((c) => c.url)).toEqual(["/api/admin/customers", "/api/admin/customers/c1"]);
    fn.mockClear();
    await expect(apiCustomerService.findByPhone("0555123456")).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("promotions : CRUD admin et validation publique", async () => {
    const { calls } = stubFetch((call) => (call.init.method === "DELETE" ? noContent() : json({ valid: true })));
    await apiPromotionService.getPromotions();
    await apiPromotionService.updatePromotion("pr1", { isActive: false });
    await apiPromotionService.deletePromotion("pr1");
    await apiPromotionService.validateCode(" ete10 ", 8000);
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "GET /api/admin/promotions",
      "PATCH /api/admin/promotions/pr1",
      "DELETE /api/admin/promotions/pr1",
      "POST /api/promotions/validate",
    ]);
    expect(bodyOf(calls[3]!)).toEqual({ code: "ete10", subtotal: 8000 });
  });

  it("paramètres : lecture publique, modification admin, réinitialisation interdite", async () => {
    const { calls, fn } = stubFetch(() => json({ storeName: "Maison Atlas" }));
    await apiSettingsService.getSettings();
    await apiSettingsService.updateSettings({ storeName: "Atlas" });
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual(["GET /api/settings", "PATCH /api/admin/settings"]);
    expect(bodyOf(calls[1]!)).toEqual({ storeName: "Atlas" });
    fn.mockClear();
    const error = await apiSettingsService.resetDemoData().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).code).toBe("FORBIDDEN");
    expect(fn).not.toHaveBeenCalled();
  });

  it("statistiques : tableau de bord et rapport par période", async () => {
    const { calls } = stubFetch(() => json({}));
    await apiAnalyticsService.getDashboard();
    await apiAnalyticsService.getReport("30d");
    expect(calls.map((c) => c.url)).toEqual(["/api/admin/analytics/dashboard", "/api/admin/analytics/report?period=30d"]);
  });

  it("newsletter : POST /newsletter, 204 ; RATE_LIMITED remonté", async () => {
    const { calls } = stubFetch(() => noContent());
    await expect(apiNewsletterService.subscribe(" a@b.dz ")).resolves.toBeUndefined();
    expect(calls[0]?.url).toBe("/api/newsletter");
    expect(bodyOf(calls[0]!)).toEqual({ email: "a@b.dz" });
    stubFetch(() => apiError(429, "RATE_LIMITED", "Trop de requêtes."));
    await expect(apiNewsletterService.subscribe("a@b.dz")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("authentification", () => {
  it("login : POST /auth/login avec e-mail et mot de passe ; échec ⇒ message unique de l'API", async () => {
    const { calls } = stubFetch(() => json({ email: "owner@example.com" }));
    await expect(apiAuthService.login("owner@example.com", "secret")).resolves.toEqual({ email: "owner@example.com" });
    expect(calls[0]?.url).toBe("/api/auth/login");
    expect(bodyOf(calls[0]!)).toEqual({ email: "owner@example.com", password: "secret" });
    stubFetch(() => apiError(401, "UNAUTHENTICATED", "Identifiants incorrects."));
    await expect(apiAuthService.login("a@b.dz", "x")).rejects.toMatchObject({ code: "UNAUTHENTICATED", message: "Identifiants incorrects." });
  });

  it("logout : POST /auth/logout (204)", async () => {
    const { calls } = stubFetch(() => noContent());
    await apiAuthService.logout();
    expect(`${calls[0]?.init.method} ${calls[0]?.url}`).toBe("POST /api/auth/logout");
  });

  it("me : session ⇒ { email } ; 401 ⇒ null ; autre erreur ⇒ propagée", async () => {
    stubFetch(() => json({ email: "owner@example.com" }));
    await expect(apiAuthService.me()).resolves.toEqual({ email: "owner@example.com" });
    stubFetch(() => apiError(401, "UNAUTHENTICATED", "x"));
    await expect(apiAuthService.me()).resolves.toBeNull();
    stubFetch(() => apiError(500, "INTERNAL", "x"));
    await expect(apiAuthService.me()).rejects.toMatchObject({ code: "INTERNAL" });
  });
});

describe("téléversement", () => {
  it("uploadImage : POST multipart /admin/uploads, champ « file », sans Content-Type, renvoie l'URL", async () => {
    const { calls } = stubFetch(() => json({ url: "/uploads/abc.webp", publicId: "abc" }, 201));
    const file = new File(["contenu"], "photo.png", { type: "image/png" });
    await expect(apiUploadService.uploadImage(file)).resolves.toEqual({ url: "/uploads/abc.webp" });
    expect(calls[0]?.url).toBe("/api/admin/uploads");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.headers["Content-Type"]).toBeUndefined();
    const form = calls[0]?.init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get("file") as File).name).toBe("photo.png");
  });

  it("uploadImage : fichier invalide refusé AVANT tout envoi (type, vide)", async () => {
    const { fn } = stubFetch(() => json({ url: "x" }));
    await expect(apiUploadService.uploadImage(new File(["x"], "a.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(apiUploadService.uploadImage(new File([], "a.png", { type: "image/png" }))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("uploadImage : NOT_CONFIGURED (Cloudinary absent) remonté", async () => {
    stubFetch(() => apiError(501, "NOT_CONFIGURED", "Hébergement d'images non configuré."));
    await expect(apiUploadService.uploadImage(new File(["x"], "a.png", { type: "image/png" }))).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
