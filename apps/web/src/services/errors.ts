export type ServiceErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "INVALID_TRANSITION"
  | "FORBIDDEN"
  /** Le mot de passe provisoire (réinitialisation par l'administrateur) doit d'abord être changé. */
  | "PASSWORD_CHANGE_REQUIRED"
  // Codes ajoutés avec l'API réelle (voir docs/API_CONTRACT.md).
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "INTERNAL";

/** Liste des codes connus (sert à valider le code renvoyé par le serveur). */
export const SERVICE_ERROR_CODES: readonly ServiceErrorCode[] = [
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "OUT_OF_STOCK",
  "INVALID_TRANSITION",
  "FORBIDDEN",
  "PASSWORD_CHANGE_REQUIRED",
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "NOT_CONFIGURED",
  "INTERNAL",
];

export function isServiceErrorCode(value: unknown): value is ServiceErrorCode {
  return typeof value === "string" && (SERVICE_ERROR_CODES as readonly string[]).includes(value);
}

/** Erreur métier remontée par la couche de services (mock ou API). */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function getErrorMessage(error: unknown, fallback = "Une erreur est survenue. Veuillez réessayer."): string {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
