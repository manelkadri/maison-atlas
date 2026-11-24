import { stdSerializers } from "pino";

/**
 * Dernier filet de sécurité des journaux. Les corps de requête ne sont jamais journalisés, et les cookies / en-têtes
 * d'autorisation sont masqués par `LOG_REDACT`. Reste le cas des MESSAGES D'ERREUR : ceux de Prisma recopient parfois les
 * valeurs de la requête (ex. `passwordHash: "…"`, vérifié par un test). Ce filtre masque, dans tout texte d'erreur journalisé,
 * ce qui ressemble à un secret : hachage bcrypt, JWT, cookie de session, en-tête Bearer, empreinte SHA-256, jeton de session
 * (43 caractères base64url) et toute valeur associée à une clé nommée password/secret/token/hash.
 */
const RULES: Array<[RegExp, string]> = [
  [/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, "[bcrypt]"],
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, "[jwt]"],
  [/\b(admin_session|customer_session)=[^;\s"']+/gi, "$1=[Redacted]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [Redacted]"],
  [/\b[A-Fa-f0-9]{64}\b/g, "[sha256]"],
  [/\b[A-Za-z0-9_-]{43}\b/g, "[token]"],
  [/(["']?[\w]*(?:password|passwd|pwd|secret|token|hash)[\w]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*')/gi, '$1"[Redacted]"'],
];

export function scrubSecrets(text: string): string {
  let out = text;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out;
}

/** Applique `scrubSecrets` à toutes les chaînes d'une valeur sérialisable (profondeur bornée). */
function scrubDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubSecrets(value);
  if (depth >= 5 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrubDeep(v, depth + 1)]));
}

/** Sérialiseur d'erreur de pino + filtre des secrets (message, pile et propriétés comme `meta`). */
export const scrubbedErrSerializer = (err: unknown) => scrubDeep(stdSerializers.err(err as Error));
