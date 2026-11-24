import { createHash, randomBytes } from "node:crypto";
import { Writable } from "node:stream";
import { utf8ByteLength } from "@fashion/validators";
import { SignJWT } from "jose";
import supertest from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { CUSTOMER_SESSION_COOKIE, MAX_SESSIONS_PER_CUSTOMER, THROTTLE } from "../src/config/customer-auth";
import { createApp } from "../src/create-app";
import { LOGIN_FAILED, REGISTER_UNAVAILABLE } from "../src/modules/customers/account";
import { ALLOWED_METADATA, FORBIDDEN_KEY, sanitizeMetadata } from "../src/utils/audit";
import { createCustomerSession, hashToken } from "../src/utils/customer-session";
import { maskIp } from "../src/utils/ip";
import { throttleKey } from "../src/utils/throttle";
import { ADMIN, CUSTOMER, adminAgent, createCustomerAccount, customerAgent, getApp, http, prisma, resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase(); // vide aussi AuthThrottle : chaque test repart de compteurs à zéro
});

const REG = {
  firstName: "Amina",
  lastName: "Benali",
  phone: "0555 12 34 56",
  email: "amina@example.com",
  wilayaCode: "16",
  commune: "Bab Ezzouar",
  address: "Cité 5 Juillet, bloc C",
  password: "correct-horse-battery",
} as const;

