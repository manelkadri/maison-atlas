import { utf8ByteLength, PASSWORD_MAX_BYTES, type CustomerAccountLoginValues, type CustomerRegisterValues } from "@fashion/validators";
import { getWilaya, normalizePhone } from "@fashion/shared";
import type { CustomerAccount } from "@fashion/types";
import type { Customer } from "@prisma/client";
import { prisma } from "../../config/db";
import { THROTTLE } from "../../config/customer-auth";
import { AppError, unauthenticated, validation } from "../../utils/errors";
import { recordAudit } from "../../utils/audit";
import { createCustomerSession } from "../../utils/customer-session";
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
export const wait = (seconds: number) => `Réessayez dans ${minutes(seconds)} minute${minutes(seconds) > 1 ? "s" : ""}.`;

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

export async function registerCustomer(input: CustomerRegisterValues, ctx: RequestContext): Promise<{ customer: CustomerAccount; token: string; expiresAt: Date }> {
  // 1) limite par IP, avant tout autre traitement (borne aussi le sondage des numéros déjà inscrits)
  const ip = await consumeAttempt(THROTTLE.registerIp.scope, ctx.ip, THROTTLE.registerIp);
  if (!ip.allowed) throw tooManyAttempts(`Trop de créations de compte depuis cette connexion. ${wait(ip.retryAfterSeconds)}`, ip.retryAfterSeconds);

  // 2) contrôles qui dépendent du serveur
  if (!getWilaya(input.wilayaCode)) throw validation("La wilaya choisie est invalide.");
  const phoneKey = normalizePhone(input.phone);
  if (normalizePhone(input.password) === phoneKey) throw validation("Le mot de passe ne doit pas être votre numéro de téléphone.");

  // 3) le hachage est calculé AVANT de regarder si le numéro existe : même temps de réponse dans les deux cas
  const passwordHash = await hashPassword(input.password);

  const existing = await prisma.customer.findUnique({ where: { phoneKey }, select: { id: true } });
  if (existing) throw new AppError(409, "CONFLICT", REGISTER_UNAVAILABLE);

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
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") throw new AppError(409, "CONFLICT", REGISTER_UNAVAILABLE);
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
