import { utf8ByteLength, PASSWORD_MAX_BYTES, type CustomerAccountLoginValues, type CustomerRegisterValues } from "@fashion/validators";
import { getWilaya, normalizePhone } from "@fashion/shared";
import type { CustomerAccount } from "@fashion/types";
import type { Customer } from "@prisma/client";
import { prisma } from "../../config/db";
import { THROTTLE } from "../../config/customer-auth";
import { AppError, unauthenticated, validation } from "../../utils/errors";
import { recordAudit } from "../../utils/audit";
import { createCustomerSession } from "../../utils/customer-session";
import { ipLimitKey, subnetLimitKey } from "../../utils/ip";
import { hashPassword, verifyPassword } from "../../utils/password";
import { purgeExpiredAuthData } from "../../utils/purge";
import { clearThrottle, consumeAttempt, getLock, recordFailure, throttleKey } from "../../utils/throttle";

/**
 * Inscription et connexion des clientes (téléphone + mot de passe).
 *
 * Principes (voir le document de conception) :
 *   - réponses IDENTIQUES quelle que soit la situation du numéro (inconnu, mauvais mot de passe, compte sans mot de passe,
 *     compte historique, numéro déjà inscrit…) : on ne révèle jamais quels numéros ont un compte ;
 *   - EXACTEMENT un calcul bcrypt par tentative, qu'il y ait un compte ou non (pas de différence de temps de réponse) ;
 *   - limites par IP vérifiées AVANT les compteurs par numéro ;
 *   - aucun secret dans les journaux ni dans l'audit.
 */

export const LOGIN_FAILED = "Téléphone ou mot de passe incorrect.";
/** Message unique pour un numéro déjà utilisé : ne dit pas s'il y a un compte, ni son état. */
export const REGISTER_UNAVAILABLE =
  "Impossible de créer un compte avec ces informations. Si vous avez déjà un compte, connectez-vous. Sinon, contactez la boutique.";

type RequestContext = { ip: string; userAgent?: string };

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));
export const wait = (seconds: number) => {
  const m = minutes(seconds);
  if (m < 90) return `Réessayez dans ${m} minute${m > 1 ? "s" : ""}.`;
  const h = Math.round(m / 60);
  return `Réessayez dans environ ${h} heure${h > 1 ? "s" : ""}.`;
};

/** 429 avec la durée d'attente (`Retry-After` est posé par le gestionnaire d'erreurs). */
export const tooManyAttempts = (message: string, retryAfterSeconds: number) => new AppError(429, "RATE_LIMITED", message, { retryAfterSeconds });

export function toCustomerAccount(row: Pick<Customer, "id" | "firstName" | "lastName" | "phone" | "email" | "wilayaCode" | "commune" | "address" | "mustChangePassword">): CustomerAccount {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    ...(row.email ? { email: row.email } : {}),
    wilayaCode: row.wilayaCode,
    commune: row.commune,
    address: row.address,
    mustChangePassword: row.mustChangePassword,
  };
}

/** Nettoyage opportuniste (petit lot) ; une erreur de nettoyage ne doit jamais bloquer une connexion. */
async function purgeQuietly(): Promise<void> {
  try {
    await purgeExpiredAuthData();
  } catch {
    /* le nettoyage planifié reprendra */
  }
}

/**
 * Budgets d'INSCRIPTION (seuils : voir `THROTTLE` dans config/customer-auth.ts). Une tentative consomme, du plus étroit au plus
 * large, un compteur atomique par IP/heure, IP/jour, sous-réseau/jour, global/heure, global/jour. La première limite atteinte
 * répond 429 et les suivantes ne sont pas entamées. Appelée AVANT toute vérification d'existence du numéro : le comptage est donc
 * identique pour un numéro neuf et pour un numéro déjà inscrit. Les messages ne dépendent jamais de l'état du numéro.
 */
async function enforceRegistrationLimits(ip: string): Promise<void> {
  const own = `Trop de créations de compte depuis cette connexion.`;
  const shared = `Les inscriptions sont momentanément indisponibles.`;
  const steps = [
    { cfg: THROTTLE.registerIp, key: ipLimitKey(ip), message: own, signal: false },
    { cfg: THROTTLE.registerIpDay, key: ipLimitKey(ip), message: own, signal: false },
    { cfg: THROTTLE.registerSubnetDay, key: subnetLimitKey(ip), message: shared, signal: true },
    { cfg: THROTTLE.registerGlobalHour, key: "all", message: shared, signal: true },
    { cfg: THROTTLE.registerGlobalDay, key: "all", message: shared, signal: true },
  ] as const;
  for (const step of steps) {
    const result = await consumeAttempt(step.cfg.scope, step.key, step.cfg);
    if (result.allowed) continue;
    // Signal d'un sondage possible : écrit UNE seule fois par fenêtre (le compteur atomique passe une seule fois par max + 1).
    if (step.signal && result.count === step.cfg.max + 1) {
      try {
        await recordAudit(prisma, { action: "customer.register_limit_reached", actor: { type: "system" }, ip, metadata: { limit: step.cfg.scope } });
      } catch {
        /* le signal ne doit pas changer la réponse */
      }
    }
    throw tooManyAttempts(`${step.message} ${wait(result.retryAfterSeconds)}`, result.retryAfterSeconds);
  }
}

