/**
 * Normalisation d'un numéro de téléphone algérien : chiffres uniquement, préfixe 213 / 00213 → 0.
 *   « +213 555 12 34 56 », « 00213555123456 », « 0555 12 34 56 » → « 0555123456 ».
 *
 * UNIQUE implémentation (API, site et mode démonstration). Elle sert de clé d'unicité d'un client
 * (`Customer.phoneKey`, index unique en base) et de comparaison pour le suivi de commande.
 *
 * ATTENTION : elle est reproduite à l'identique en SQL pour la recherche admin par téléphone
 * (`idsMatchingText` dans apps/api/src/modules/orders/service.ts) — toute modification doit être répercutée là-bas.
 * Elle est faite pour des numéros DÉJÀ validés par `algerianPhoneRegex` (@fashion/validators) ; le comportement
 * sur d'autres chaînes est conservé tel quel (deux remplacements successifs) pour rester compatible avec les
 * `phoneKey` déjà enregistrés.
 */
export const normalizePhone = (phone: string): string => phone.replace(/\D/g, "").replace(/^213/, "0").replace(/^00213/, "0");
