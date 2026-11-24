import type { CookieOptions, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { isProduction } from "../config/env";
import { CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_MS, MAX_SESSIONS_PER_CUSTOMER, SESSION_TOUCH_INTERVAL_MS } from "../config/customer-auth";

/**
 * Sessions clientes : un jeton ALÉATOIRE opaque (32 octets, 256 bits) dans un cookie, et en base UNIQUEMENT son empreinte
 * SHA-256. Une session = une ligne : la supprimer la révoque pour de bon (déconnexion, changement de mot de passe…).
 * Aucun rapport avec la session admin (JWT) : cookie, mécanisme et table différents.
 */

/** 32 octets en base64url = 43 caractères exactement. */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const cookieOptions: CookieOptions = { httpOnly: true, sameSite: "lax", secure: isProduction, path: "/" };

export function setCustomerSessionCookie(res: Response, token: string): void {
  res.cookie(CUSTOMER_SESSION_COOKIE, token, { ...cookieOptions, maxAge: CUSTOMER_SESSION_MS });
}

export function clearCustomerSessionCookie(res: Response): void {
  res.clearCookie(CUSTOMER_SESSION_COOKIE, cookieOptions);
}

/** User-Agent tronqué, sans caractères de contrôle (information d'appareil uniquement, jamais utilisée pour décider). */
const cleanUserAgent = (ua: string | undefined): string | null => {
  const clean = (ua ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
  return clean || null;
};

/**
 * Ouvre une session : jeton neuf à chaque connexion (jamais réutilisé : pas de fixation de session). Au-delà de
 * `MAX_SESSIONS_PER_CUSTOMER`, les plus anciennes sont supprimées.
 */
export async function createCustomerSession(
  db: Pick<Prisma.TransactionClient, "customerSession">,
  customerId: string,
  userAgent?: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_MS);
  await db.customerSession.create({
    data: { tokenHash: hashToken(token), customerId, createdAt: now, lastUsedAt: now, expiresAt, userAgent: cleanUserAgent(userAgent) },
  });
  const surplus = await db.customerSession.findMany({
    where: { customerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: MAX_SESSIONS_PER_CUSTOMER,
    select: { id: true },
  });
  if (surplus.length > 0) await db.customerSession.deleteMany({ where: { id: { in: surplus.map((s) => s.id) } } });
  return { token, expiresAt };
}

/**
 * Vérifie une session CÔTÉ SERVEUR à chaque requête : jeton bien formé, empreinte connue, non expirée, cliente toujours existante.
 * Une session expirée est supprimée au passage. Renvoie null dans tous les autres cas (aucun détail sur la raison).
 */
export async function resolveCustomerSession(token: string | undefined, now: Date = new Date()) {
  if (!token || !TOKEN_FORMAT.test(token)) return null;
  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: true },
  });
  if (!session) return null;
  if (session.expiresAt <= now) {
    await prisma.customerSession.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (now.getTime() - session.lastUsedAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await prisma.customerSession.updateMany({ where: { id: session.id }, data: { lastUsedAt: now } });
  }
  return session;
}

/** Révoque la session correspondant à ce jeton (sans erreur si elle n'existe pas ou si le jeton est mal formé). */
export async function revokeCustomerSession(token: string | undefined): Promise<void> {
  if (!token || !TOKEN_FORMAT.test(token)) return;
  await prisma.customerSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Révoque toutes les sessions d'une cliente (sauf éventuellement la courante). */
export async function revokeAllCustomerSessions(db: Pick<Prisma.TransactionClient, "customerSession">, customerId: string, exceptSessionId?: string): Promise<number> {
  const { count } = await db.customerSession.deleteMany({ where: { customerId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
  return count;
}
