import { Writable } from "node:stream";
import bcrypt from "bcryptjs";
import pino from "pino";
import supertest from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { customerPasswordSchema } from "@fashion/validators";
import { AUDIT_RETENTION_DAYS, CUSTOMER_SESSION_COOKIE, THROTTLE } from "../src/config/customer-auth";
import { LOG_OPTIONS, createApp } from "../src/create-app";
import { scrubSecrets } from "../src/utils/log-scrub";
import { createCustomerSession, hashToken } from "../src/utils/customer-session";
import { TEMPORARY_PASSWORD_ALPHABET, TEMPORARY_PASSWORD_LENGTH, generateTemporaryPassword } from "../src/utils/password";
import { throttleKey } from "../src/utils/throttle";
import { makeProduct, orderBody } from "./api2-factories";
import { ADMIN, CUSTOMER, adminAgent, createAdmin, createCustomerAccount, customerAgent, getApp, http, prisma, resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

const B = { phone: "0661 00 00 01", phoneKey: "0661000001", password: "another-horse-staple", firstName: "Yacine", lastName: "Merzouk" } as const;

const cookies = (res: supertest.Response): string[] => {
  const h = res.headers["set-cookie"];
  return Array.isArray(h) ? h : h ? [h] : [];
};
const sessionCookie = (res: supertest.Response) => cookies(res).find((c) => c.startsWith(`${CUSTOMER_SESSION_COOKIE}=`));
const tokenOf = (res: supertest.Response) => /^customer_session=([^;]*)/.exec(sessionCookie(res) ?? "")?.[1] ?? "";
const as = (token: string) => ({ Cookie: `${CUSTOMER_SESSION_COOKIE}=${token}` });
const get = (path: string, token: string) => supertest(getApp()).get(path).set(as(token));
const post = (path: string, token: string, body: unknown) => supertest(getApp()).post(path).set(as(token)).send(body as object);
const patch = (path: string, token: string, body: unknown) => supertest(getApp()).patch(path).set(as(token)).send(body as object);

/** Crée la cliente B (compte avec mot de passe) et une session pour elle. */
async function customerB() {
  return customerAgent({
    firstName: B.firstName,
    lastName: B.lastName,
    phone: B.phone,
    phoneKey: B.phoneKey,
    email: "yacine@example.com",
    wilayaCode: "31",
    commune: "Oran",
    passwordHash: await bcrypt.hash(B.password, 4), // son PROPRE mot de passe
  });
}

/** Passe une commande pour le numéro donné (le flux public actuel rattache la commande à la cliente de ce numéro). */
async function placeOrder(phone: string, firstName: string, variantId: string) {
  const res = await http()
    .post("/api/orders")
    .send(orderBody([{ variantId, quantity: 1 }], { customer: { firstName, lastName: "Test", phone } }));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string; orderNumber: string };
}

/* ═════════════════════════════════ PROFIL ═════════════════════════════════ */

