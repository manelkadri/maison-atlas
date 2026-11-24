import { PASSWORD_MAX_BYTES, utf8ByteLength, type CustomerChangePasswordValues, type CustomerProfileUpdateValues } from "@fashion/validators";
import { getWilaya, normalizePhone } from "@fashion/shared";
import type { CustomerAccount } from "@fashion/types";
import { prisma } from "../../config/db";
import { THROTTLE } from "../../config/customer-auth";
import { recordAudit } from "../../utils/audit";
import { createCustomerSession, revokeAllCustomerSessions } from "../../utils/customer-session";
import { forbidden, notFound, unauthenticated, validation } from "../../utils/errors";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "../../utils/password";
import { clearThrottle, consumeAttempt, getLock, recordFailure } from "../../utils/throttle";
import { tooManyAttempts, toCustomerAccount, wait } from "./account";

/**
 * Gestion du compte : profil, changement de mot de passe, réinitialisation par l'administrateur.
 *
 * ISOLATION : chaque fonction reçoit l'identité de la cliente depuis la SESSION (middleware `requireCustomer`) et n'accepte
 * aucun identifiant de cliente venant du navigateur. Les écritures ciblent `id = <cliente de la session>` et rien d'autre.
 */

type RequestContext = { ip: string; userAgent?: string };

export const WRONG_CURRENT_PASSWORD = "Le mot de passe actuel est incorrect.";
export const WRONG_ADMIN_PASSWORD = "Mot de passe administrateur incorrect.";

/* ───────── Profil ───────── */

/** Met à jour les SEULS champs autorisés du profil de la cliente connectée (jamais le téléphone, ni le mot de passe). */
export async function updateOwnProfile(customerId: string, input: CustomerProfileUpdateValues): Promise<CustomerAccount> {
  if (input.wilayaCode !== undefined && !getWilaya(input.wilayaCode)) throw validation("La wilaya choisie est invalide.");
  const row = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email === "" ? null : input.email } : {}),
      ...(input.wilayaCode !== undefined ? { wilayaCode: input.wilayaCode } : {}),
      ...(input.commune !== undefined ? { commune: input.commune } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    },
  });
  return toCustomerAccount(row);
}

/* ───────── Changement de mot de passe ───────── */

/**
 * Change le mot de passe après vérification de l'ANCIEN (avec limitation des essais : un vol de session ne doit pas permettre
 * de deviner le mot de passe actuel). TOUTES les sessions existantes sont révoquées — y compris celle utilisée pour la requête —
 * et une session NEUVE est ouverte : la cliente reste connectée, mais aucun ancien jeton ne fonctionne plus.
 */
export async function changeOwnPassword(
  auth: { customerId: string },
  input: CustomerChangePasswordValues,
  ctx: RequestContext,
): Promise<{ customer: CustomerAccount; token: string; expiresAt: Date; revokedCount: number }> {
  const lock = await getLock(THROTTLE.passwordChange.scope, auth.customerId);
  if (lock.locked) throw tooManyAttempts(`Trop de tentatives de changement de mot de passe. ${wait(lock.retryAfterSeconds)}`, lock.retryAfterSeconds);

  const customer = await prisma.customer.findUnique({ where: { id: auth.customerId } });
  if (!customer) throw unauthenticated();

  const tooLong = utf8ByteLength(input.currentPassword) > PASSWORD_MAX_BYTES;
  const ok = await verifyPassword(input.currentPassword, tooLong ? null : customer.passwordHash);
  if (!ok) {
    await recordFailure(THROTTLE.passwordChange.scope, auth.customerId, THROTTLE.passwordChange);
    // 403 (et non 401) : le site traite un 401 comme une session expirée et redirigerait au lieu d'afficher l'erreur.
    throw forbidden(WRONG_CURRENT_PASSWORD);
  }
  if (normalizePhone(input.newPassword) === customer.phoneKey) throw validation("Le mot de passe ne doit pas être votre numéro de téléphone.");

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();
  const wasForced = customer.mustChangePassword;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({ where: { id: customer.id }, data: { passwordHash, passwordChangedAt: now, mustChangePassword: false, isGuest: false } });
    const revokedCount = await revokeAllCustomerSessions(tx, customer.id);
    const session = await createCustomerSession(tx, customer.id, ctx.userAgent, now);
    await recordAudit(tx, {
      action: wasForced ? "customer.password_change_forced" : "customer.password_changed",
      actor: { type: "customer", id: customer.id },
      target: { type: "customer", id: customer.id },
      ip: ctx.ip,
      metadata: { revokedCount },
    });
    return { updated, session, revokedCount };
  });
  await clearThrottle(THROTTLE.passwordChange.scope, auth.customerId);
  return { customer: toCustomerAccount(result.updated), token: result.session.token, expiresAt: result.session.expiresAt, revokedCount: result.revokedCount };
}

