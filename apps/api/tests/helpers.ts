import bcrypt from "bcryptjs";
import supertest from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/db";

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

export { prisma };