describe("profil de la cliente connectée", () => {
  it("modifie les champs autorisés et rien d'autre : le téléphone, le mot de passe et les indicateurs internes restent intacts", async () => {
    const { token, customer } = await customerAgent();
    const res = await patch("/api/customers/me", token, { firstName: "Aïcha", lastName: "Haddad", email: "aicha@example.com", wilayaCode: "31", commune: "Oran", address: "12 rue des Roses" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: customer.id, firstName: "Aïcha", lastName: "Haddad", email: "aicha@example.com", wilayaCode: "31", commune: "Oran", address: "12 rue des Roses", phone: CUSTOMER.phone });
    expect(res.headers["cache-control"]).toMatch(/no-store/);
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(row).toMatchObject({ phoneKey: CUSTOMER.phoneKey, passwordHash: customer.passwordHash, mustChangePassword: false, isGuest: false });
  });

  it("accepte une modification partielle et efface l'e-mail avec une chaîne vide", async () => {
    const { token, customer } = await customerAgent();
    expect((await patch("/api/customers/me", token, { commune: "Hydra" })).body).toMatchObject({ commune: "Hydra", firstName: "Amina", email: "amina@example.com" });
    const cleared = await patch("/api/customers/me", token, { email: "" });
    expect(cleared.status).toBe(200);
    expect(cleared.body.email).toBeUndefined();
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).email).toBeNull();
  });

  it("refuse (400) toute tentative de modifier un champ protégé ou de viser une autre cliente : rien ne change", async () => {
    const { token, customer } = await customerAgent();
    const other = await customerB();
    const before = JSON.stringify(await prisma.customer.findMany({ orderBy: { id: "asc" } }));
    const attempts: Array<Record<string, unknown>> = [
      { phone: "0770 00 00 00" },
      { phoneKey: "0770000000" },
      { passwordHash: "x" },
      { mustChangePassword: false },
      { isGuest: true },
      { id: other.customer.id, firstName: "Pirate" },
      { customerId: other.customer.id, firstName: "Pirate" },
      { firstName: "Pirate", createdAt: "2020-01-01" },
    ];
    for (const body of attempts) {
      const res = await patch("/api/customers/me", token, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
    expect(JSON.stringify(await prisma.customer.findMany({ orderBy: { id: "asc" } }))).toBe(before);
    expect(customer.id).not.toBe(other.customer.id);
  });

  it("valide les données (400) et exige une session (401)", async () => {
    const { token } = await customerAgent();
    for (const body of [{}, { firstName: "" }, { email: "pas-un-email" }, { wilayaCode: "99" }, { address: "x".repeat(201) }]) {
      expect((await patch("/api/customers/me", token, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await http().patch("/api/customers/me").send({ commune: "Hydra" })).status).toBe(401);
  });
});

/* ═════════════════════════ ISOLATION ENTRE CLIENTES ═════════════════════════ */

describe("isolation entre clientes : une cliente ne voit ni ne modifie jamais les données d'une autre", () => {
  async function scenario() {
    const a = await customerAgent();
    const b = await customerB();
    const product = await makeProduct({ price: 10_000, costPrice: 4_321, variants: [{ stock: 50 }, { stock: 50 }, { stock: 50 }] });
    const a1 = await placeOrder(CUSTOMER.phone, "Amina", product.variants[0]!.id);
    const a2 = await placeOrder(CUSTOMER.phone, "Amina", product.variants[1]!.id);
    const b1 = await placeOrder(B.phone, "Yacine", product.variants[2]!.id);
    const guest = await placeOrder("0770 55 55 55", "Invitée", product.variants[0]!.id); // commande sans compte
    return { a, b, a1, a2, b1, guest };
  }

  it("chaque cliente ne reçoit que SES commandes (les plus récentes d'abord) : jamais celles d'une autre, ni celles des invitées", async () => {
    const { a, b, a1, a2, b1, guest } = await scenario();
    const listA = await get("/api/customers/me/orders", a.token);
    expect(listA.status).toBe(200);
    expect(listA.body.map((o: { id: string }) => o.id)).toEqual([a2.id, a1.id]);
    const listB = await get("/api/customers/me/orders", b.token);
    expect(listB.body.map((o: { id: string }) => o.id)).toEqual([b1.id]);
    const everything = JSON.stringify([listA.body, listB.body]);
    expect(everything).not.toContain(guest.orderNumber);
    expect(JSON.stringify(listA.body)).not.toContain(b1.orderNumber);
    expect(JSON.stringify(listB.body)).not.toContain(a1.orderNumber);
  });

  it("le détail d'une commande d'une AUTRE cliente est indiscernable d'une commande inexistante (même 404)", async () => {
    const { a, b, a1, b1 } = await scenario();
    const own = await get(`/api/customers/me/orders/${a1.orderNumber}`, a.token);
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ id: a1.id, orderNumber: a1.orderNumber });
    expect((await get(`/api/customers/me/orders/${a1.orderNumber.toLowerCase()}`, a.token)).status).toBe(200);

    const foreign = await get(`/api/customers/me/orders/${b1.orderNumber}`, a.token);
    const unknown = await get("/api/customers/me/orders/CMD-2026-999999", a.token);
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(foreign.body).toEqual(unknown.body);
    expect((await get(`/api/customers/me/orders/${a1.orderNumber}`, b.token)).status).toBe(404); // et inversement
  });

  it("aucun identifiant venant du navigateur ne change l'identité : paramètre d'URL, en-têtes, corps, cookie trafiqué", async () => {
    const { a, b, a1, b1 } = await scenario();
    const spoof = {
      query: `?customerId=${b.customer.id}&id=${b.customer.id}&phone=${B.phoneKey}`,
      headers: { "X-Customer-Id": b.customer.id, "X-Forwarded-User": b.customer.id, "X-User-Id": b.customer.id },
    };
    const list = await supertest(getApp()).get(`/api/customers/me/orders${spoof.query}`).set({ ...as(a.token), ...spoof.headers });
    expect(list.body.map((o: { id: string }) => o.id)).not.toContain(b1.id);
    expect(list.body.every((o: { customer: { customerId: string } }) => o.customer.customerId === a.customer.id)).toBe(true);
    const me = await supertest(getApp()).get(`/api/customers/me${spoof.query}`).set({ ...as(a.token), ...spoof.headers });
    expect(me.body.id).toBe(a.customer.id);

    // Un jeton légèrement modifié n'est la session de personne ; celui de B ne donne accès qu'à B.
    const tampered = `${a.token.slice(0, -1)}${a.token.endsWith("A") ? "B" : "A"}`;
    expect((await get("/api/customers/me", tampered)).status).toBe(401);
    expect((await get("/api/customers/me", b.token)).body.id).toBe(b.customer.id);
    expect((await get(`/api/customers/me/orders/${a1.orderNumber}`, b.token)).status).toBe(404);
  });

  it("modifier son profil, changer son mot de passe ou se déconnecter n'affecte jamais l'autre cliente", async () => {
    const { a, b } = await scenario();
    const bBefore = await prisma.customer.findUniqueOrThrow({ where: { id: b.customer.id } });

    await patch("/api/customers/me", a.token, { commune: "Alger-Centre", firstName: "Modifiée" }).expect(200);
    await post("/api/customers/me/password", a.token, { currentPassword: CUSTOMER.password, newPassword: "un-nouveau-mot-de-passe" }).expect(200);

    const bAfter = await prisma.customer.findUniqueOrThrow({ where: { id: b.customer.id } });
    expect(bAfter).toEqual(bBefore);
    expect((await get("/api/customers/me", b.token)).status).toBe(200); // la session de B est intacte
    expect((await http().post("/api/customers/login").send({ phone: B.phone, password: B.password })).status).toBe(200); // son mot de passe aussi
  }, 60_000);

  it("la cliente ne reçoit NI le prix de revient (unitCost) NI les notes internes de l'administration", async () => {
    const { a, a1 } = await scenario();
    await prisma.orderStatusEvent.create({ data: { orderId: a1.id, status: "confirmed", note: "NOTE-INTERNE-ADMIN : cliente difficile" } });
    for (const res of [await get("/api/customers/me/orders", a.token), await get(`/api/customers/me/orders/${a1.orderNumber}`, a.token)]) {
      const json = JSON.stringify(res.body);
      expect(json).not.toContain("unitCost");
      expect(json).not.toContain("4321"); // la valeur du prix de revient
      expect(json).not.toContain("NOTE-INTERNE-ADMIN");
      expect(json).toContain(a1.orderNumber);
    }
    const detail = (await get(`/api/customers/me/orders/${a1.orderNumber}`, a.token)).body;
    expect(detail.items[0]).toMatchObject({ unitPrice: 10_000, quantity: 1 });
    expect(detail.statusHistory.length).toBeGreaterThan(0);
    expect(detail.statusHistory.every((e: Record<string, unknown>) => !("note" in e))).toBe(true);
  });

  it("toutes les routes du compte exigent une session (401), et la session admin ne les ouvre pas", async () => {
    const admin = await adminAgent();
    for (const [method, path] of [["get", "/api/customers/me"], ["patch", "/api/customers/me"], ["post", "/api/customers/me/password"], ["get", "/api/customers/me/orders"], ["get", "/api/customers/me/orders/CMD-2026-000001"]] as const) {
      expect((await http()[method](path).send({})).status, `${method} ${path} (sans session)`).toBe(401);
      expect((await admin[method](path).send({})).status, `${method} ${path} (session admin)`).toBe(401);
    }
  });
});