/* ───────── Réinitialisation par l'administrateur ───────── */

/** Journalise un refus (au mieux : une panne d'audit ne doit pas changer la réponse faite à l'administrateur). */
async function auditDenied(adminId: string, customerId: string, reason: string, ip: string): Promise<void> {
  try {
    await recordAudit(prisma, {
      action: "admin.customer_password_reset_denied",
      actor: { type: "admin", id: adminId },
      target: { type: "customer", id: customerId.slice(0, 64) },
      ip,
      metadata: { reason },
    });
  } catch {
    /* voir ci-dessus */
  }
}

/**
 * Réinitialise le mot de passe d'une cliente et renvoie un mot de passe PROVISOIRE (affiché une seule fois par le site).
 *
 * Permissions (dans cet ordre, chaque refus est journalisé) :
 *   1. session admin valide — déjà garantie par `requireAdmin` + contrôle de l'origine ;
 *   2. limite : 10 réinitialisations par heure et par administrateur ;
 *   3. RÉ-AUTHENTIFICATION : l'administrateur ressaisit SON mot de passe (échecs limités, blocage temporaire) — sans cela,
 *      une session admin volée suffirait à prendre n'importe quel compte cliente ;
 *   4. la cliente doit exister (vérifié APRÈS la ré-authentification : on ne sonde pas les identifiants sans être authentifié).
 * L'opération est ATOMIQUE : nouveau hachage, changement obligatoire, révocation de TOUTES les sessions et écriture du journal
 * forment une seule transaction — si le journal ne peut pas être écrit, la réinitialisation est annulée.
 */
export async function resetCustomerPasswordByAdmin(args: { adminId: string; customerId: string; adminPassword: string; ip: string }): Promise<{ temporaryPassword: string; customerId: string }> {
  const { adminId, customerId, adminPassword, ip } = args;

  const budget = await consumeAttempt(THROTTLE.adminReset.scope, adminId, THROTTLE.adminReset);
  if (!budget.allowed) {
    await auditDenied(adminId, customerId, "rate_limited", ip);
    throw tooManyAttempts(`Trop de réinitialisations de mot de passe. ${wait(budget.retryAfterSeconds)}`, budget.retryAfterSeconds);
  }

  const lock = await getLock(THROTTLE.adminStepUp.scope, adminId);
  if (lock.locked) {
    await auditDenied(adminId, customerId, "stepup_locked", ip);
    throw tooManyAttempts(`Trop d'échecs de confirmation. ${wait(lock.retryAfterSeconds)}`, lock.retryAfterSeconds);
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw unauthenticated();
  if (!(await verifyPassword(adminPassword, admin.passwordHash))) {
    await recordFailure(THROTTLE.adminStepUp.scope, adminId, THROTTLE.adminStepUp);
    await auditDenied(adminId, customerId, "bad_admin_password", ip);
    throw forbidden(WRONG_ADMIN_PASSWORD); // 403 : le site ne doit pas y voir une session expirée
  }
  await clearThrottle(THROTTLE.adminStepUp.scope, adminId);

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    await auditDenied(adminId, customerId, "not_found", ip);
    throw notFound("Cliente introuvable.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  // Une seule transaction : si le journal ne peut pas être écrit, TOUT est annulé (rien n'est réinitialisé sans trace).
  // L'erreur éventuelle remonte au gestionnaire d'erreurs (500 générique, message filtré des secrets dans les journaux).
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customer.id },
      data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date(), isGuest: false },
    });
    const revokedCount = await revokeAllCustomerSessions(tx, customer.id);
    await recordAudit(tx, {
      action: "admin.customer_password_reset",
      actor: { type: "admin", id: adminId },
      target: { type: "customer", id: customer.id },
      ip,
      metadata: { revokedCount, wasLegacy: customer.passwordHash === null },
    });
  });
  // Les blocages de connexion et de changement de mot de passe de cette cliente sont levés : elle doit pouvoir se connecter.
  await clearThrottle(THROTTLE.loginPhone.scope, customer.phoneKey);
  await clearThrottle(THROTTLE.passwordChange.scope, customer.id);
  return { temporaryPassword, customerId: customer.id };
}