/** Journalise une tentative d'inscription sur un numéro déjà inscrit (au mieux : sans effet sur la réponse). */
async function auditRegisterDuplicate(phoneKey: string, ip: string, known?: { id: string; isGuest: boolean } | null): Promise<void> {
  try {
    const existing = known ?? (await prisma.customer.findUnique({ where: { phoneKey }, select: { id: true, isGuest: true } }));
    await recordAudit(prisma, {
      action: "customer.register_duplicate",
      actor: { type: "system" },
      target: existing ? { type: "customer", id: existing.id } : undefined,
      ip,
      metadata: { legacy: existing?.isGuest ?? false },
    });
  } catch {
    /* voir ci-dessus */
  }
}

export async function registerCustomer(input: CustomerRegisterValues, ctx: RequestContext): Promise<{ customer: CustomerAccount; token: string; expiresAt: Date }> {
  // 1) budgets d'inscription (IP, sous-réseau, global), avant tout autre traitement : bornent le sondage des numéros déjà inscrits
  await enforceRegistrationLimits(ctx.ip);

  // 2) contrôles qui dépendent du serveur
  if (!getWilaya(input.wilayaCode)) throw validation("La wilaya choisie est invalide.");
  const phoneKey = normalizePhone(input.phone);
  if (normalizePhone(input.password) === phoneKey) throw validation("Le mot de passe ne doit pas être votre numéro de téléphone.");

  // 3) le hachage est calculé AVANT de regarder si le numéro existe : même temps de réponse dans les deux cas
  const passwordHash = await hashPassword(input.password);

  const existing = await prisma.customer.findUnique({ where: { phoneKey }, select: { id: true, isGuest: true } });
  if (existing) {
    await auditRegisterDuplicate(phoneKey, ctx.ip, existing);
    throw new AppError(409, "CONFLICT", REGISTER_UNAVAILABLE);
  }

  try {
    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          phoneKey,
          email: input.email ? input.email : null,
          wilayaCode: input.wilayaCode,
          commune: input.commune,
          address: input.address,
          isGuest: false,
          passwordHash,
          passwordChangedAt: now,
        },
      });
      const session = await createCustomerSession(tx, customer.id, ctx.userAgent, now);
      await recordAudit(tx, { action: "customer.registered", actor: { type: "customer", id: customer.id }, target: { type: "customer", id: customer.id }, ip: ctx.ip });
      return { customer, session };
    });
    await purgeQuietly();
    return { customer: toCustomerAccount(created.customer), token: created.session.token, expiresAt: created.session.expiresAt };
  } catch (error) {
    // Course entre deux inscriptions du même numéro : même réponse que le doublon détecté plus haut.
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      await auditRegisterDuplicate(phoneKey, ctx.ip);
      throw new AppError(409, "CONFLICT", REGISTER_UNAVAILABLE);
    }
    throw error;
  }
}

export async function loginCustomer(input: CustomerAccountLoginValues, ctx: RequestContext): Promise<{ customer: CustomerAccount; token: string; expiresAt: Date }> {
  // 1) limite par IP D'ABORD : une IP déjà limitée ne peut plus faire monter les compteurs par numéro (pas de verrouillage abusif)
  const ip = await consumeAttempt(THROTTLE.loginIp.scope, ctx.ip, THROTTLE.loginIp);
  if (!ip.allowed) throw tooManyAttempts(`Trop de tentatives depuis cette connexion. ${wait(ip.retryAfterSeconds)}`, ip.retryAfterSeconds);

  // 2) blocage du numéro (tenu pour tout numéro, existant ou non : le message ne révèle rien)
  const phoneKey = normalizePhone(input.phone);
  const lock = await getLock(THROTTLE.loginPhone.scope, phoneKey);
  if (lock.locked) throw tooManyAttempts(`Trop de tentatives de connexion pour ce numéro. ${wait(lock.retryAfterSeconds)}`, lock.retryAfterSeconds);

  // 3) UN SEUL calcul bcrypt, quoi qu'il arrive (compte absent, sans mot de passe, ou mot de passe démesuré → hachage factice)
  const customer = await prisma.customer.findUnique({ where: { phoneKey } });
  const tooLong = utf8ByteLength(input.password) > PASSWORD_MAX_BYTES;
  const ok = await verifyPassword(input.password, tooLong ? null : customer?.passwordHash);

  if (!customer || !ok) {
    const failure = await recordFailure(THROTTLE.loginPhone.scope, phoneKey, THROTTLE.loginPhone);
    if (failure.newlyLocked) {
      try {
        await recordAudit(prisma, {
          action: "customer.login_locked",
          actor: { type: "system" },
          target: customer ? { type: "customer", id: customer.id } : undefined,
          ip: ctx.ip,
          metadata: { accountExists: !!customer, lockMinutes: Math.round(THROTTLE.loginPhone.lockMs / 60_000) },
        });
      } catch {
        /* l'audit d'un blocage ne doit pas changer la réponse */
      }
    }
    throw unauthenticated(LOGIN_FAILED);
  }

  // 4) succès : compteur remis à zéro, session neuve
  await clearThrottle(THROTTLE.loginPhone.scope, phoneKey);
  const session = await createCustomerSession(prisma, customer.id, ctx.userAgent);
  await purgeQuietly();
  return { customer: toCustomerAccount(customer), token: session.token, expiresAt: session.expiresAt };
}

/** Exposé pour les tests : la clé HMAC d'un numéro dans `AuthThrottle`. */
export const loginPhoneThrottleKey = (phoneKey: string) => throttleKey(THROTTLE.loginPhone.scope, phoneKey);
