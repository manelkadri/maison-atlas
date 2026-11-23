/**
 * URL Google Maps construites à partir d'une adresse ou d'un Plus Code.
 * Aucune clé d'API : l'intégration par `?q=…&output=embed` et les liens `maps/search` / `maps/dir` sont publics.
 */

/** Requête de localisation : le Plus Code (plus précis) si renseigné, sinon l'adresse. */
export function getMapsQuery(settings: { plusCode?: string; address?: string }): string {
  return (settings.plusCode?.trim() || settings.address?.trim() || "").replace(/\s+/g, " ");
}

/** URL d'intégration (iframe). */
export function buildMapsEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&hl=fr&z=17&output=embed`;
}

/** Ouvre la fiche du lieu dans Google Maps. */
export function buildMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Ouvre l'itinéraire vers la boutique depuis la position de l'utilisateur. */
export function buildMapsDirectionsUrl(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}
