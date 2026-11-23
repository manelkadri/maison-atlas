import { ServiceError, isServiceErrorCode, type ServiceErrorCode } from "@/services/errors";
import { useAdminSessionStore } from "@/stores/admin-session.store";
import { getApiBaseUrl } from "./api-config";

type QueryScalar = string | number | boolean;
export type ApiQueryValue = QueryScalar | readonly QueryScalar[] | null | undefined;
export type ApiQuery = Record<string, ApiQueryValue>;

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Corps JSON, ou `FormData` pour un envoi multipart (le `Content-Type` est alors posé par le navigateur). */
  body?: unknown;
  query?: ApiQuery;
  signal?: AbortSignal;
};

const NETWORK_MESSAGE = "Le serveur est injoignable. Vérifiez votre connexion internet puis réessayez dans un instant.";
const GENERIC_MESSAGE = "Une erreur est survenue côté serveur. Veuillez réessayer.";

/**
 * Sérialise la query-string : les valeurs vides sont omises, les tableaux deviennent des listes séparées par
 * des virgules (`sizes=S,M`), les booléens valent `true`/`false`.
 */
export function buildQueryString(query?: ApiQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
      continue;
    }
    const text = String(value);
    if (text === "") continue;
    params.set(key, text);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/** Code d'erreur de repli quand le corps de la réponse n'est pas au format `{ error: { code, message } }`. */
function codeFromStatus(status: number): ServiceErrorCode {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 400 || status === 413 || status === 422) return "VALIDATION";
  if (status === 429) return "RATE_LIMITED";
  if (status === 501) return "NOT_CONFIGURED";
  return "INTERNAL";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toServiceError(status: number, payload: unknown): ServiceError {
  const fromBody = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
  const bodyCode = fromBody?.code;
  const bodyMessage = typeof fromBody?.message === "string" && fromBody.message.trim() ? fromBody.message : undefined;
  const code = isServiceErrorCode(bodyCode) ? bodyCode : codeFromStatus(status);
  if (bodyMessage) return new ServiceError(code, bodyMessage);
  // Passerelle (réécriture Next) sans réponse du serveur API.
  if (status === 502 || status === 503 || status === 504) return new ServiceError("INTERNAL", NETWORK_MESSAGE);
  return new ServiceError(code, GENERIC_MESSAGE);
}

/* ───────── Session expirée sur une route admin ───────── */

let unauthenticatedHandled = false;

const ADMIN_LOGIN_PATH = "/admin/login";

function defaultUnauthenticatedHandler(): void {
  useAdminSessionStore.getState().logout();
  if (window.location.pathname.startsWith(ADMIN_LOGIN_PATH)) return;
  // Navigation complète voulue : elle réinitialise aussi tout l'état en mémoire (cache, données admin).
  window.location.replace(ADMIN_LOGIN_PATH);
}

let unauthenticatedHandler: () => void = defaultUnauthenticatedHandler;

/** Remplace le comportement « session admin expirée » (tests). Sans argument : comportement par défaut. */
export function setUnauthenticatedHandler(handler?: () => void): void {
  unauthenticatedHandler = handler ?? defaultUnauthenticatedHandler;
  unauthenticatedHandled = false;
}

/** Réarme la protection « une seule redirection » (tests). */
export function resetUnauthenticatedGuard(): void {
  unauthenticatedHandled = false;
}

function handleAdminUnauthenticated(): void {
  if (typeof window === "undefined" || unauthenticatedHandled) return;
  unauthenticatedHandled = true; // plusieurs requêtes en parallèle : une seule redirection, jamais de boucle
  unauthenticatedHandler();
}

/**
 * Appel JSON de l'API. `path` est relatif à `/api` (ex. `/products/catalog`).
 * Les erreurs sont toujours des `ServiceError` (même code que celui du serveur) ; un serveur injoignable
 * devient `ServiceError("INTERNAL", …)`.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal } = options;
  const isServer = typeof window === "undefined";
  const url = `${getApiBaseUrl()}${path}${buildQueryString(query)}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // Content-Type multipart + boundary posés par le navigateur
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: payload,
      credentials: "same-origin",
      signal,
      ...(isServer ? { cache: "no-store" as const } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ServiceError("INTERNAL", NETWORK_MESSAGE);
  }

  if (response.status === 204) return undefined as T;

  const data = await readJson(response);
  if (!response.ok) {
    const error = toServiceError(response.status, data);
    if (error.code === "UNAUTHENTICATED" && path.startsWith("/admin")) handleAdminUnauthenticated();
    throw error;
  }
  if (data === undefined) throw new ServiceError("INTERNAL", GENERIC_MESSAGE);
  return data as T;
}

/** Comme `apiFetch`, mais renvoie `null` quand la ressource n'existe pas (404). */
export async function apiFetchOrNull<T>(path: string, options?: ApiRequestOptions): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}