/* ═════════════════════════ CHANGEMENT DE MOT DE PASSE ═════════════════════════ */

describe("changement de mot de passe", () => {
  const NEW = "un-tout-nouveau-mot-de-passe";

  it("vérifie l'ancien, change le mot de passe et RÉVOQUE TOUTES les sessions — y compris l'actuelle — puis ouvre une session neuve", async () => {
    const { token: t1, customer } = await customerAgent();
    const { token: t2 } = await createCustomerSession(prisma, customer.id, "second appareil");
    expect(await prisma.customerSession.count()).toBe(2);

    const res = await post("/api/customers/me/password", t1, { currentPassword: CUSTOMER.password, newPassword: NEW });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: customer.id, mustChangePassword: false });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|token|"password"|\$2[aby]\$/i);
    const t3 = tokenOf(res);
    expect(t3).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sessionCookie(res)).toMatch(/HttpOnly/i);
    expect(sessionCookie(res)).toMatch(/SameSite=Lax/i);

    // Plus aucun ancien jeton ne marche : ni celui de la requête, ni celui de l'autre appareil.
    expect((await get("/api/customers/me", t1)).status).toBe(401);
    expect((await get("/api/customers/me", t2)).status).toBe(401);
    expect((await get("/api/customers/me", t3)).status).toBe(200); // la cliente reste connectée avec le jeton neuf
    expect(await prisma.customerSession.count()).toBe(1);

    expect((await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: CUSTOMER.password })).status).toBe(401);
    expect((await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: NEW })).status).toBe(200);
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(row.passwordHash).toMatch(/^\$2[ab]\$12\$/);
    expect(row.passwordHash).not.toBe(customer.passwordHash);
    expect(row.passwordChangedAt!.getTime()).toBeGreaterThan(customer.passwordChangedAt!.getTime() - 1);

    const audit = await prisma.auditLog.findMany();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "customer.password_changed", actorType: "customer", actorId: customer.id, targetId: customer.id, ipMasked: "127.0.0.0/24", metadata: { revokedCount: 2 } });
    const dump = JSON.stringify(audit);
    for (const secret of [CUSTOMER.password, NEW, t1, t2, t3]) expect(dump).not.toContain(secret);
  }, 60_000);

  it("ancien mot de passe erroné : 403, rien ne change, sessions intactes ; au-delà de 5 échecs, blocage (429) même avec le bon", async () => {
    const { token, customer } = await customerAgent();
    for (let i = 0; i < THROTTLE.passwordChange.maxFailures; i += 1) {
      const res = await post("/api/customers/me/password", token, { currentPassword: "mauvais-mot-de-passe", newPassword: NEW });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(sessionCookie(res)).toBeUndefined();
    }
    const locked = await post("/api/customers/me/password", token, { currentPassword: CUSTOMER.password, newPassword: NEW });
    expect(locked.status).toBe(429);
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0);
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(row.passwordHash).toBe(customer.passwordHash);
    expect((await get("/api/customers/me", token)).status).toBe(200);
  }, 60_000);

  it("refuse (400) un nouveau mot de passe identique, trop court, trop long en OCTETS, égal au téléphone — ou des champs en trop", async () => {
    const { token } = await customerAgent();
    const bad: Array<[string, Record<string, unknown>]> = [
      ["identique", { currentPassword: CUSTOMER.password, newPassword: CUSTOMER.password }],
      ["7 caractères", { currentPassword: CUSTOMER.password, newPassword: "abcdefg" }],
      ["73 octets", { currentPassword: CUSTOMER.password, newPassword: "é".repeat(37) }],
      ["caractère NUL", { currentPassword: CUSTOMER.password, newPassword: "abcd\u0000efgh" }],
      ["égal au téléphone", { currentPassword: CUSTOMER.password, newPassword: CUSTOMER.phoneKey }],
      ["champ en trop", { currentPassword: CUSTOMER.password, newPassword: NEW, customerId: "x" }],
      ["sans ancien mot de passe", { newPassword: NEW }],
    ];
    for (const [label, body] of bad) {
      const res = await post("/api/customers/me/password", token, body);
      expect(res.status, label).toBe(400);
      const typed = String(body.newPassword ?? "");
      if (typed.length >= 7) expect(JSON.stringify(res.body), label).not.toContain(typed);
    }
    expect((await get("/api/customers/me", token)).status).toBe(200); // rien n'a été révoqué par les refus
  }, 60_000);
});

