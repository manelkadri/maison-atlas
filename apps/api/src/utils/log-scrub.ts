import { stdSerializers } from "pino";
import { maskIp } from "./ip";

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

/**
 * Sérialiseur d'erreur + filtre des secrets (message, pile et propriétés comme `meta`).
 * pino-http ENVELOPPE lui-même les sérialiseurs `req`, `res` et `err` (il leur transmet l'objet déjà sérialisé par pino) : ceux-ci
 * sont donc de simples fonctions. Utilisé seul avec pino, le sérialiseur reçoit l'erreur brute : on gère les deux cas.
 */
export const scrubbedErrSerializer = (err: unknown) => scrubDeep(err instanceof Error ? stdSerializers.err(err) : err);

/* ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Journaux HTTP : adresses, paramètres et en-têtes en LISTE BLANCHE (« refuser par défaut »).
 *
 * Constat qui a motivé ce choix : la configuration précédente ne masquait que le cookie et l'en-tête Authorization, alors que
 * chaque ligne de journal de production contenait aussi la signature du proxy Vercel (`x-vercel-proxy-signature`, `forwarded; sig=`),
 * l'adresse IP complète et la localisation (ville, code postal, coordonnées), et les paramètres d'URL tels quels (téléphone du suivi
 * public, recherches de l'administration). Plutôt que d'allonger une liste de choses à cacher, on ne conserve que ce qui est connu comme
 * sans risque ; tout le reste est supprimé (en-têtes) ou remplacé par [Redacted] (valeurs).
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */

const REDACTED = "[Redacted]";

/** Paramètres d'URL dont la valeur est sans risque (pagination, tri, filtres de catalogue). Tout autre paramètre est masqué. */
export const SAFE_QUERY_KEYS: ReadonlySet<string> = new Set([
  "page", "pageSize", "limit", "sort", "status", "deliveryMethod", "collection", "category", "includeArchived", "period",
  "minPrice", "maxPrice", "minTotal", "maxTotal", "dateFrom", "dateTo", "type", "kind", "stock", "color", "size", "productId", "variantId",
]);
/** Paramètres de chemin sans risque (identifiants opaques et slugs). Les autres — numéro de commande, téléphone, e-mail… — sont masqués. */
export const SAFE_PARAM_KEYS: ReadonlySet<string> = new Set(["id", "slug"]);

const ORDER_NUMBER = /^CMD-\d{4}-\d{6}$/i;
const PHONE_SEGMENT = /^(?:\+|00)?(?:213)?0?[5-7]\d{8}$/;

const short = (value: string) => (value.length > 80 ? `${value.slice(0, 80)}…` : value);

/** Masque un segment de chemin qui est un numéro de commande ou un téléphone. */
export function sanitizePathSegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    /* segment non décodable : on garde tel quel pour la vérification */
  }
  const compact = decoded.replace(/[\s.-]/g, "");
  if (ORDER_NUMBER.test(decoded) || PHONE_SEGMENT.test(compact)) return REDACTED;
  return segment;
}

export function sanitizeQuery(query: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!query || typeof query !== "object") return out;
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    out[key] = SAFE_QUERY_KEYS.has(key) ? short(Array.isArray(value) ? value.join(",") : String(value)) : REDACTED;
  }
  return out;
}

export function sanitizeParams(params: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!params || typeof params !== "object") return out;
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) out[key] = SAFE_PARAM_KEYS.has(key) ? short(String(value)) : REDACTED;
  return out;
}

/** URL journalisée : chemin sans numéro de commande ni téléphone, paramètres de requête conservés seulement s'ils sont sûrs. */
export function sanitizeUrl(url: string | undefined): string {
  if (!url) return "";
  const [path = "", queryString] = url.split("?", 2) as [string, string | undefined];
  const cleanPath = path.split("/").map(sanitizePathSegment).join("/");
  if (queryString === undefined) return cleanPath;
  const parts = queryString
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const [key = "", value = ""] = pair.split("=", 2) as [string, string | undefined];
      let name = key;
      try {
        name = decodeURIComponent(key);
      } catch {
        /* clé non décodable */
      }
      return `${key}=${SAFE_QUERY_KEYS.has(name) ? short(value ?? "") : encodeURIComponent(REDACTED)}`;
    });
  return parts.length ? `${cleanPath}?${parts.join("&")}` : cleanPath;
}

const REQUEST_HEADERS = new Set([
  "host", "user-agent", "accept", "accept-language", "accept-encoding", "content-type", "content-length", "origin",
  "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "x-forwarded-proto", "x-forwarded-host",
]);
const RESPONSE_HEADERS = new Set(["content-type", "content-length", "cache-control", "retry-after", "content-encoding", "vary"]);

function allowlist(headers: unknown, allowed: ReadonlySet<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!headers || typeof headers !== "object") return out;
  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) if (allowed.has(name.toLowerCase())) out[name.toLowerCase()] = value;
  return out;
}

type SerializedReq = { id?: unknown; method?: string; url?: string; query?: unknown; params?: unknown; headers?: Record<string, unknown>; remoteAddress?: string };

/**
 * Requête journalisée (reçoit la requête déjà sérialisée par pino-http). L'adresse du client n'y figure que MASQUÉE (IPv4 /24,
 * IPv6 /48) : ni IP complète, ni signature du proxy, ni localisation, ni cookie, ni autorisation. Aucun corps n'est jamais journalisé.
 */
export const requestSerializer = (req: SerializedReq) => {
  const forwarded = String(req.headers?.["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    id: req.id,
    method: req.method,
    url: sanitizeUrl(req.url),
    query: sanitizeQuery(req.query),
    params: sanitizeParams(req.params),
    headers: allowlist(req.headers, REQUEST_HEADERS),
    ipMasked: maskIp(forwarded.at(-1) ?? req.remoteAddress),
  };
};

/** Réponse journalisée : code HTTP et quelques en-têtes sans risque. `set-cookie` n'est JAMAIS journalisé (ni même masqué : absent). */
export const responseSerializer = (res: { statusCode?: number | null; headers?: Record<string, unknown> }) => ({
  statusCode: res.statusCode,
  headers: allowlist(res.headers, RESPONSE_HEADERS),
});
