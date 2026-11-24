import { beforeEach, describe, expect, it } from "vitest";
import { THROTTLE } from "../src/config/customer-auth";
import { REGISTER_UNAVAILABLE } from "../src/modules/customers/account";
import { ipLimitKey, subnetLimitKey } from "../src/utils/ip";
import { consumeAttempt, throttleKey } from "../src/utils/throttle";
import { createCustomerAccount, http, prisma, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const REG = {
  firstName: "Amina",
  lastName: "Benali",
  phone: "0555 12 34 56",
  email: "amina@example.com",
  wilayaCode: "16",
  commune: "Bab Ezzouar",
  address: "Cité 5 Juillet",
  password: "correct-horse-battery",
} as const;

/** IP de test (Express : `trust proxy = 1` → dernière adresse de X-Forwarded-For). */
const TEST_IP = "::ffff:127.0.0.1";
const reg = (over: Record<string, unknown> = {}, ip?: string) => {
  const req = http().post("/api/customers/register");
  if (ip) req.set("X-Forwarded-For", ip);
  return req.send({ ...REG, ...over });
};
/** Numéros valides distincts : 06 + 8 chiffres. */
const phone = (i: number) => `06${String(10_000_000 + i)}`;

const seed = (scope: string, key: string, count: number, windowStart = new Date()) =>
  prisma.authThrottle.upsert({
    where: { scope_keyHash: { scope, keyHash: throttleKey(scope, key) } },
    create: { scope, keyHash: throttleKey(scope, key), count, windowStart },
    update: { count, windowStart },
  });
const counter = async (scope: string, key: string) =>
  (await prisma.authThrottle.findUnique({ where: { scope_keyHash: { scope, keyHash: throttleKey(scope, key) } } }))?.count ?? 0;

const SCOPES = [
  [THROTTLE.registerIp, () => ipLimitKey(TEST_IP)],
  [THROTTLE.registerIpDay, () => ipLimitKey(TEST_IP)],
  [THROTTLE.registerSubnetDay, () => subnetLimitKey(TEST_IP)],
  [THROTTLE.registerGlobalHour, () => "all"],
  [THROTTLE.registerGlobalDay, () => "all"],
] as const;

describe("seuils des limites d'inscription (documentés)", () => {
  it("par IP : 10/heure et 20/jour ; par sous-réseau : 60/jour ; global : 100/heure et 500/jour", () => {
    expect([THROTTLE.registerIp.max, THROTTLE.registerIp.windowMs]).toEqual([10, 3_600_000]);
    expect([THROTTLE.registerIpDay.max, THROTTLE.registerIpDay.windowMs]).toEqual([20, 86_400_000]);
    expect([THROTTLE.registerSubnetDay.max, THROTTLE.registerSubnetDay.windowMs]).toEqual([60, 86_400_000]);
    expect([THROTTLE.registerGlobalHour.max, THROTTLE.registerGlobalHour.windowMs]).toEqual([100, 3_600_000]);
    expect([THROTTLE.registerGlobalDay.max, THROTTLE.registerGlobalDay.windowMs]).toEqual([500, 86_400_000]);
  });
});

describe("limite quotidienne par IP", () => {
  it("la 20e tentative de la journée passe, la 21e est refusée (429) : la limite horaire n'y est pour rien", async () => {
    await seed(THROTTLE.registerIpDay.scope, ipLimitKey(TEST_IP), THROTTLE.registerIpDay.max - 1);
    expect((await reg({ phone: phone(1) })).status).toBe(201);
    const blocked = await reg({ phone: phone(2) });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.body.error.message).toMatch(/depuis cette connexion/);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(3600); // fenêtre d'une journée
    expect(blocked.headers["set-cookie"]).toBeUndefined();
    expect(await prisma.customer.count()).toBe(1);
  });

  it("une autre adresse n'est pas affectée (compteurs séparés), et le contournement par en-tête X-Forwarded-For forgé échoue", async () => {
    await seed(THROTTLE.registerIpDay.scope, ipLimitKey("198.51.100.7"), THROTTLE.registerIpDay.max);
    expect((await reg({ phone: phone(1) }, "198.51.100.7")).status).toBe(429);
    expect((await reg({ phone: phone(2) }, "203.0.113.200")).status).toBe(201); // autre IP, autre sous-réseau : libre
    // Un robot qui ajoute des adresses fantaisistes À GAUCHE de l'en-tête n'échappe pas à son compteur : seule l'adresse
    // vue par le dernier proxy de confiance compte.
    expect((await reg({ phone: phone(3) }, "1.2.3.4, 198.51.100.7")).status).toBe(429);
  });
});

