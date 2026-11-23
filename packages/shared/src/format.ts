/** Formate un montant entier en DZD, ex. 12 500 DA. */
export function formatDZD(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " "); // espace fine insécable (stable SSR/CSR)
  return `${sign}${digits} DA`;
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "12 oct. 2026" — implémentation maison pour éviter les écarts Intl entre serveur et navigateur. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(iso)} · ${hh}:${mm}`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");
  return phone;
}

/** Pourcentage de réduction entre ancien et nouveau prix (entier). */
export function discountPercent(compareAt: number | undefined, price: number): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
