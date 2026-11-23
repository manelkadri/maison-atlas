/**
 * Convertit un numéro algérien saisi au format national (« 0552 82 60 75 ») ou international
 * (« +213 552 82 60 75 », « 00213… ») en chiffres internationaux sans « + » (« 213552826075 »),
 * format attendu par wa.me. Retourne null si le numéro n'est pas exploitable.
 */
export function toWhatsAppNumber(phone: string | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00213")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `213${digits.slice(1)}`;
  return /^213[5-7]\d{8}$/.test(digits) ? digits : null;
}

/** Lien de conversation WhatsApp (ouvre l'application ou WhatsApp Web), avec un message pré-rempli facultatif. */
export function buildWhatsAppUrl(phone: string | undefined, message?: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
