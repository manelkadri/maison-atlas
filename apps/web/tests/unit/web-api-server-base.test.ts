import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api-client";
import { getApiBaseUrl, getApiInternalUrl } from "@/lib/api-config";
import { json, stubFetch } from "./web-api-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("base d'URL côté serveur Next (rendu serveur)", () => {
  // Le rendu serveur n'a pas de `window` : on le retire pour la durée de chaque test (rétabli par afterEach).
  beforeEach(() => {
    vi.stubGlobal("window", undefined);
  });

  it("sans window : URL interne complète par défaut et cache: no-store", async () => {
    vi.stubEnv("API_INTERNAL_URL", "");
    const { calls } = stubFetch(() => json([]));
    await apiFetch("/products/catalog");
    expect(typeof window).toBe("undefined");
    expect(calls[0]?.url).toBe("http://localhost:4000/api/products/catalog");
    expect(calls[0]?.init.cache).toBe("no-store");
  });

  it("utilise API_INTERNAL_URL (barre finale retirée)", async () => {
    vi.stubEnv("API_INTERNAL_URL", "http://api.internal:5000/");
    const { calls } = stubFetch(() => json({}));
    await apiFetch("/settings", { query: { a: 1 } });
    expect(getApiInternalUrl()).toBe("http://api.internal:5000");
    expect(getApiBaseUrl()).toBe("http://api.internal:5000/api");
    expect(calls[0]?.url).toBe("http://api.internal:5000/api/settings?a=1");
  });
});