const register = (over: Record<string, unknown> = {}) => http().post("/api/customers/register").send({ ...REG, ...over });
const login = (phone: string, password: string) => http().post("/api/customers/login").send({ phone, password });
const cookies = (res: supertest.Response): string[] => {
  const h = res.headers["set-cookie"];
  return Array.isArray(h) ? h : h ? [h] : [];
};
const sessionCookie = (res: supertest.Response) => cookies(res).find((c) => c.startsWith(`${CUSTOMER_SESSION_COOKIE}=`));
const tokenOf = (res: supertest.Response) => /^customer_session=([^;]*)/.exec(sessionCookie(res) ?? "")?.[1] ?? "";
const withToken = (token: string) => supertest(getApp()).get("/api/customers/me").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${token}`);

describe("inscription", () => {
  it("crée le compte (201), ouvre la session, et ne renvoie ni hachage ni jeton", async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ firstName: "Amina", lastName: "Benali", phone: "0555 12 34 56", email: "amina@example.com", wilayaCode: "16", mustChangePassword: false });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|token|"password"|\$2[aby]\$/i); // « mustChangePassword » est un champ légitime
    expect(res.headers["cache-control"]).toMatch(/no-store/);

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=2592000/); // 30 jours
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Secure/i); // pas de Secure hors production (http local)

    const customer = await prisma.customer.findFirstOrThrow();
    expect(customer).toMatchObject({ isGuest: false, phoneKey: "0555123456", mustChangePassword: false });
    expect(customer.passwordHash).toMatch(/^\$2[ab]\$12\$/); // bcrypt, coût 12
    expect(customer.passwordChangedAt).not.toBeNull();
  });

  it("stocke uniquement l'empreinte SHA-256 du jeton : jamais le jeton lui-même", async () => {
    const token = tokenOf(await register());
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 octets aléatoires en base64url
    const rows = await prisma.customerSession.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]!.expiresAt.getTime() - rows[0]!.createdAt.getTime()).toBe(30 * 24 * 3600 * 1000);
  });

  it("normalise le téléphone : le même numéro écrit autrement est un doublon, et la connexion marche dans tous les formats", async () => {
    await register({ phone: "+213 555 12 34 56" }).expect(201);
    expect((await register({ phone: "0555123456" })).status).toBe(409);
    expect((await register({ phone: "00213 555 12 34 56" })).status).toBe(409);
    for (const phone of ["0555123456", "+213555123456", "00213 555 12 34 56"]) {
      expect((await login(phone, REG.password)).status, phone).toBe(200);
    }
  });

  it("numéro déjà utilisé : réponse GÉNÉRIQUE, identique pour un compte avec mot de passe et pour un compte historique sans mot de passe", async () => {
    await createCustomerAccount(); // compte avec mot de passe
    const withPassword = await register();
    await prisma.customer.update({ where: { phoneKey: CUSTOMER.phoneKey }, data: { passwordHash: null, isGuest: true } }); // « historique »
    const legacy = await register();
    for (const res of [withPassword, legacy]) {
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: { code: "CONFLICT", message: REGISTER_UNAVAILABLE } });
      expect(sessionCookie(res)).toBeUndefined();
    }
    expect(withPassword.body).toEqual(legacy.body);
    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.customerSession.count()).toBe(0);
  });

  it("refuse les données invalides (400) sans jamais renvoyer le mot de passe saisi", async () => {
    const bad: Array<[string, Record<string, unknown>]> = [
      ["mot de passe de 7 caractères", { password: "abcdefg" }],
      ["mot de passe de 73 octets (37 « é »)", { password: "é".repeat(37) }],
      ["caractère NUL", { password: "abcd\u0000efgh" }],
      ["mot de passe = téléphone", { password: "0555123456" }],
      ["téléphone invalide", { phone: "0455123456" }],
      ["prénom manquant", { firstName: "" }],
      ["wilaya inconnue", { wilayaCode: "99" }],
      ["e-mail invalide", { email: "pas-un-email" }],
    ];
    for (const [label, over] of bad) {
      const res = await register(over);
      expect(res.status, label).toBe(400);
      expect(res.body.error.code, label).toBe("VALIDATION");
      const typed = String(over.password ?? "");
      if (typed.length >= 7) expect(JSON.stringify(res.body), label).not.toContain(typed);
    }
    expect(await prisma.customer.count()).toBe(0);
  });

  it("limite 72 OCTETS (pas 72 caractères) : 36 « é » passent, 37 non — et le mot de passe accepté fonctionne à la connexion", async () => {
    const ok = "é".repeat(36); // 72 octets en UTF-8
    expect(utf8ByteLength(ok)).toBe(72);
    expect((await register({ password: ok })).status).toBe(201);
    expect((await login(REG.phone, ok)).status).toBe(200);
    // 36 « é » + 1 : 74 octets. Refusé à l'inscription ET traité comme invalide à la connexion (aucune troncature silencieuse).
    expect((await register({ phone: "0666123456", password: `${ok}é` })).status).toBe(400);
    expect((await login(REG.phone, `${ok}é`)).status).toBe(401);
  });

  it("compte les octets comme Node, y compris emojis et caractères rares", () => {
    const samples = ["", "abc", "é", "日本語", "😀", "a😀é日", "\ud800", "x".repeat(100) + "ü"];
    for (const s of samples) expect(utf8ByteLength(s), JSON.stringify(s)).toBe(Buffer.byteLength(s, "utf8"));
  });

  it("5 inscriptions simultanées du même numéro : une seule réussit", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => register()));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await prisma.customer.count()).toBe(1);
  }, 60_000);

  it("limite les inscriptions par IP (429 + Retry-After) et ne crée rien au-delà", async () => {
    for (let i = 0; i < THROTTLE.registerIp.max; i += 1) {
      await register({ phone: `06${String(10000000 + i)}` }).expect(201);
    }
    const blocked = await register({ phone: "0777000000" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(await prisma.customer.count()).toBe(THROTTLE.registerIp.max);
  }, 90_000);

  it("journalise l'inscription avec une IP masquée et sans aucun secret", async () => {
    const res = await register();
    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorType: "customer", action: "customer.registered", targetType: "customer", ipMasked: "127.0.0.0/24", metadata: null });
    expect(rows[0]!.actorId).toBe(rows[0]!.targetId);
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain(REG.password);
    expect(dump).not.toContain(tokenOf(res));
  });
});

describe("connexion", () => {
  beforeEach(async () => {
    await createCustomerAccount();
  });

  it("ouvre une session (200) : jeton neuf à chaque connexion, tous valides", async () => {
    const a = await login(CUSTOMER.phone, CUSTOMER.password);
    const b = await login(CUSTOMER.phone, CUSTOMER.password);
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ firstName: "Amina", phone: CUSTOMER.phone, mustChangePassword: false });
    expect(JSON.stringify(a.body)).not.toMatch(/hash|token|"password"|\$2[aby]\$/i);
    expect(tokenOf(a)).not.toBe(tokenOf(b));
    expect((await withToken(tokenOf(a))).status).toBe(200);
    expect((await withToken(tokenOf(b))).status).toBe(200);
  });

  it("réponse strictement identique : numéro inconnu, mauvais mot de passe, compte sans mot de passe, mot de passe démesuré", async () => {
    await createCustomerAccount({ phone: "0661 00 00 01", phoneKey: "0661000001", passwordHash: null, isGuest: true });
    const attempts = [
      login("0777 00 00 00", "n-importe-quoi-123"),
      login(CUSTOMER.phone, "mauvais-mot-de-passe"),
      login("0661 00 00 01", "n-importe-quoi-123"),
      login(CUSTOMER.phone, "é".repeat(60)),
    ];
    const results: supertest.Response[] = [];
    for (const attempt of attempts) results.push(await attempt); // séquentiel : un seul compteur de verrouillage à la fois
    for (const res of results) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { code: "UNAUTHENTICATED", message: LOGIN_FAILED } });
      expect(sessionCookie(res)).toBeUndefined();
    }
  }, 60_000);

  it("calcule toujours un hachage bcrypt : un numéro inconnu n'est pas nettement plus rapide qu'un mauvais mot de passe", async () => {
    const time = async (phone: string) => {
      const t0 = performance.now();
      await login(phone, "mauvais-mot-de-passe");
      return performance.now() - t0;
    };
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const known: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      known.push(await time(CUSTOMER.phone));
      unknown.push(await time(`07${String(70000000 + i)}`));
    }
    expect(median(unknown)).toBeGreaterThan(median(known) * 0.4);
  }, 60_000);

  it("verrouille le numéro après 5 échecs en 15 minutes : même avec le BON mot de passe, 429 + Retry-After", async () => {
    for (let i = 0; i < THROTTLE.loginPhone.maxFailures; i += 1) {
      expect((await login(CUSTOMER.phone, "mauvais-mot-de-passe")).status).toBe(401);
    }
    const locked = await login(CUSTOMER.phone, CUSTOMER.password);
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(locked.headers["retry-after"])).toBeLessThanOrEqual(900);
    expect(sessionCookie(locked)).toBeUndefined();
  }, 60_000);

  it("le blocage est identique pour un numéro SANS compte : rien ne révèle quels numéros existent", async () => {
    const lockUp = async (phone: string) => {
      for (let i = 0; i < THROTTLE.loginPhone.maxFailures; i += 1) await login(phone, "mauvais-mot-de-passe");
      return login(phone, "mauvais-mot-de-passe");
    };
    const known = await lockUp(CUSTOMER.phone);
    const unknown = await lockUp("0777 12 34 56");
    expect(unknown.status).toBe(known.status);
    expect(unknown.body.error.code).toBe(known.body.error.code);
    expect(unknown.body.error.message).toBe(known.body.error.message);
  }, 90_000);

  it("le blocage expire (fixe, jamais définitif) : la connexion refonctionne et le compteur est remis à zéro", async () => {
    for (let i = 0; i < THROTTLE.loginPhone.maxFailures; i += 1) await login(CUSTOMER.phone, "mauvais-mot-de-passe");
    expect((await login(CUSTOMER.phone, CUSTOMER.password)).status).toBe(429);
    const past = new Date(Date.now() - 20 * 60_000);
    await prisma.authThrottle.updateMany({ where: { keyHash: throttleKey(THROTTLE.loginPhone.scope, CUSTOMER.phoneKey) }, data: { lockedUntil: past, windowStart: past } });
    expect((await login(CUSTOMER.phone, CUSTOMER.password)).status).toBe(200);
    expect(await prisma.authThrottle.count({ where: { keyHash: throttleKey(THROTTLE.loginPhone.scope, CUSTOMER.phoneKey) } })).toBe(0);
  }, 60_000);

  it("une connexion réussie remet le compteur d'échecs à zéro", async () => {
    for (let i = 0; i < 3; i += 1) await login(CUSTOMER.phone, "mauvais-mot-de-passe");
    expect((await login(CUSTOMER.phone, CUSTOMER.password)).status).toBe(200);
    for (let i = 0; i < 4; i += 1) expect((await login(CUSTOMER.phone, "mauvais-mot-de-passe")).status).toBe(401);
    expect((await login(CUSTOMER.phone, CUSTOMER.password)).status).toBe(200); // 4 échecs seulement : pas de blocage
  }, 60_000);

  it("limite par IP en PREMIER : au-delà, 429 même avec de bons identifiants, sans faire monter les compteurs par numéro", async () => {
    for (let i = 0; i < THROTTLE.loginIp.max; i += 1) await login(`07${String(70000000 + i)}`, "mauvais-mot-de-passe");
    const blocked = await login(CUSTOMER.phone, CUSTOMER.password);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/depuis cette connexion/);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    // La tentative bloquée n'a touché AUCUN compteur du numéro visé : l'IP limitée ne peut pas verrouiller de comptes.
    expect(await prisma.authThrottle.count({ where: { keyHash: throttleKey(THROTTLE.loginPhone.scope, CUSTOMER.phoneKey) } })).toBe(0);
  }, 120_000);

  it("5 échecs simultanés : les compteurs restent exacts (incréments atomiques) et le numéro est bien bloqué", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => login(CUSTOMER.phone, "mauvais-mot-de-passe")));
    expect(results.every((r) => r.status === 401 || r.status === 429)).toBe(true);
    const row = await prisma.authThrottle.findUniqueOrThrow({ where: { scope_keyHash: { scope: THROTTLE.loginPhone.scope, keyHash: throttleKey(THROTTLE.loginPhone.scope, CUSTOMER.phoneKey) } } });
    expect(row.count).toBe(results.filter((r) => r.status === 401).length); // chaque échec compté une fois, aucun perdu
    expect(row.lockedUntil).not.toBeNull();
    expect((await login(CUSTOMER.phone, CUSTOMER.password)).status).toBe(429);
  }, 60_000);

  it("journalise UN blocage par verrouillage (compte existant ou non) sans aucun secret", async () => {
    for (let i = 0; i < THROTTLE.loginPhone.maxFailures + 2; i += 1) await login(CUSTOMER.phone, "mauvais-mot-de-passe");
    for (let i = 0; i < THROTTLE.loginPhone.maxFailures; i += 1) await login("0777 12 34 56", "autre-mauvais-mot-de-passe");
    const rows = await prisma.auditLog.findMany({ where: { action: "customer.login_locked" }, orderBy: { createdAt: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ actorType: "system", targetType: "customer", ipMasked: "127.0.0.0/24", metadata: { accountExists: true, lockMinutes: 15 } });
    expect(rows[1]).toMatchObject({ actorType: "system", targetType: null, targetId: null, metadata: { accountExists: false, lockMinutes: 15 } });
    const dump = JSON.stringify(rows);
    for (const secret of ["mauvais-mot-de-passe", "autre-mauvais-mot-de-passe", CUSTOMER.password]) expect(dump).not.toContain(secret);
  }, 90_000);
});

describe("sessions : vérification serveur et révocation réelle", () => {
  it("GET /me : 200 avec une session valide ; 401 sans cookie, avec un jeton forgé ou mal formé", async () => {
    const { agent, customer } = await customerAgent();
    const ok = await agent.get("/api/customers/me");
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: customer.id, firstName: "Amina" });
    expect(ok.headers["cache-control"]).toMatch(/no-store/);
    expect((await http().get("/api/customers/me")).status).toBe(401);
    expect((await withToken(randomBytes(32).toString("base64url"))).status).toBe(401); // bien formé mais inconnu
    for (const junk of ["x", "a".repeat(43) + "!", "../../etc/passwd", "a".repeat(500)]) expect((await withToken(junk)).status, junk).toBe(401);
  });

  it("une session expirée est refusée (401) et supprimée de la base", async () => {
    const { agent, token } = await customerAgent();
    await prisma.customerSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 2000) } });
    const res = await agent.get("/api/customers/me");
    expect(res.status).toBe(401);
    expect(await prisma.customerSession.count()).toBe(0);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/); // le navigateur oublie le cookie
  });

  it("la suppression de la cliente invalide aussitôt ses sessions", async () => {
    const { agent, customer } = await customerAgent();
    await prisma.customer.delete({ where: { id: customer.id } });
    expect((await agent.get("/api/customers/me")).status).toBe(401);
  });

  it("DÉCONNEXION : 204, cookie effacé, ligne supprimée en base, et l'ancien jeton ne marche plus nulle part", async () => {
    const { token } = await customerAgent();
    const res = await supertest(getApp()).post("/api/customers/logout").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(204);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await prisma.customerSession.count()).toBe(0);
    // Réutilisation du jeton volé APRÈS la déconnexion : refusée (c'est ce que ne permettrait pas un jeton signé sans état).
    expect((await withToken(token)).status).toBe(401);
  });

  it("déconnexion sans session, ou avec un jeton inconnu : 204 sans effet sur les autres sessions", async () => {
    const { token } = await customerAgent();
    expect((await http().post("/api/customers/logout")).status).toBe(204);
    expect((await supertest(getApp()).post("/api/customers/logout").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${randomBytes(32).toString("base64url")}`)).status).toBe(204);
    expect((await withToken(token)).status).toBe(200);
  });

  it("se déconnecter d'un appareil laisse les autres sessions de la même cliente ouvertes", async () => {
    const a = await customerAgent();
    const { token: tokenB } = await createCustomerSession(prisma, a.customer.id, "autre appareil");
    await supertest(getApp()).post("/api/customers/logout").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${a.token}`).expect(204);
    expect((await withToken(a.token)).status).toBe(401);
    expect((await withToken(tokenB)).status).toBe(200);
  });

  it(`conserve au plus ${MAX_SESSIONS_PER_CUSTOMER} sessions par cliente : les plus anciennes disparaissent`, async () => {
    const customer = await createCustomerAccount();
    const tokens: string[] = [];
    for (let i = 0; i < MAX_SESSIONS_PER_CUSTOMER + 2; i += 1) tokens.push((await createCustomerSession(prisma, customer.id, `appareil ${i}`, new Date(Date.now() + i * 1000))).token);
    expect(await prisma.customerSession.count()).toBe(MAX_SESSIONS_PER_CUSTOMER);
    expect((await withToken(tokens[0]!)).status).toBe(401);
    expect((await withToken(tokens[1]!)).status).toBe(401);
    expect((await withToken(tokens.at(-1)!)).status).toBe(200);
  });

  it("n'écrit la date de dernière utilisation qu'une fois par heure", async () => {
    const { agent, token } = await customerAgent();
    const where = { tokenHash: hashToken(token) };
    const recent = new Date(Date.now() - 10 * 60_000);
    await prisma.customerSession.updateMany({ where, data: { lastUsedAt: recent } });
    await agent.get("/api/customers/me").expect(200);
    expect((await prisma.customerSession.findFirstOrThrow({ where })).lastUsedAt.getTime()).toBe(recent.getTime()); // < 1 h : inchangée
    const old = new Date(Date.now() - 2 * 3600_000);
    await prisma.customerSession.updateMany({ where, data: { lastUsedAt: old } });
    await agent.get("/api/customers/me").expect(200);
    expect((await prisma.customerSession.findFirstOrThrow({ where })).lastUsedAt.getTime()).toBeGreaterThan(old.getTime() + 3600_000);
  });

  it("nettoyage opportuniste : une connexion supprime les sessions et compteurs périmés, jamais autre chose", async () => {
    const customer = await createCustomerAccount();
    const stale = await createCustomerSession(prisma, customer.id, "vieux", new Date(Date.now() - 40 * 24 * 3600_000));
    await prisma.authThrottle.create({ data: { scope: "login-ip", keyHash: "ancien", count: 3, updatedAt: new Date(Date.now() - 3 * 24 * 3600_000) } });
    const orders = await prisma.order.count();
    expect((await login(CUSTOMER.phone, CUSTOMER.password)).status).toBe(200);
    expect(await prisma.customerSession.count({ where: { tokenHash: hashToken(stale.token) } })).toBe(0);
    expect(await prisma.authThrottle.count({ where: { keyHash: "ancien" } })).toBe(0);
    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.order.count()).toBe(orders);
  }, 60_000);
});

describe("séparation stricte cliente / administrateur", () => {
  it("la session admin n'ouvre rien côté cliente, et inversement", async () => {
    const admin = await adminAgent();
    expect((await admin.get("/api/customers/me")).status).toBe(401);

    const { agent: customer, token } = await customerAgent();
    for (const path of ["/api/admin/orders", "/api/admin/customers", "/api/admin/products", "/api/admin/settings", "/api/auth/me"]) {
      expect((await customer.get(path)).status, path).toBe(401);
    }

    // Un jeton cliente déguisé en cookie admin n'est pas un JWT admin valide…
    const asAdmin = await supertest(getApp()).get("/api/admin/orders").set("Cookie", `admin_session=${token}`);
    expect(asAdmin.status).toBe(401);
    // …et un vrai JWT admin déguisé en cookie client n'est pas un jeton de session (mauvais format, aucune empreinte).
    const adminJwt = await new SignJWT({ email: ADMIN.email }).setProtectedHeader({ alg: "HS256" }).setSubject("x").setExpirationTime("1h").sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    expect((await withToken(adminJwt)).status).toBe(401);
  });

  it("créer ou fermer une session cliente ne touche jamais le cookie admin", async () => {
    const res = await register();
    expect(cookies(res).filter((c) => c.startsWith("admin_session="))).toEqual([]);
    const out = await supertest(getApp()).post("/api/customers/logout").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${tokenOf(res)}`);
    expect(cookies(out).filter((c) => c.startsWith("admin_session="))).toEqual([]);
  });
});

