import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

const customerData = (over: Record<string, unknown> = {}) => ({
  firstName: "Amina",
  lastName: "Benali",
  phone: "0555 12 34 56",
  phoneKey: "0555123456",
  wilayaCode: "16",
  commune: "Bab Ezzouar",
  ...over,
});

const BCRYPT = bcrypt.hashSync("un-mot-de-passe", 4); // coût 04 : valide pour la contrainte, rapide en test
const inOneHour = () => new Date(Date.now() + 3_600_000);

describe("migration « comptes clientes » : structure et verrouillage d'accès", () => {
  it("TOUTES les tables du schéma public ont la RLS activée (refus pour anon/authenticated) — y compris les futures tables", async () => {
    const rows = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    const names = rows.map((r) => r.relname);
    for (const table of ["Customer", "CustomerSession", "AuthThrottle", "AuditLog"]) expect(names).toContain(table);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it("n'ajoute que des colonnes à Customer, sans toucher aux existantes : valeurs par défaut neutres", async () => {
    const cols = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string; column_default: string | null }>>`
      SELECT column_name, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Customer'`;
    const byName = new Map(cols.map((c) => [c.column_name, c]));
    for (const old of ["id", "firstName", "lastName", "phone", "phoneKey", "email", "wilayaCode", "commune", "address", "isGuest", "createdAt"]) {
      expect(byName.has(old), `colonne existante conservée : ${old}`).toBe(true);
    }
    expect(byName.get("passwordHash")).toMatchObject({ is_nullable: "YES", column_default: null });
    expect(byName.get("mustChangePassword")).toMatchObject({ is_nullable: "NO", column_default: "false" });
    expect(byName.get("passwordChangedAt")).toMatchObject({ is_nullable: "YES", column_default: null });
  });

  it("un client « invité » créé comme avant reste valide : pas de mot de passe, pas de changement forcé", async () => {
    const guest = await prisma.customer.create({ data: customerData() });
    expect(guest).toMatchObject({ isGuest: true, passwordHash: null, mustChangePassword: false, passwordChangedAt: null });
  });
});

describe("contraintes d'intégrité", () => {
  it("phoneKey : format national normalisé obligatoire, l'unicité reste garantie", async () => {
    for (const bad of ["0455123456", "055512345", "05551234567", "+213555123456", "0555 123456", "abcdefghij", ""]) {
      await expect(prisma.customer.create({ data: customerData({ phoneKey: bad }) }), bad).rejects.toThrow();
    }
    for (const good of ["0555123456", "0655123456", "0755123456"]) {
      await prisma.customer.create({ data: customerData({ phoneKey: good, phone: good }) });
    }
    await expect(prisma.customer.create({ data: customerData({ phoneKey: "0555123456" }) })).rejects.toThrow(/Unique constraint/i);
  });

  it("passwordHash : seul un hachage bcrypt est accepté — un mot de passe en clair est refusé par la base", async () => {
    for (const clear of ["password123", "un-mot-de-passe", "$2b$12$tropcourt", `${BCRYPT}x`, " " + BCRYPT]) {
      await expect(prisma.customer.create({ data: customerData({ phoneKey: "0555000001", passwordHash: clear }) }), clear).rejects.toThrow();
    }
    const ok = await prisma.customer.create({ data: customerData({ phoneKey: "0555000001", passwordHash: BCRYPT }) });
    expect(ok.passwordHash).toBe(BCRYPT);
    // Coût 12 (celui de production) accepté aussi.
    await prisma.customer.create({ data: customerData({ phoneKey: "0555000002", passwordHash: bcrypt.hashSync("x", 12).replace(/^\$2a/, "$2b") }) });
  });

  it("session : empreinte unique, expiration postérieure à la création, suppression en cascade avec le client", async () => {
    const customer = await prisma.customer.create({ data: customerData() });
    const now = new Date();
    await prisma.customerSession.create({ data: { tokenHash: "a".repeat(64), customerId: customer.id, createdAt: now, expiresAt: inOneHour() } });
    await expect(prisma.customerSession.create({ data: { tokenHash: "a".repeat(64), customerId: customer.id, expiresAt: inOneHour() } })).rejects.toThrow(/Unique constraint/i);
    await expect(
      prisma.customerSession.create({ data: { tokenHash: "b".repeat(64), customerId: customer.id, createdAt: now, expiresAt: new Date(now.getTime() - 1000) } }),
    ).rejects.toThrow();
    await prisma.customer.delete({ where: { id: customer.id } });
    expect(await prisma.customerSession.count()).toBe(0);
  });

  it("compteur de limitation : une ligne par (scope, clé), jamais négatif", async () => {
    await prisma.authThrottle.create({ data: { scope: "login-phone", keyHash: "k1", count: 1 } });
    await expect(prisma.authThrottle.create({ data: { scope: "login-phone", keyHash: "k1" } })).rejects.toThrow(/Unique constraint/i);
    await prisma.authThrottle.create({ data: { scope: "login-ip", keyHash: "k1" } }); // autre portée : autorisé
    await expect(prisma.authThrottle.create({ data: { scope: "x", keyHash: "k2", count: -1 } })).rejects.toThrow();
  });

  it("journal d'audit : type d'acteur limité à admin / customer / system", async () => {
    for (const actorType of ["admin", "customer", "system"] as const) {
      await prisma.auditLog.create({ data: { actorType, action: "test.action", metadata: { ok: true } } });
    }
    await expect(prisma.$executeRawUnsafe(`INSERT INTO "AuditLog" ("id","actorType","action") VALUES ('x','pirate','test')`)).rejects.toThrow();
    expect(await prisma.auditLog.count()).toBe(3);
  });
});
