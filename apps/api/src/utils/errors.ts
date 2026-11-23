export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "INTERNAL";

/**
 * Erreur métier. Les codes sont IDENTIQUES à ceux de `ServiceError` côté interface
 * (apps/web/src/services/errors.ts) : le client API les retraduit à l'identique.
 * Corps de réponse : { error: { code, message, details? } }.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (message = "Ressource introuvable.") => new AppError(404, "NOT_FOUND", message);
export const validation = (message: string, details?: unknown) => new AppError(400, "VALIDATION", message, details);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);
export const outOfStock = (message: string) => new AppError(409, "OUT_OF_STOCK", message);
export const invalidTransition = (message: string) => new AppError(409, "INVALID_TRANSITION", message);
export const unauthenticated = (message = "Authentification requise.") => new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "Accès refusé.") => new AppError(403, "FORBIDDEN", message);
export const notConfigured = (message: string) => new AppError(501, "NOT_CONFIGURED", message);