/* ═══════════════════ CHANGEMENT OBLIGATOIRE (CÔTÉ SERVEUR) ═══════════════════ */

describe("mot de passe provisoire : changement obligatoire contrôlé par le serveur", () => {
  it("tant que le changement n'est pas fait, SEUL le profil (en lecture), le changement de mot de passe et la déconnexion répondent", async () => {
    const { token, customer } = await customerAgent();
    await prisma.customer.update({ where: { id: customer.id }, data: { mustChangePassword: true } });

    const me = await get("/api/customers/me", token);
    expect(me.status).toBe(200);
    expect(me.body.mustChangePassword).toBe(true); // le site découvre l'obligation ici
    for (const res of [await get("/api/customers/me/orders", token), await get("/api/customers/me/orders/CMD-2026-000001", token), await patch("/api/customers/me", token, { commune: "Hydra" })]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    }
    expect((await supertest(getApp()).post("/api/customers/logout").set(as(token))).status).toBe(204);
  });

  it("parcours complet : réinitialisation admin → connexion avec le provisoire → accès bloqué → changement → accès rétabli", async () => {
    const admin = await adminAgent();
    const { customer } = await customerAgent();
    await prisma.customerSession.deleteMany();

    const reset = await admin.post(`/api/admin/customers/${customer.id}/reset-password`).send({ adminPassword: ADMIN.password });
    expect(reset.status, JSON.stringify(reset.body)).toBe(200);
    const temporary = reset.body.temporaryPassword as string;

    const login = await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: temporary });
    expect(login.status).toBe(200);
    expect(login.body.mustChangePassword).toBe(true);
    const token = tokenOf(login);
    expect((await get("/api/customers/me/orders", token)).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    // Le nouveau mot de passe ne peut pas être le provisoire lui-même.
    expect((await post("/api/customers/me/password", token, { currentPassword: temporary, newPassword: temporary })).status).toBe(400);

    const changed = await post("/api/customers/me/password", token, { currentPassword: temporary, newPassword: "mon-vrai-mot-de-passe" });
    expect(changed.status).toBe(200);
    expect(changed.body.mustChangePassword).toBe(false);
    const fresh = tokenOf(changed);
    expect((await get("/api/customers/me/orders", fresh)).status).toBe(200);
    expect((await patch("/api/customers/me", fresh, { commune: "Hydra" })).status).toBe(200);
    expect((await get("/api/customers/me", token)).status).toBe(401); // le jeton du provisoire est révoqué
    expect((await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: temporary })).status).toBe(401); // le provisoire est mort

    const actions = (await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((r) => r.action);
    expect(actions).toEqual(["admin.customer_password_reset", "customer.password_change_forced"]);
  }, 90_000);
});

