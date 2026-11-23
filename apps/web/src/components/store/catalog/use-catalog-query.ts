"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ProductFilters } from "@/types/product.types";
import { catalogUrl, parseCatalogParams, type CatalogQuery } from "./params";

/**
 * État du catalogue = URL. La lecture passe par `useSearchParams` ; l'écriture par l'API History native
 * (pushState/replaceState), que Next.js synchronise avec `useSearchParams` : changement de filtre instantané,
 * sans aller-retour serveur, et le bouton retour du navigateur restaure le filtre précédent.
 */
export function useCatalogQuery() {
  const searchParams = useSearchParams();
  const query = useMemo<CatalogQuery>(() => parseCatalogParams(searchParams ?? new URLSearchParams()), [searchParams]);

  const navigate = useCallback((filters: ProductFilters, page = 1, mode: "push" | "replace" = "push") => {
    const next = catalogUrl(filters, page);
    const current = catalogUrl(...readLocationQuery());
    if (next === current) return;
    if (mode === "replace") window.history.replaceState(null, "", next);
    else window.history.pushState(null, "", next);
  }, []);

  /** Modifie des filtres (retour page 1). Part de l'URL réelle : pas de perte si deux clics s'enchaînent. */
  const updateFilters = useCallback(
    (update: Partial<ProductFilters> | ((current: ProductFilters) => ProductFilters), mode: "push" | "replace" = "push") => {
      const [current] = readLocationQuery();
      const next = typeof update === "function" ? update(current) : { ...current, ...update };
      navigate(compact(next), 1, mode);
    },
    [navigate],
  );

  const setPage = useCallback(
    (page: number) => {
      const [current] = readLocationQuery();
      navigate(current, page, "push");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate],
  );

  return { ...query, updateFilters, setPage };
}

function readLocationQuery(): [ProductFilters, number] {
  const { filters, page } = parseCatalogParams(new URLSearchParams(window.location.search));
  return [filters, page];
}

/** Retire les clés vides (liste vide, chaîne vide, false) pour garder une URL propre. */
function compact(filters: ProductFilters): ProductFilters {
  const out: ProductFilters = {};
  if (filters.search?.trim()) out.search = filters.search.trim();
  if (filters.category) out.category = filters.category;
  if (filters.collection) out.collection = filters.collection;
  if (filters.sizes?.length) out.sizes = filters.sizes;
  if (filters.colors?.length) out.colors = filters.colors;
  if (filters.minPrice !== undefined) out.minPrice = filters.minPrice;
  if (filters.maxPrice !== undefined) out.maxPrice = filters.maxPrice;
  if (filters.inStockOnly) out.inStockOnly = true;
  if (filters.sort) out.sort = filters.sort;
  return out;
}
