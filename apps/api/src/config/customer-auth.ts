/**
 * Paramètres de l'authentification des clientes. Constantes volontairement en dur : les modifier est une décision de
 * sécurité (voir le document de conception), pas un réglage de déploiement.
 */

/** Nom du cookie de session cliente. Distinct de `admin_session` : aucune route ne lit l'autre cookie. */
export const CUSTOMER_SESSION_COOKIE = "customer_session";

/** Durée ABSOLUE d'une session (pas de prolongation automatique). */
export const CUSTOMER_SESSION_DAYS = 30;
export const CUSTOMER_SESSION_MS = CUSTOMER_SESSION_DAYS * 24 * 3600 * 1000;
/** Nombre maximal de sessions actives par cliente : la plus ancienne est supprimée au-delà. */
export const MAX_SESSIONS_PER_CUSTOMER = 10;
/** La date de dernière utilisation n'est réécrite qu'au plus une fois par heure (pas d'écriture à chaque requête). */
export const SESSION_TOUCH_INTERVAL_MS = 3600 * 1000;

const MINUTE = 60_000;

/**
 * Limites de tentatives. Deux niveaux, vérifiés dans cet ordre :
 *   1. par IP (large : beaucoup d'abonnés mobiles partagent la même adresse en Algérie) — contrôlé AVANT tout compteur par
 *      numéro, pour qu'une IP déjà limitée ne puisse plus provoquer de verrouillage de comptes ;
 *   2. par numéro (le vrai garde-fou), tenu pour TOUT numéro, qu'il ait un compte ou non (réponses identiques).
 */
export const THROTTLE = {
  loginIp: { scope: "login-ip", max: 30, windowMs: 15 * MINUTE },
  loginPhone: { scope: "login-phone", maxFailures: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE },
  registerIp: { scope: "register-ip", max: 10, windowMs: 60 * MINUTE },
  /** Changement de mot de passe : échecs du mot de passe ACTUEL, par cliente (un vol de session ne doit pas permettre de le deviner). */
  passwordChange: { scope: "password-change", maxFailures: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE },
  /** Ré-authentification de l'administrateur avant une réinitialisation : échecs de SON mot de passe, par administrateur. */
  adminStepUp: { scope: "admin-stepup", maxFailures: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE },
  /** Nombre de réinitialisations de mot de passe de clientes par administrateur et par heure (borne les dégâts d'une session volée). */
  adminReset: { scope: "admin-reset", max: 10, windowMs: 60 * MINUTE },
} as const;

/** Durée de conservation du journal d'audit (valeur par défaut à valider avec ton conseil juridique : données personnelles). */
export const AUDIT_RETENTION_DAYS = 365;

/** Les compteurs inactifs depuis plus de 24 h sont purgés. */
export const THROTTLE_RETENTION_MS = 24 * 3600 * 1000;