describe("limites par sous-réseau et globales", () => {
  it("sous-réseau : 60 tentatives par jour pour une même plage /24 — message neutre", async () => {
    await seed(THROTTLE.registerSubnetDay.scope, subnetLimitKey(TEST_IP), THROTTLE.registerSubnetDay.max);
    const res = await reg();
    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/momentanément indisponibles/);
    expect(await prisma.customer.count()).toBe(0);
  });

  it("globale par heure (100) puis par jour (500) : toutes adresses confondues", async () => {
    await seed(THROTTLE.registerGlobalHour.scope, "all", THROTTLE.registerGlobalHour.max);
    expect((await reg()).status).toBe(429);
    await seed(THROTTLE.registerGlobalHour.scope, "all", 0);
    expect((await reg({ phone: phone(1) })).status).toBe(201);
    await seed(THROTTLE.registerGlobalDay.scope, "all", THROTTLE.registerGlobalDay.max);
    expect((await reg({ phone: phone(2) })).status).toBe(429);
  });

  it("du plus étroit au plus large : une IP déjà limitée n'entame JAMAIS le budget global", async () => {
    await seed(THROTTLE.registerIp.scope, ipLimitKey(TEST_IP), THROTTLE.registerIp.max); // IP/heure atteint
    for (let i = 0; i < 3; i += 1) expect((await reg({ phone: phone(i) })).status).toBe(429);
    expect(await counter(THROTTLE.registerGlobalHour.scope, "all")).toBe(0);
    expect(await counter(THROTTLE.registerGlobalDay.scope, "all")).toBe(0);
    expect(await counter(THROTTLE.registerSubnetDay.scope, subnetLimitKey(TEST_IP))).toBe(0);
  });

  it("les 429 se réarment : une fenêtre expirée repart de zéro", async () => {
    await seed(THROTTLE.registerIp.scope, ipLimitKey(TEST_IP), THROTTLE.registerIp.max + 5, new Date(Date.now() - 2 * 3_600_000));
    expect((await reg()).status).toBe(201);
    expect(await counter(THROTTLE.registerIp.scope, ipLimitKey(TEST_IP))).toBe(1);
  });
});

describe("comptage IDENTIQUE pour un numéro neuf et pour un numéro déjà inscrit", () => {
  it("chaque tentative consomme exactement 1 de CHAQUE budget, quelle que soit la situation du numéro", async () => {
    await createCustomerAccount(); // 0555 12 34 56 existe déjà
    const outcomes = [
      await reg({ phone: phone(1) }), // neuf
      await reg(), // déjà inscrit
      await reg({ phone: "+213 555 12 34 56" }), // déjà inscrit, autre écriture
      await reg({ phone: phone(2) }), // neuf
    ];
    expect(outcomes.map((r) => r.status)).toEqual([201, 409, 409, 201]);
    for (const [cfg, key] of SCOPES) expect(await counter(cfg.scope, key()), cfg.scope).toBe(4);
  });

  it("à budget épuisé, le refus est strictement identique pour un numéro neuf et pour un numéro déjà inscrit", async () => {
    await createCustomerAccount();
    await seed(THROTTLE.registerIp.scope, ipLimitKey(TEST_IP), THROTTLE.registerIp.max);
    const fresh = await reg({ phone: phone(1) });
    const existing = await reg();
    for (const res of [fresh, existing]) {
      expect(res.status).toBe(429);
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
    expect(fresh.body).toEqual(existing.body);
    expect(await prisma.customer.count()).toBe(1);
  });

  it("une requête INVALIDE (400) ne consomme aucun budget et ne dit rien sur le numéro", async () => {
    for (let i = 0; i < 15; i += 1) expect((await reg({ firstName: "" })).status).toBe(400);
    for (const [cfg, key] of SCOPES) expect(await counter(cfg.scope, key()), cfg.scope).toBe(0);
    expect((await reg()).status).toBe(201);
  });
});

describe("atomicité des compteurs", () => {
  it("40 tentatives simultanées sur un budget de 25 : exactement 25 autorisées, compteurs 1…40 sans trou ni doublon", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => consumeAttempt("test-atomic", "k", { max: 25, windowMs: 60_000 })));
    expect(results.filter((r) => r.allowed)).toHaveLength(25);
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(await counter("test-atomic", "k")).toBe(40);
  });

  it("15 inscriptions simultanées depuis la même IP (budget horaire 10) : exactement 10 comptes, 5 refus 429, aucune erreur 500", async () => {
    const results = await Promise.all(Array.from({ length: 15 }, (_, i) => reg({ phone: phone(i) })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(THROTTLE.registerIp.max);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
    expect(results.filter((r) => r.status >= 500)).toHaveLength(0);
    expect(await prisma.customer.count()).toBe(THROTTLE.registerIp.max);
    expect(await counter(THROTTLE.registerIp.scope, ipLimitKey(TEST_IP))).toBe(15); // toutes les tentatives sont comptées, aucune perdue
  }, 90_000);
});

