import type { NewsletterService } from "./contracts";

export const NEWSLETTER_STORAGE_KEY = "fashion-newsletter-demo";

/**
 * SIMULATION LOCALE (mode mock) : aucun appel réseau. L'adresse est simplement ajoutée à une liste
 * dans le localStorage du navigateur.
 */
export function saveNewsletterEmail(email: string): void {
  try {
    const raw = window.localStorage.getItem(NEWSLETTER_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    const normalized = email.trim().toLowerCase();
    if (!list.includes(normalized)) list.push(normalized);
    window.localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la simulation reste silencieuse.
  }
}

export const newsletterService: NewsletterService = {
  async subscribe(email) {
    saveNewsletterEmail(email);
  },
};
