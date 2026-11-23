/**
 * Normalisation d'un numéro de téléphone algérien : chiffres uniquement, préfixe 213 / 00213 → 0.
 * IDENTIQUE à `normalizePhone` de l'interface (apps/web/src/services/orders.service.ts) : sert de clé
 * d'unicité d'un client (`Customer.phoneKey`) et de comparaison pour le suivi de commande.
 */
export const normalizePhone = (phone: string): string => phone.replace(/\D/g, "").replace(/^213/, "0").replace(/^00213/, "0");