describe("audit : tentatives sur un numéro déjà inscrit et plafonds atteints", () => {
  it("customer.register_duplicate : cible = le compte concerné, IP masquée, aucun numéro ni mot de passe ; rien pour un numéro neuf", async () => {
    const existing = await createCustomerAccount();
    expect((await reg({ phone: phone(1) })).status).toBe(201);
    expect(await prisma.auditLog.count({ where: { action: "customer.register_duplicate" } })).toBe(0);

    expect((await reg()).status).toBe(409);
    const rows = await prisma.auditLog.findMany({ where: { action: "customer.register_duplicate" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorType: "system", actorId: null, targetType: "customer", targetId: existing.id, ipMasked: "127.0.0.0/24", metadata: { legacy: false } });
    const dump = JSON.stringify(rows);
    for (const secret of [REG.password, "0555123456", "555 12 34 56", "amina@example.com"]) expect(dump).not.toContain(secret);
  });

  it("signale un compte historique (sans mot de passe) et garde la même réponse 409", async () => {
    await createCustomerAccount({ passwordHash: null, isGuest: true });
    const res = await reg();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(REGISTER_UNAVAILABLE);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "customer.register_duplicate" } })).metadata).toEqual({ legacy: true });
  });

  it("5 inscriptions simultanées du même numéro : un compte, 4 doublons, 4 événements d'audit", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => reg()));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await prisma.auditLog.count({ where: { action: "customer.register_duplicate" } })).toBe(4);
  }, 60_000);

  it("customer.register_limit_reached : UNE seule fois par fenêtre, même si les refus continuent", async () => {
    await seed(THROTTLE.registerGlobalHour.scope, "all", THROTTLE.registerGlobalHour.max);
    for (let i = 0; i < 4; i += 1) expect((await reg({ phone: phone(i) })).status).toBe(429);
    const rows = await prisma.auditLog.findMany({ where: { action: "customer.register_limit_reached" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorType: "system", metadata: { limit: THROTTLE.registerGlobalHour.scope } });
  });

  it("aucun plafond d'IP seule ne remplit le journal : pas d'événement pour un budget par IP atteint", async () => {
    await seed(THROTTLE.registerIp.scope, ipLimitKey(TEST_IP), THROTTLE.registerIp.max);
    for (let i = 0; i < 3; i += 1) await reg({ phone: phone(i) });
    expect(await prisma.auditLog.count({ where: { action: "customer.register_limit_reached" } })).toBe(0);
  });
});

describe("clés de limitation par adresse", () => {
  it("IPv4 telle quelle, IPv4 incorporée dans IPv6 ramenée à l'IPv4, IPv6 regroupée en /64, sous-réseau /24 et /48", () => {
    expect(ipLimitKey("203.0.113.57")).toBe("203.0.113.57");
    expect(ipLimitKey("::ffff:203.0.113.57")).toBe("203.0.113.57");
    expect(ipLimitKey("2001:db8:abcd:12:1111:2222:3333:4444")).toBe(ipLimitKey("2001:db8:abcd:12:ffff:eeee:dddd:cccc")); // même /64 → même clé
    expect(ipLimitKey("2001:db8:abcd:12::1")).not.toBe(ipLimitKey("2001:db8:abcd:13::1")); // /64 voisin → autre clé
    expect(subnetLimitKey("203.0.113.57")).toBe("203.0.113.0/24");
    expect(subnetLimitKey("2001:db8:abcd:12::1")).toBe(subnetLimitKey("2001:db8:abcd:ffff::1")); // même /48
    for (const bad of [undefined, null, "", "pas-une-ip"]) {
      expect(ipLimitKey(bad as string)).toBe("unknown");
      expect(subnetLimitKey(bad as string)).toBe("unknown");
    }
  });
});
