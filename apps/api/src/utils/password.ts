import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

/** Coût bcrypt des mots de passe du propriétaire (contrat : ≥ 12). */
export const BCRYPT_COST = 12;
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

/**
 * Hash factice (coût 12, issu d'une chaîne aléatoire jetée) comparé quand l'e-mail est inconnu :
 * le temps de réponse est ainsi le même qu'un vrai compte, ce qui empêche d'énumérer les e-mails par chronométrage.
 */
const DUMMY_HASH = "$2b$12$8KgFSpZVzkOWVfG5UnWpeeLmucfLMDH1IdFp5tU3hhHlF5pC93nRO";

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, BCRYPT_COST);

/** Compare à temps constant ; `hash` absent (compte inconnu) ⇒ comparaison avec le hash factice puis refus. */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash ? ok : false;
}

/** Retourne un message d'erreur si le mot de passe du propriétaire est trop faible, sinon null. */
export function validateAdminPassword(password: string): string | null {
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `Le mot de passe administrateur doit contenir au moins ${MIN_ADMIN_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}

/**
 * Mot de passe PROVISOIRE (réinitialisation par l'administrateur) : 12 caractères tirés avec un générateur cryptographique
 * (`crypto.randomInt`, sans biais), sans caractères ambigus à la lecture ou à la dictée (pas de 0/O, 1/l/I).
 * 56 symboles ^ 12 ≈ 70 bits d'entropie. Il n'est JAMAIS stocké en clair ni journalisé : on n'enregistre que son hachage bcrypt.
 */
export const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const TEMPORARY_PASSWORD_LENGTH = 12;

export function generateTemporaryPassword(): string {
  let out = "";
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i += 1) out += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  return out;
}
