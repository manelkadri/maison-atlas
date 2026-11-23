import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiFetchOrNull, buildQueryString, resetUnauthenticatedGuard, setUnauthenticatedHandler } from "@/lib/api-client";
import { ServiceError, type ServiceErrorCode } from "@/services/errors";
import { useAdminSessionStore } from "@/stores/admin-session.store";
import { apiError, bodyOf, json, noContent, stubFetch } from "./web-api-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setUnauthenticatedHandler();
});

describe("apiFetch — requête", () => {
  it("navigateur : chemin relatif /api, GET, Accept JSON, cookie de même origine", async () => {
    const { calls } = stubFetch(() => json([{ id: "p1" }]));
    const result = await apiFetch<Array<{ id: string }>>("/products/catalog");
    expect(result).toEqual([{ id: "p1" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/products/catalog");
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.credentials).toBe("same-origin");
    expect(calls[0]?.headers.Accept).toBe("application/json");
    expect(calls[0]?.headers["Content-Type"]).toBeUndefined();
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it("corps JSON : Content-Type posé et corps sérialisé", async () => {
    const { calls } = stubFetch(() => json({ ok: true }, 201));
    await apiFetch("/orders", { method: "POST", body: { items: [{ variantId: "v1", quantity: 2 }] } });
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.headers["Content-Type"]).toBe("application/json");
    expect(bodyOf(calls[0]!)).toEqual({ items: [{ variantId: "v1", quantity: 2 }] });
  });

  it("FormData : envoyé tel quel, sans Content-Type (le navigateur pose la frontière multipart)", async () => {
    const { calls } = stubFetch(() => json({ url: "/uploads/a.webp" }, 201));
    const form = new FormData();
    form.append("file", new File(["x"], "a.png", { type: "image/png" }));
    await apiFetch("/admin/uploads", { method: "POST", body: form });
    expect(calls[0]?.init.body).toBe(form);
    expect(calls[0]?.headers["Content-Type"]).toBeUndefined();
  });

  it("204 : renvoie undefined", async () => {
    stubFetch(() => noContent());
    await expect(apiFetch<void>("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("transmet le signal d'annulation", async () => {
    const { calls } = stubFetch(() => json({}));
    const controller = new AbortController();
    await apiFetch("/settings", { signal: controller.signal });
    expect(calls[0]?.init.signal).toBe(controller.signal);
  });

  it("sérialise la query : valeurs vides omises, tableaux en liste séparée par des virgules", () => {
    expect(
      buildQueryString({ search: "robe", sizes: ["S", "M"], colors: [], minPrice: 0, inStockOnly: true, x: undefined, y: null, z: "" }),
    ).toBe("?search=robe&sizes=S%2CM&minPrice=0&inStockOnly=true");
    expect(buildQueryString({})).toBe("");
    expect(buildQueryString(undefined)).toBe("");
  });

  it("ajoute la query à l'URL", async () => {
    const { calls } = stubFetch(() => json([]));
    await apiFetch("/admin/orders", { query: { status: "pending", minTotal: 1000 } });
    expect(calls[0]?.url).toBe("/api/admin/orders?status=pending&minTotal=1000");
  });
});

describe("apiFetch — erreurs", () => {
  const cases: Array<[number, ServiceErrorCode]> = [
    [400, "VALIDATION"],
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [409, "OUT_OF_STOCK"],
    [409, "INVALID_TRANSITION"],
    [413, "VALIDATION"],
    [429, "RATE_LIMITED"],
    [500, "INTERNAL"],
    [501, "NOT_CONFIGURED"],
  ];

  it.each(cases)("HTTP %i avec le code %s : ServiceError au MÊME code et au même message", async (status, code) => {
    stubFetch(() => apiError(status, code, `Message ${code}`));
    const error = await apiFetch("/products/catalog").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).code).toBe(code);
    expect((error as ServiceError).message).toBe(`Message ${code}`);
  });

  it("code inconnu du serveur : repli sur le statut HTTP", async () => {
    stubFetch(() => apiError(409, "AUTRE_CHOSE", "Conflit"));
    await expect(apiFetch("/x")).rejects.toMatchObject({ code: "CONFLICT", message: "Conflit" });
  });

  it("corps non JSON (ex. 502 de la passerelle) : INTERNAL avec message clair en français", async () => {
    stubFetch(() => new Response("Bad Gateway", { status: 502 }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ code: "INTERNAL", message: expect.stringContaining("injoignable") });
  });

  it("corps non JSON avec un autre statut : message générique, code déduit du statut", async () => {
    stubFetch(() => new Response("oops", { status: 404 }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("échec réseau : ServiceError INTERNAL « Le serveur est injoignable… »", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const error = await apiFetch("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).code).toBe("INTERNAL");
    expect((error as ServiceError).message).toMatch(/^Le serveur est injoignable/);
  });

  it("annulation : l'AbortError n'est pas convertie", async () => {
    stubFetch(() => {
      throw new DOMException("annulé", "AbortError");
    });
    await expect(apiFetch("/x")).rejects.toMatchObject({ name: "AbortError" });
  });

  it("apiFetchOrNull : 404 ⇒ null, autres erreurs propagées", async () => {
    stubFetch(() => apiError(404, "NOT_FOUND", "Introuvable"));
    await expect(apiFetchOrNull("/products/by-slug/x")).resolves.toBeNull();
    stubFetch(() => apiError(500, "INTERNAL", "Erreur"));
    await expect(apiFetchOrNull("/products/by-slug/x")).rejects.toMatchObject({ code: "INTERNAL" });
  });
});

describe("apiFetch — session admin expirée (401)", () => {
  beforeEach(() => {
    resetUnauthenticatedGuard();
  });

  it("route admin : appelle le gestionnaire UNE seule fois même avec plusieurs 401 simultanés", async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    stubFetch(() => apiError(401, "UNAUTHENTICATED", "Session expirée"));
    const results = await Promise.allSettled([apiFetch("/admin/orders"), apiFetch("/admin/products"), apiFetch("/admin/settings", { method: "PATCH", body: {} })]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("route admin : le gestionnaire par défaut vide la session locale", async () => {
    useAdminSessionStore.setState({ isAuthenticated: true, email: "a@b.dz" });
    // Déjà sur la page de connexion : pas de navigation (jsdom n'implémente pas la navigation).
    window.history.pushState({}, "", "/admin/login");
    stubFetch(() => apiError(401, "UNAUTHENTICATED", "Session expirée"));
    await expect(apiFetch("/admin/orders")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(useAdminSessionStore.getState().isAuthenticated).toBe(false);
    expect(useAdminSessionStore.getState().email).toBeNull();
  });

  it("routes publiques et /auth : un 401 ne déclenche aucune redirection", async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    stubFetch(() => apiError(401, "UNAUTHENTICATED", "Identifiants incorrects"));
    await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(apiFetch("/auth/me")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("les autres erreurs d'une route admin ne déclenchent pas la redirection", async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    stubFetch(() => apiError(403, "FORBIDDEN", "Interdit"));
    await expect(apiFetch("/admin/orders")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(handler).not.toHaveBeenCalled();
  });
});
