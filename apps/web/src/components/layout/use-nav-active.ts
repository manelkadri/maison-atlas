"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { isNavItemActive } from "./nav-utils";

/**
 * Retourne une fonction `(href) => boolean` indiquant si un lien est actif pour l'URL courante.
 * Utilise `useSearchParams` : le composant appelant doit être entouré d'un <Suspense>.
 */
export function useNavActive(): (href: string) => boolean {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (href) => isNavItemActive(href, pathname ?? "/", searchParams);
}
