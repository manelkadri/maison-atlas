import { execFileSync } from "node:child_process";
import supertest from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { MIN_ADMIN_PASSWORD_LENGTH, validateAdminPassword, verifyPassword } from "../src/utils/password";
import { ADMIN, createAdmin, getApp, http, prisma, resetDatabase } from "./helpers";

beforeAll(async () => {
  await resetDatabase();
  await createAdmin();
});

const setCookie = (res: supertest.Response): string[] => {
  const header = res.headers["set-cookie"];
  return Array.isArray(header) ? header : header ? [header] : [];
};

describe("POST /api/auth/login", () => {
  it("connecte le propriétaire : 200 { email } et cookie de session httpOnly, SameSite=Lax, 12 h", async () => {
    const res = await http().post("/api/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: ADMIN.email });
    const cookie = setCookie(res).find((c) => c.startsWith("admin_session="));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=43200/);
    expect(cookie).toMatch(/Path=\//);
    // Pas de Secure hors production (le cookie doit fonctionner en http local).
    expect(cookie).not.toMatch(/Secure/i);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
    expect(JSON.stringify(res.body)).not.toMatch(/hash|password/i);
  });

  it("accepte l'e-mail sans tenir compte de la casse ni des espaces", async () => {
    const res = await http().post("/api/auth/login").send({ email: `  ${ADMIN.email.toUpperCase()} `, password: ADMIN.password });
    expect(res.status).toBe(200);
  });

  it("répond de façon strictement identique pour un e-mail inconnu et pour un mauvais mot de passe", async () => {
    const unknown = await http().post("/api/auth/login").send({ email: "personne@test.local", password: "mot-de-passe-quelconque" });
    const wrong = await http().post("/api/auth/login").send({ email: ADMIN.email, password: "mauvais-mot-de-passe-123" });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.error.code).toBe("UNAUTHENTICATED");
    expect(setCookie(unknown)).toEqual([]);
    expect(setCookie(wrong)).toEqual([]);
  });

  it("rejette un corps invalide (400 VALIDATION)", async () => {
    const res = await http().post("/api/auth/login").send({ email: ADMIN.email });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("ne bloque pas en test : le limiteur est désactivé (RATE_LIMIT=off)", async () => {
    for (let i = 0; i < 14; i++) {
      const res = await http().post("/api/auth/login").send({ email: ADMIN.email, password: `mauvais-${i}-mot-de-passe` });
      expect(res.status).toBe(401);
    }
  });
});

describe("session : me / logout / garde admin", () => {
  it("GET /api/auth/me : 401 sans cookie", async () => {
    const res = await http().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("GET /api/auth/me : 401 avec un cookie forgé", async () => {
    const res = await http().get("/api/auth/me").set("Cookie", "admin_session=faux.jeton.forge");
    expect(res.status).toBe(401);
  });

  it("login → me → routes admin accessibles → logout → plus de session", async () => {
    const agent = supertest.agent(getApp());
    await agent.post("/api/auth/login").send({ email: ADMIN.email, password: ADMIN.password }).expect(200);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ email: ADMIN.email });
    await agent.get("/api/admin/products").expect(200);

    const out = await agent.post("/api/auth/logout");
    expect(out.status).toBe(204);
    const cleared = setCookie(out).find((c) => c.startsWith("admin_session="));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);

    await agent.get("/api/auth/me").expect(401);
    await agent.get("/api/admin/products").expect(401);
  });

  it("la déconnexion sans session ne plante pas (204)", async () => {
    await http().post("/api/auth/logout").expect(204);
  });

  it("garde admin : 401 sans session sur toutes les routes de mon périmètre", async () => {
    const routes: Array<[string, string]> = [
      ["get", "/api/admin/products"],
      ["post", "/api/admin/products"],
      ["patch", "/api/admin/settings"],
      ["get", "/api/admin/categories"],
      ["post", "/api/admin/categories"],
      ["post", "/api/admin/uploads"],
    ];
    for (const [method, path] of routes) {
      const res = await (http() as unknown as Record<string, (p: string) => supertest.Test>)[method]!(path);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("une session dont le compte a été supprimé n'ouvre plus rien", async () => {
    const other = await prisma.adminUser.create({ data: { email: "temp@test.local", passwordHash: (await prisma.adminUser.findFirstOrThrow()).passwordHash } });
    const agent = supertest.agent(getApp());
    await agent.post("/api/auth/login").send({ email: other.email, password: ADMIN.password }).expect(200);
    await agent.get("/api/auth/me").expect(200);
    await prisma.adminUser.delete({ where: { id: other.id } });
    await agent.get("/api/auth/me").expect(401);
    await agent.get("/api/admin/products").expect(401);
  });
});

describe("mots de passe", () => {
  it("refuse les mots de passe trop courts", () => {
    expect(validateAdminPassword("a".repeat(MIN_ADMIN_PASSWORD_LENGTH - 1))).toMatch(/au moins 12/);
    expect(validateAdminPassword("a".repeat(MIN_ADMIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("verifyPassword refuse toujours un compte inconnu (hash absent)", async () => {
    expect(await verifyPassword("n'importe-quoi", undefined)).toBe(false);
    expect(await verifyPassword("n'importe-quoi", null)).toBe(false);
  });
});

describe("db:seed (processus séparé)", () => {
  const runSeed = (env: Record<string, string | undefined>) => {
    try {
      const out = execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
        cwd: process.cwd(),
        env: { ...process.env, ...env },
        stdio: "pipe",
        encoding: "utf8",
      });
      return { code: 0, out };
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
    }
  };

  const SECRET = "mot-de-passe-propriétaire-très-long-42";

  it("crée le compte et les paramètres sans jamais afficher le mot de passe, puis reste idempotent", async () => {
    await resetDatabase();
    const first = runSeed({ ADMIN_EMAIL: "Boss@Test.Local", ADMIN_PASSWORD: SECRET });
    expect(first.code).toBe(0);
    expect(first.out).not.toContain(SECRET);
    const second = runSeed({ ADMIN_EMAIL: "boss@test.local", ADMIN_PASSWORD: SECRET });
    expect(second.code).toBe(0);
    expect(second.out).not.toContain(SECRET);

    expect(await prisma.adminUser.count()).toBe(1);
    expect(await prisma.storeSettings.count()).toBe(1);
    const user = await prisma.adminUser.findFirstOrThrow();
    expect(user.email).toBe("boss@test.local");
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    await http().post("/api/auth/login").send({ email: "boss@test.local", password: SECRET }).expect(200);
  }, 60_000);

  it("refuse un mot de passe de moins de 12 caractères", async () => {
    await resetDatabase();
    const res = runSeed({ ADMIN_EMAIL: "boss@test.local", ADMIN_PASSWORD: "court" });
    expect(res.code).not.toBe(0);
    expect(res.out).toMatch(/au moins 12 caractères/);
    expect(await prisma.adminUser.count()).toBe(0);
  }, 60_000);

  it("refuse l'absence de mot de passe en production", async () => {
    await resetDatabase();
    const res = runSeed({ NODE_ENV: "production", ADMIN_PASSWORD: undefined, JWT_SECRET: "x".repeat(40) });
    expect(res.code).not.toBe(0);
    expect(res.out).toMatch(/ADMIN_PASSWORD est obligatoire en production/);
    expect(await prisma.adminUser.count()).toBe(0);
  }, 60_000);
});
