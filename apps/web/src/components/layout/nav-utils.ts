/** Lecture minimale d'un objet `URLSearchParams` (compatible `ReadonlyURLSearchParams`). */
export type SearchParamsLike = { get(name: string): string | null };

/**
 * Détermine si un lien de navigation est "actif" pour l'URL courante.
 *
 * - "/" n'est actif que sur l'accueil.
 * - Un lien avec paramètres (ex. `/shop?category=femme`) est actif si le chemin correspond ET
 *   si tous ses paramètres sont présents avec la même valeur dans l'URL courante.
 * - Un lien sans paramètre (ex. `/shop`) est actif sur le chemin, sauf si l'URL courante
 *   porte déjà un filtre `category` / `collection` (sinon "Boutique" serait actif en même temps que "Femme").
 */
export function isNavItemActive(href: string, pathname: string, searchParams: SearchParamsLike): boolean {
  const [path = "/", query = ""] = href.split("?");
  if (path === "/") return pathname === "/";
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;

  const params = new URLSearchParams(query);
  const required = Array.from(params.entries());
  if (required.length > 0) {
    return required.every(([key, value]) => searchParams.get(key) === value);
  }
  return !searchParams.get("category") && !searchParams.get("collection");
}

/** Texte d'accessibilité d'un compteur d'icône (ex. "Panier, 3 articles"). */
export function countLabel(base: string, count: number, singular: string, plural: string): string {
  if (count <= 0) return base;
  return `${base}, ${count} ${count > 1 ? plural : singular}`;
}

/** Affichage compact d'un compteur (99+). */
export function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