describe("CSRF : contrôle de l'origine sur les écritures", () => {
  const evil = "https://site-malveillant.example";

  it("refuse inscription, connexion et déconnexion venant d'une autre origine (403), sans rien créer ni révoquer", async () => {
    expect((await http().post("/api/customers/register").set("Origin", evil).send(REG)).status).toBe(403);
    expect(await prisma.customer.count()).toBe(0);

    await createCustomerAccount();
    const blockedLogin = await http().post("/api/customers/login").set("Origin", evil).send({ phone: CUSTOMER.phone, password: CUSTOMER.password });
    expect(blockedLogin.status).toBe(403);
    expect(sessionCookie(blockedLogin)).toBeUndefined();

    const { token } = await customerAgent();
    const blockedLogout = await supertest(getApp()).post("/api/customers/logout").set("Origin", evil).set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${token}`);
    expect(blockedLogout.status).toBe(403);
    expect((await withToken(token)).status).toBe(200); // la session n'a pas été révoquée par un site tiers
  });

  it("accepte l'origine du site autorisé", async () => {
    await createCustomerAccount();
    const ok = await http().post("/api/customers/login").set("Origin", "http://localhost:3000").send({ phone: CUSTOMER.phone, password: CUSTOMER.password });
    expect(ok.status).toBe(200);
  });
});

describe("la visiteuse non connectée garde l'accès au site", () => {
  it("catalogue, catégories et paramètres restent publics (200) ; seule la zone compte demande une connexion", async () => {
    for (const path of ["/api/products", "/api/categories", "/api/settings", "/api/health"]) {
      expect((await http().get(path)).status, path).toBe(200);
    }
    expect((await http().get("/api/customers/me")).status).toBe(401);
  });
});

describe("aucun secret dans les journaux ni dans l'audit", () => {
  it("n'accepte en métadonnées que la liste fermée de clés, supprime les clés suspectes et borne les valeurs", () => {
    const clean = sanitizeMetadata("customer.login_locked", {
      accountExists: true,
      lockMinutes: 15,
      password: "secret",
      passwordHash: "$2b$12$x",
      token: "abc",
      cookie: "customer_session=abc",
      authorization: "Bearer x",
      note: "pas dans la liste",
      nested: { a: 1 },
    });
    expect(clean).toEqual({ accountExists: true, lockMinutes: 15 });
    expect(sanitizeMetadata("customer.registered", { anything: "x", password: "y" })).toBeUndefined();
    // Même si l'on ajoutait par erreur une clé suspecte à la liste, le filtre de noms la supprimerait.
    for (const keys of Object.values(ALLOWED_METADATA)) for (const key of keys) expect(FORBIDDEN_KEY.test(key), key).toBe(false);
    expect(FORBIDDEN_KEY.test("passwordHash") && FORBIDDEN_KEY.test("sessionToken") && FORBIDDEN_KEY.test("Authorization")).toBe(true);
  });

  it("masque les adresses IP (IPv4 en /24, IPv6 en /48) et refuse ce qu'il ne comprend pas", () => {
    expect(maskIp("203.0.113.57")).toBe("203.0.113.0/24");
    expect(maskIp("::ffff:203.0.113.57")).toBe("203.0.113.0/24");
    expect(maskIp("2001:0db8:abcd:0012::1")).toBe("2001:db8:abcd::/48");
    expect(maskIp("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(maskIp("::1")).toBe("0:0:0::/48");
    expect(maskIp("fe80::1%eth0")).toBe("fe80:0:0::/48");
    for (const bad of [undefined, null, "", "unknown", "999.1.1.1", "1.2.3", "2001:db8::1::2", "not-an-ip"]) expect(maskIp(bad), String(bad)).toBeNull();
  });

  it("les journaux HTTP ne contiennent ni mot de passe, ni jeton, ni cookie (inscription, connexion, session, déconnexion)", async () => {
    let captured = "";
    const stream = new Writable({
      write(chunk, _enc, cb) {
        captured += chunk.toString();
        cb();
      },
    });
    const app = createApp({ logStream: stream });
    const password = "Mot-de-passe-TRES-secret-42";
    const reg = await supertest(app).post("/api/customers/register").send({ ...REG, password });
    const token = tokenOf(reg);
    expect(token).toHaveLength(43);
    await supertest(app).get("/api/customers/me").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${token}`).expect(200);
    const again = await supertest(app).post("/api/customers/login").send({ phone: REG.phone, password });
    const token2 = tokenOf(again);
    await supertest(app).post("/api/customers/login").send({ phone: REG.phone, password: "un-mauvais-mot-de-passe" }).expect(401);
    await supertest(app).post("/api/customers/logout").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${token2}`).expect(204);

    expect(captured.length).toBeGreaterThan(200); // les requêtes sont bien journalisées…
    expect(captured).toContain("/api/customers/register");
    for (const secret of [password, "un-mauvais-mot-de-passe", token, token2, `${CUSTOMER_SESSION_COOKIE}=`]) {
      expect(captured, `fuite dans les journaux : ${secret.slice(0, 12)}…`).not.toContain(secret);
    }
  }, 60_000);

  it("parcours complet : aucune trace de mot de passe ni de jeton dans toute la table d'audit", async () => {
    const reg = await register();
    for (let i = 0; i < THROTTLE.loginPhone.maxFailures; i += 1) await login(REG.phone, "un-mauvais-mot-de-passe");
    const dump = JSON.stringify(await prisma.auditLog.findMany());
    for (const secret of [REG.password, "un-mauvais-mot-de-passe", tokenOf(reg), hashToken(tokenOf(reg))]) expect(dump).not.toContain(secret);
    for (const row of await prisma.auditLog.findMany()) {
      for (const key of Object.keys((row.metadata as Record<string, unknown> | null) ?? {})) expect(FORBIDDEN_KEY.test(key), key).toBe(false);
    }
  }, 60_000);
});
