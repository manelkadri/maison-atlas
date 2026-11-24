import bcrypt from "bcryptjs";
import supertest from "supertest";
import { createApp } from "../src/create-app";
import { prisma } from "../src/config/db";
import { CUSTOMER_SESSION_COOKIE } from "../src/config/customer-auth";
import { createCustomerSession } from "../src/utils/customer-session";

export const ADMIN = { email: "owner@test.local", password: "correct-horse-battery-staple" } as const;

let app: ReturnType<typeof createApp> | undefined;

/** Application Express (une seule instance par fichier de test). */
export function getApp() {
  app ??= createApp();
  return app;
}

/** Client HTTP sans session. */
export const http = () => supertest(getApp());

/** Vide toutes les tables (sauf l'historique des migrations) et remet les séquences à zéro. */
export async function resetDatabase() {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Crée le compte propriétaire de test (coût bcrypt réduit pour la vitesse). */
export async function createAdmin() {
  return prisma.adminUser.create({ data: { email: ADMIN.email, passwordHash: await bcrypt.hash(ADMIN.password, 4) } });
}

/** Client HTTP connecté en administrateur (le cookie de session est conservé entre les appels). */
export async function adminAgent() {
  await createAdmin().catch(() => undefined);
  const agent = supertest.agent(getApp());
  const res = await agent.post("/api/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
  if (res.status !== 200) throw new Error(`Connexion admin de test impossible : ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

/** Compte client de test (mot de passe haché avec un coût bcrypt réduit pour la vitesse). */
export const CUSTOMER = { phone: "0555 12 34 56", phoneKey: "0555123456", password: "correct-horse-battery" } as const;

export async function createCustomerAccount(over: Record<string, unknown> = {}) {
  return prisma.customer.create({
    data: {
      firstName: "Amina",
      lastName: "Benali",
      phone: CUSTOMER.phone,
      phoneKey: CUSTOMER.phoneKey,
      email: "amina@example.com",
      wilayaCode: "16",
      commune: "Bab Ezzouar",
      address: "Cité 5 Juillet, bloc C",
      isGuest: false,
      passwordHash: await bcrypt.hash(CUSTOMER.password, 4),
      passwordChangedAt: new Date(),
      ...over,
    },
  });
}

/**
 * Client HTTP connecté en cliente : crée le compte (s'il n'existe pas) puis ouvre une session DIRECTEMENT en base
 * (pas de passage par /login : ni limitation de tentatives, ni coût bcrypt). Le cookie est joint à chaque requête.
 */
export async function customerAgent(over: Record<string, unknown> = {}) {
  const customer = (await prisma.customer.findUnique({ where: { phoneKey: String(over.phoneKey ?? CUSTOMER.phoneKey) } })) ?? (await createCustomerAccount(over));
  const { token } = await createCustomerSession(prisma, customer.id, "vitest");
  const agent = supertest.agent(getApp()).set("Cookie", `${CUSTOMER_SESSION_COOKIE}=${token}`);
  return { agent, customer, token };
}

export { prisma };
