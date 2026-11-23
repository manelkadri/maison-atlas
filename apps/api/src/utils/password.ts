import bcrypt from "bcryptjs";

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
