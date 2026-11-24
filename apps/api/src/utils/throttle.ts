import { createHmac } from "node:crypto";
import { prisma } from "../config/db";
import { env } from "../config/env";

/**
 * Compteurs de limitation des tentatives, en BASE (partagés entre toutes les instances du serveur : un limiteur en mémoire
 * ne protège rien sur Vercel). La clé est un HMAC : jamais d'adresse IP ni de numéro de téléphone en clair dans la table.
 * Les incréments sont atomiques (UPSERT SQL), même sous requêtes simultanées.
 */

/** HMAC séparé par portée (séparation des usages) à partir du secret du serveur. */
export const throttleKey = (scope: string, value: string): string =>
  createHmac("sha256", env.JWT_SECRET).update(`auth-throttle|${scope}|${value}`).digest("hex");

const secondsUntil = (target: Date, now: Date) => Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000));

/**
 * Compte UNE tentative (réussie ou non) dans la fenêtre courante et dit si la limite est dépassée.
 * La fenêtre est fixe : elle repart à zéro `windowMs` après la première tentative (elle n'est jamais prolongée par les suivantes).
 */
export async function consumeAttempt(
  scope: string,
  value: string,
  limit: { max: number; windowMs: number },
  now: Date = new Date(),
): Promise<{ allowed: boolean; count: number; retryAfterSeconds: number }> {
  const keyHash = throttleKey(scope, value);
  // 1) fenêtre expirée → on repart de zéro (UPDATE conditionnel, atomique)
  await prisma.authThrottle.updateMany({
    where: { scope, keyHash, windowStart: { lte: new Date(now.getTime() - limit.windowMs) } },
    data: { count: 0, windowStart: now, lockedUntil: null },
  });
  // 2) incrément atomique (INSERT … ON CONFLICT DO UPDATE côté Prisma). Si deux requêtes créent la ligne au même instant et que
  //    l'une perd la course (violation d'unicité), on rejoue : la ligne existe alors et l'UPDATE s'applique.
  const increment = () =>
    prisma.authThrottle.upsert({
      where: { scope_keyHash: { scope, keyHash } },
      create: { scope, keyHash, count: 1, windowStart: now },
      update: { count: { increment: 1 } },
      select: { count: true, windowStart: true },
    });
  const row = await increment().catch((error: unknown) => {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") return increment();
    throw error;
  });
  const allowed = row.count <= limit.max;
  return { allowed, count: row.count, retryAfterSeconds: allowed ? 0 : secondsUntil(new Date(row.windowStart.getTime() + limit.windowMs), now) };
}

/** Blocage en cours pour cette clé ? (lecture seule : ne compte rien) */
export async function getLock(scope: string, value: string, now: Date = new Date()): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const row = await prisma.authThrottle.findUnique({ where: { scope_keyHash: { scope, keyHash: throttleKey(scope, value) } }, select: { lockedUntil: true } });
  if (!row?.lockedUntil || row.lockedUntil <= now) return { locked: false, retryAfterSeconds: 0 };
  return { locked: true, retryAfterSeconds: secondsUntil(row.lockedUntil, now) };
}

/**
 * Enregistre UN échec ; au `maxFailures`-ième échec dans la fenêtre, bloque la clé pour `lockMs` (fixe, jamais définitif).
 * `newlyLocked` n'est vrai que pour l'échec qui déclenche le blocage (utile pour n'auditer qu'une fois).
 */
export async function recordFailure(
  scope: string,
  value: string,
  limit: { maxFailures: number; windowMs: number; lockMs: number },
  now: Date = new Date(),
): Promise<{ count: number; newlyLocked: boolean }> {
  const { count } = await consumeAttempt(scope, value, { max: Number.MAX_SAFE_INTEGER, windowMs: limit.windowMs }, now);
  if (count < limit.maxFailures) return { count, newlyLocked: false };
  const keyHash = throttleKey(scope, value);
  const locked = await prisma.authThrottle.updateMany({
    where: { scope, keyHash, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: { lockedUntil: new Date(now.getTime() + limit.lockMs) },
  });
  return { count, newlyLocked: locked.count > 0 };
}

/** Remet la clé à zéro (connexion réussie, réinitialisation par l'administrateur). */
export async function clearThrottle(scope: string, value: string): Promise<void> {
  await prisma.authThrottle.deleteMany({ where: { scope, keyHash: throttleKey(scope, value) } });
}