/* ═══════════════ RÉINITIALISATION PAR L'ADMINISTRATEUR ═══════════════ */

describe("réinitialisation du mot de passe d'une cliente par l'administrateur", () => {
  const reset = (admin: Awaited<ReturnType<typeof adminAgent>>, id: string, adminPassword: string = ADMIN.password) =>
    admin.post(`/api/admin/customers/${id}/reset-password`).send({ adminPassword });

  it("exige une session ADMIN : refusée sans session, avec une session cliente, ou depuis une autre origine", async () => {
    const { token, customer } = await customerAgent();
    const body = { adminPassword: ADMIN.password };
    expect((await http().post(`/api/admin/customers/${customer.id}/reset-password`).send(body)).status).toBe(401);
    expect((await supertest(getApp()).post(`/api/admin/customers/${customer.id}/reset-password`).set(as(token)).send(body)).status).toBe(401);
    const admin = await adminAgent();
    expect((await admin.post(`/api/admin/customers/${customer.id}/reset-password`).set("Origin", "https://site-malveillant.example").send(body)).status).toBe(403);
    // Rien n'a bougé.
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).mustChangePassword).toBe(false);
    expect((await get("/api/customers/me", token)).status).toBe(200);
  });

  it("ré-authentification : un mauvais mot de passe admin est refusé (403), journalisé, et ne modifie rien", async () => {
    const admin = await adminAgent();
    const { token, customer } = await customerAgent();
    const res = await reset(admin, customer.id, "mauvais-mot-de-passe-admin");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.temporaryPassword).toBeUndefined();
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(row).toMatchObject({ passwordHash: customer.passwordHash, mustChangePassword: false });
    expect((await get("/api/customers/me", token)).status).toBe(200);
    const audit = await prisma.auditLog.findMany();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "admin.customer_password_reset_denied", actorType: "admin", targetId: customer.id, metadata: { reason: "bad_admin_password" } });
    expect(JSON.stringify(audit)).not.toContain("mauvais-mot-de-passe-admin");
  }, 60_000);

  it("après 5 mauvaises confirmations, l'administrateur est bloqué quelques minutes (429), même avec le bon mot de passe", async () => {
    const admin = await adminAgent();
    const { customer } = await customerAgent();
    for (let i = 0; i < THROTTLE.adminStepUp.maxFailures; i += 1) expect((await reset(admin, customer.id, "mauvais-mot-de-passe-admin")).status).toBe(403);
    const locked = await reset(admin, customer.id);
    expect(locked.status).toBe(429);
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).mustChangePassword).toBe(false);
  }, 90_000);

  it("réinitialise : mot de passe provisoire sûr affiché UNE fois, haché en base, TOUTES les sessions révoquées, blocage levé, changement obligatoire", async () => {
    const admin = await adminAgent();
    const { token: t1, customer } = await customerAgent();
    const { token: t2 } = await createCustomerSession(prisma, customer.id, "autre appareil");
    const { token: t3 } = await createCustomerSession(prisma, customer.id, "troisième appareil");
    // La cliente est aussi bloquée en connexion : la réinitialisation doit lever ce blocage.
    for (let i = 0; i < THROTTLE.loginPhone.maxFailures; i += 1) await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: "mauvais-mot-de-passe" });
    expect((await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: CUSTOMER.password })).status).toBe(429);

    const res = await reset(admin, customer.id);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
    expect(res.headers.pragma).toBe("no-cache");
    const temporary = res.body.temporaryPassword as string;
    expect(res.body).toEqual({ customerId: customer.id, temporaryPassword: temporary, mustChangePassword: true });
    expect(temporary).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
    expect([...temporary].every((c) => TEMPORARY_PASSWORD_ALPHABET.includes(c))).toBe(true);
    expect(customerPasswordSchema.safeParse(temporary).success).toBe(true); // respecte la politique de mot de passe

    // Base : hachage bcrypt uniquement, changement obligatoire, TOUTES les sessions supprimées.
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(row.passwordHash).toMatch(/^\$2[ab]\$12\$/);
    expect(await bcrypt.compare(temporary, row.passwordHash!)).toBe(true);
    expect(row).toMatchObject({ mustChangePassword: true, isGuest: false });
    expect(await prisma.customerSession.count()).toBe(0);
    for (const token of [t1, t2, t3]) expect((await get("/api/customers/me", token)).status).toBe(401);

    // Le mot de passe provisoire n'apparaît EN CLAIR dans AUCUNE table.
    const dump = JSON.stringify({
      customers: await prisma.customer.findMany(),
      sessions: await prisma.customerSession.findMany(),
      throttles: await prisma.authThrottle.findMany(),
      audit: await prisma.auditLog.findMany(),
    });
    expect(dump).not.toContain(temporary);
    expect(dump).not.toContain(ADMIN.password);

    // L'ancien mot de passe est mort, le provisoire fonctionne (le blocage de connexion a été levé).
    expect((await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: CUSTOMER.password })).status).toBe(401);
    const login = await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: temporary });
    expect(login.status).toBe(200);
    expect(login.body.mustChangePassword).toBe(true);

    const audit = await prisma.auditLog.findMany({ where: { action: "admin.customer_password_reset" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorType: "admin", targetType: "customer", targetId: customer.id, ipMasked: "127.0.0.0/24", metadata: { revokedCount: 3, wasLegacy: false } });
    expect(audit[0]!.actorId).toBeTruthy();
  }, 90_000);

  it("une cliente historique sans mot de passe obtient un accès par la même voie (signalée « legacy » dans le journal)", async () => {
    const admin = await adminAgent();
    const legacy = await createCustomerAccount({ passwordHash: null, isGuest: true });
    const res = await reset(admin, legacy.id);
    expect(res.status).toBe(200);
    expect((await http().post("/api/customers/login").send({ phone: CUSTOMER.phone, password: res.body.temporaryPassword })).status).toBe(200);
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: legacy.id } })).toMatchObject({ isGuest: false, mustChangePassword: true });
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "admin.customer_password_reset" } })).metadata).toMatchObject({ wasLegacy: true });
  }, 60_000);

  it("cliente inconnue : 404 journalisé — mais seulement APRÈS la ré-authentification (pas de sondage d'identifiants sans le mot de passe admin)", async () => {
    const admin = await adminAgent();
    const probe = await reset(admin, "cl_inexistante", "mauvais-mot-de-passe-admin");
    expect(probe.status).toBe(403); // pas 404 : l'existence n'est pas révélée à qui ne s'est pas ré-authentifié
    const res = await reset(admin, "cl_inexistante");
    expect(res.status).toBe(404);
    const reasons = (await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((r) => (r.metadata as { reason?: string } | null)?.reason);
    expect(reasons).toEqual(["bad_admin_password", "not_found"]);
  }, 60_000);

  it("limite à 10 réinitialisations par heure et par administrateur (429 journalisé)", async () => {
    const admin = await adminAgent();
    const customers = await Promise.all(Array.from({ length: 11 }, (_, i) => createCustomerAccount({ phone: `0661 00 01 ${String(10 + i)}`, phoneKey: `06610001${String(10 + i)}` })));
    for (let i = 0; i < THROTTLE.adminReset.max; i += 1) expect((await reset(admin, customers[i]!.id)).status).toBe(200);
    const blocked = await reset(admin, customers[10]!.id);
    expect(blocked.status).toBe(429);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customers[10]!.id } })).mustChangePassword).toBe(false);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "admin.customer_password_reset_denied" } })).metadata).toMatchObject({ reason: "rate_limited" });
  }, 120_000);

  it("ATOMIQUE : si le journal d'audit ne peut pas être écrit, la réinitialisation est entièrement annulée", async () => {
    const admin = await adminAgent();
    const { token, customer } = await customerAgent();
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT "test_bloque_reset" CHECK ("action" <> 'admin.customer_password_reset')`);
    try {
      const res = await reset(admin, customer.id);
      expect([409, 500]).toContain(res.status); // refus de la base : jamais un succès
      expect(res.body.temporaryPassword).toBeUndefined();
      const row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
      expect(row).toMatchObject({ passwordHash: customer.passwordHash, mustChangePassword: false });
      expect((await get("/api/customers/me", token)).status).toBe(200); // sessions intactes
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT "test_bloque_reset"`);
    }
  }, 60_000);

  it("valide le corps (400) et n'expose jamais de hachage dans les routes admin existantes", async () => {
    const admin = await adminAgent();
    const { customer } = await customerAgent();
    for (const body of [{}, { adminPassword: "" }, { adminPassword: ADMIN.password, extra: 1 }]) {
      expect((await admin.post(`/api/admin/customers/${customer.id}/reset-password`).send(body)).status).toBe(400);
    }
    const list = await admin.get("/api/admin/customers");
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|\$2[aby]\$|mustChangePassword/);
    expect((await admin.get(`/api/admin/customers/${customer.id}`)).status).toBe(200);
  });

  it("génère des mots de passe provisoires aléatoires, sans caractères ambigus, conformes à la politique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      const p = generateTemporaryPassword();
      expect(p).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
      expect(p).not.toMatch(/[01OIl]/);
      expect(customerPasswordSchema.safeParse(p).success).toBe(true);
      seen.add(p);
    }
    expect(seen.size).toBe(300);
    const letters = new Set([...seen].join(""));
    expect(letters.size).toBeGreaterThan(40); // tout l'alphabet est utilisé (tirage sans biais grossier)
  });
});

