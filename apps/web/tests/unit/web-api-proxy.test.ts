import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

describe("proxy /admin/dashboard", () => {
  it("cible uniquement /admin/dashboard et ses sous-chemins", () => {
    expect(config.matcher).toEqual(["/admin/dashboard", "/admin/dashboard/:path*"]);
  });

  it("mode API sans cookie : redirige vers /admin/login", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "api");
    const response = proxy(request("/admin/dashboard/orders"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/admin/login");
  });

  it("mode API avec le cookie admin_session : laisse passer", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "api");
    const response = proxy(request("/admin/dashboard", "admin_session=abc"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("mode mock : ne fait rien, même sans cookie", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");
    const response = proxy(request("/admin/dashboard/products"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("variable absente (défaut) : mode mock, ne fait rien", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "");
    const response = proxy(request("/admin/dashboard"));
    expect(response.headers.get("location")).toBeNull();
  });
});
