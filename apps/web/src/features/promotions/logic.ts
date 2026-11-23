import { formatDZD } from "@fashion/shared";
import type { Promotion } from "@/types/promotion.types";

export type PromotionStatus = "active" | "scheduled" | "expired" | "inactive";

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  active: "Active",
  scheduled: "Programmée",
  expired: "Expirée",
  inactive: "Inactive",
};

/**
 * Statut calculé. Même ordre de priorité que `validatePromotion` (ce que voit le client) :
 * désactivée à la main → inactive ; puis pas encore commencée → programmée ; puis terminée → expirée.
 */
export function getPromotionStatus(
  promo: Pick<Promotion, "isActive" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): PromotionStatus {
  if (!promo.isActive) return "inactive";
  if (now < new Date(promo.startsAt)) return "scheduled";
  if (now > new Date(promo.endsAt)) return "expired";
  return "active";
}

export function formatPromotionValue(promo: Pick<Promotion, "type" | "value">): string {
  return promo.type === "percentage" ? `${promo.value} %` : formatDZD(promo.value);
}

export type PromotionStatusFilter = PromotionStatus | "all";

export function filterPromotions(promos: Promotion[], opts: { search?: string; status?: PromotionStatusFilter }, now: Date = new Date()): Promotion[] {
  const q = opts.search?.trim().toLowerCase();
  return promos.filter((p) => {
    if (opts.status && opts.status !== "all" && getPromotionStatus(p, now) !== opts.status) return false;
    return !q || `${p.code} ${p.label}`.toLowerCase().includes(q);
  });
}

/** ISO → "YYYY-MM-DD" local pour un <input type="date">. */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Début de période : 00:00 locale du jour choisi. */
export function startDateToIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

/** Fin de période : 23:59:59 locale du jour choisi (le dernier jour reste valable toute la journée). */
export function endDateToIso(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString();
}