/* ═══════════════ NETTOYAGE PLANIFIÉ (CRON) ═══════════════ */

describe("nettoyage planifié (GET /api/internal/purge)", () => {
  const CRON = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

  it("exige le secret : sans en-tête, avec un mauvais secret ou un autre schéma → 401, et rien n'est supprimé", async () => {
    const customer = await createCustomerAccount();
    await createCustomerSession(prisma, customer.id, "vieux", new Date(Date.now() - 40 * 24 * 3600_000)); // expirée
    for (const headers of [{}, { Authorization: "Bearer mauvais-secret" }, { Authorization: `Basic ${process.env.CRON_SECRET}` }, { Authorization: process.env.CRON_SECRET! }]) {
      expect((await http().get("/api/internal/purge").set(headers)).status, JSON.stringify(headers)).toBe(401);
    }
    expect(await prisma.customerSession.count()).toBe(1);
  });

  it("supprime sessions expirées, compteurs périmés et audit au-delà de la conservation — jamais les données métier ni les éléments récents", async () => {
    const customer = await createCustomerAccount();
    const product = await makeProduct();
    await http().post("/api/orders").send(orderBody([{ variantId: product.variants[0]!.id, quantity: 1 }])).expect(201);
    const old = new Date(Date.now() - 40 * 24 * 3600_000);
    const expired = await createCustomerSession(prisma, customer.id, "expirée", old);
    const active = await createCustomerSession(prisma, customer.id, "active");
    await prisma.authThrottle.create({ data: { scope: "login-ip", keyHash: "ancien", count: 2, updatedAt: new Date(Date.now() - 3 * 24 * 3600_000) } });
    await prisma.authThrottle.create({ data: { scope: "login-ip", keyHash: "recent", count: 2 } });
    const day = 24 * 3600_000;
    await prisma.auditLog.create({ data: { actorType: "system", action: "customer.login_locked", createdAt: new Date(Date.now() - (AUDIT_RETENTION_DAYS + 1) * day) } });
    await prisma.auditLog.create({ data: { actorType: "system", action: "customer.login_locked", createdAt: new Date(Date.now() - (AUDIT_RETENTION_DAYS - 1) * day) } });
    const before = { customers: await prisma.customer.count(), orders: await prisma.order.count(), products: await prisma.product.count(), variants: await prisma.productVariant.count() };

    const res = await http().get("/api/internal/purge").set(CRON);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sessions: 1, throttles: 1, auditLogs: 1 });
    expect(res.headers["cache-control"]).toMatch(/no-store/);

    expect(await prisma.customerSession.count({ where: { tokenHash: hashToken(expired.token) } })).toBe(0);
    expect(await prisma.customerSession.count({ where: { tokenHash: hashToken(active.token) } })).toBe(1);
    expect(await prisma.authThrottle.findMany({ select: { keyHash: true } })).toEqual([{ keyHash: "recent" }]);
    expect(await prisma.auditLog.count()).toBe(1); // celle de 364 jours est conservée
    expect({ customers: await prisma.customer.count(), orders: await prisma.order.count(), products: await prisma.product.count(), variants: await prisma.productVariant.count() }).toEqual(before);
  });

  it("garde un compteur encore bloqué, même ancien", async () => {
    await prisma.authThrottle.create({
      data: { scope: "login-phone", keyHash: throttleKey("login-phone", "0555123456"), count: 5, updatedAt: new Date(Date.now() - 3 * 24 * 3600_000), lockedUntil: new Date(Date.now() + 600_000) },
    });
    expect((await http().get("/api/internal/purge").set(CRON)).body.throttles).toBe(0);
  });
});

