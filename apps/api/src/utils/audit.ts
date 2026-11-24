import type { Prisma } from "@prisma/client";
import { maskIp } from "./ip";

/**
 * Journal d'audit des opérations sensibles.
 *
 * RÈGLE ABSOLUE : aucun mot de passe (en clair ou haché), mot de passe provisoire, jeton, cookie, en-tête d'autorisation ni
 * corps de requête ne doit jamais entrer ici. Ce n'est pas laissé à la discipline : le code l'impose.
 *   1. chaque action n'accepte qu'une LISTE FERMÉE de clés de métadonnées (`ALLOWED_METADATA`) ;
 *   2. toute clé dont le nom évoque un secret est supprimée même si elle figurait dans la liste (`FORBIDDEN_KEY`) ;
 *   3. seules des valeurs simples et courtes sont conservées (texte ≤ 200 caractères, nombre, booléen, null) ;
 *   4. l'adresse IP est MASQUÉE avant l'écriture (voir `maskIp`).
 */

export type AuditAction =
  | "customer.registered"
  | "customer.register_duplicate"
  | "customer.register_limit_reached"
  | "customer.login_locked"
  | "customer.password_changed"
  | "customer.password_change_forced"
  | "admin.customer_password_reset"
  | "admin.customer_password_reset_denied";

/** Clés de métadonnées autorisées par action (liste fermée). */
export const ALLOWED_METADATA: Record<AuditAction, readonly string[]> = {
  "customer.registered": [],
  // Tentative d'inscription avec un numéro DÉJÀ inscrit (cible = le compte concerné). `legacy` : compte historique sans mot de passe.
  "customer.register_duplicate": ["legacy"],
  // Un plafond d'inscriptions vient d'être atteint (écrit UNE fois par fenêtre) : signal d'un possible sondage automatisé.
  "customer.register_limit_reached": ["limit"],
  "customer.login_locked": ["accountExists", "lockMinutes"],
  // « revokedCount » : nombre de sessions révoquées (le mot « session » est volontairement absent des noms de clés autorisées).
  "customer.password_changed": ["revokedCount"],
  "customer.password_change_forced": ["revokedCount"],
  "admin.customer_password_reset": ["revokedCount", "wasLegacy"],
  "admin.customer_password_reset_denied": ["reason"],
};

/** Noms de clés qui évoquent un secret : toujours supprimés. */
export const FORBIDDEN_KEY = /pass|pwd|secret|token|cookie|authoriz|hash|session|bearer|credential|otp/i;

type MetadataValue = string | number | boolean | null;

export function sanitizeMetadata(action: AuditAction, metadata: Record<string, unknown> | undefined): Record<string, MetadataValue> | undefined {
  if (!metadata) return undefined;
  const allowed = new Set(ALLOWED_METADATA[action] ?? []);
  const clean: Record<string, MetadataValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowed.has(key) || FORBIDDEN_KEY.test(key)) continue;
    if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) clean[key] = value;
    else if (typeof value === "string") clean[key] = value.slice(0, 200);
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export type AuditEvent = {
  action: AuditAction;
  actor: { type: "admin" | "customer" | "system"; id?: string | null };
  target?: { type: string; id?: string | null };
  /** Adresse IP brute de la requête : elle est masquée ici, jamais enregistrée telle quelle. */
  ip?: string | null;
  metadata?: Record<string, unknown>;
};

/** Écrit un événement. Accepte un client Prisma ou une transaction (pour rendre l'audit atomique avec l'opération). */
export async function recordAudit(db: Pick<Prisma.TransactionClient, "auditLog">, event: AuditEvent): Promise<void> {
  const metadata = sanitizeMetadata(event.action, event.metadata);
  await db.auditLog.create({
    data: {
      actorType: event.actor.type,
      actorId: event.actor.id ?? null,
      action: event.action,
      targetType: event.target?.type ?? null,
      targetId: event.target?.id ?? null,
      ipMasked: maskIp(event.ip),
      ...(metadata ? { metadata } : {}),
    },
  });
}
