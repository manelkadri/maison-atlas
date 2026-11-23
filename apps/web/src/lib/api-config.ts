/**
 * Configuration de la source de données.
 *
 * `NEXT_PUBLIC_DATA_SOURCE` vaut "mock" (défaut, phase 1 : données locales) ou "api" (serveur réel).
 * La variable est lue À L'APPEL (et non à l'import) : Next.js la remplace par sa valeur à la compilation
 * côté navigateur, et les tests peuvent la modifier avec `vi.stubEnv`.
 */
export function isApiMode(): boolean {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "api";
}

const DEFAULT_API_INTERNAL_URL = "http://localhost:4000";

/** Origine du serveur API vue PAR le serveur Next (rendu serveur, réécritures). Sans barre finale. */
export function getApiInternalUrl(): string {
  const raw = process.env.API_INTERNAL_URL?.trim() || DEFAULT_API_INTERNAL_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * Préfixe des appels à l'API :
 * - navigateur : `/api` (même origine, réécrit par Next vers le serveur : pas de CORS, cookie de session joint) ;
 * - serveur Next : URL interne complète du serveur API.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") return "/api";
  return `${getApiInternalUrl()}/api`;
}