/* ═══════════════ JOURNAUX : AUCUN SECRET, MÊME DANS LES ERREURS ═══════════════ */

describe("journaux HTTP : cookies, autorisation, corps et messages d'erreur", () => {
  it("le filtre masque bcrypt, JWT, cookies de session, Bearer, empreintes, jetons et valeurs de clés sensibles — et laisse le texte normal intact", () => {
    const hash = bcrypt.hashSync("x", 4);
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlLXZhbHVl";
    const token = "A".repeat(20) + "b".repeat(20) + "-_9";
    const sha = "ab".repeat(32);
    const dirty = `Invalid invocation: passwordHash: "${hash}", tokenHash: "${sha}" cookie customer_session=${token}; admin_session=${jwt} Authorization: Bearer abc.def-123 jeton ${token} empreinte ${sha} secret: 'xyz'`;
    const clean = scrubSecrets(dirty);
    for (const leak of [hash, jwt, token, sha, "abc.def-123", "xyz"]) expect(clean).not.toContain(leak);
    expect(scrubSecrets("Commande CMD-2026-000123 introuvable pour Amina Benali (wilaya 16).")).toBe("Commande CMD-2026-000123 introuvable pour Amina Benali (wilaya 16).");
  });

  it("une erreur Prisma qui recopie des valeurs (hachage, champ sensible) est masquée dans les journaux", async () => {
    let captured = "";
    const logger = pino({ ...LOG_OPTIONS, level: "info" }, new Writable({ write(chunk, _e, cb) { captured += chunk.toString(); cb(); } }));
    // Construite à l'exécution : le message d'erreur de Prisma recopie aussi les lignes de CODE SOURCE de l'appelant, où une valeur
    // littérale apparaîtrait telle quelle (ce qui fausserait le test sans rien dire de ce que la requête a envoyé).
    const MARK = ["VALEUR", "SECRETE", String(12345)].join("-");
    let error: unknown;
    try {
      await prisma.customer.create({ data: { firstName: "a", lastName: "b", phone: "p", phoneKey: "0555123456", wilayaCode: "16", commune: "c", passwordHash: MARK, mustChangePassword: "oui" as unknown as boolean } });
    } catch (e) {
      error = e;
    }
    expect((error as Error).message).toContain(MARK); // le danger est réel : Prisma recopie la valeur dans son message…
    logger.error({ err: error }, "erreur non gérée");
    expect(captured.length).toBeGreaterThan(100);
    expect(captured).not.toContain(MARK); // …mais elle n'atteint pas les journaux
    expect(captured).toContain("[Redacted]");
  });

  it("l'application ne journalise ni cookies entrants (admin ou cliente), ni en-têtes d'autorisation, ni corps, ni cookies de réponse", async () => {
    let captured = "";
    const app = createApp({ logStream: new Writable({ write(chunk, _e, cb) { captured += chunk.toString(); cb(); } }) });
    await createAdmin();
    const adminPassword = ADMIN.password;
    const login = await supertest(app).post("/api/auth/login").send({ email: ADMIN.email, password: adminPassword });
    expect(login.status).toBe(200);
    const adminToken = /^admin_session=([^;]*)/.exec(cookies(login).find((c) => c.startsWith("admin_session=")) ?? "")?.[1] ?? "";
    expect(adminToken.length).toBeGreaterThan(20);

    const customer = await createCustomerAccount();
    const { token: customerToken } = await customerAgent();
    const bearer = "Bearer SECRET-BEARER-ABC123";
    await supertest(app).get("/api/admin/orders").set({ Cookie: `admin_session=${adminToken}; customer_session=${customerToken}`, Authorization: bearer }).expect(200);
    const reset = await supertest(app).post(`/api/admin/customers/${customer.id}/reset-password`).set("Cookie", `admin_session=${adminToken}`).send({ adminPassword });
    expect(reset.status).toBe(200);
    const temporary = reset.body.temporaryPassword as string;
    await supertest(app).post("/api/customers/login").send({ phone: CUSTOMER.phone, password: temporary }).expect(200);

    expect(captured.length).toBeGreaterThan(300); // les requêtes sont bien journalisées…
    expect(captured).toContain("/api/admin/customers");
    for (const secret of [adminPassword, adminToken, customerToken, bearer, "SECRET-BEARER-ABC123", temporary, CUSTOMER.password]) {
      expect(captured, `fuite dans les journaux : ${secret.slice(0, 10)}…`).not.toContain(secret);
    }
  }, 90_000);
});
