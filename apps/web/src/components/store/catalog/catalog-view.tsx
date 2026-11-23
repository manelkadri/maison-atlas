"use client";

import { AlertTriangle, SearchX, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProductCard, ProductCardSkeleton } from "@/components/store/product-card";
import { siteConfig } from "@/config/site";
import { useCategories } from "@/features/categories/hooks";
import { useProducts, useSearchProducts } from "@/features/products/hooks";
import { cn } from "@/lib/utils";
import type { Category, PaginatedResult, Product, ProductFilters, ProductSort } from "@/types/product.types";
import { ActiveFilters } from "./active-filters";
import { CatalogPagination } from "./catalog-pagination";
import { CatalogSearch } from "./catalog-search";
import { buildCategoryTree, buildFacets } from "./facets";
import { FilterPanel } from "./filter-panel";
import { countActiveFilters, DEFAULT_SORT, getCatalogTitle, resetFilters, serializeCatalogParams, SORT_OPTIONS } from "./params";
import { useCatalogQuery } from "./use-catalog-query";

type CatalogViewProps = {
  /** Résultat calculé côté serveur pour `initialKey` (rendu initial / SEO). */
  initialResult?: PaginatedResult<Product>;
  /** Clé (`serializeCatalogParams`) pour laquelle `initialResult` est valable. */
  initialKey?: string;
  initialProducts?: Product[];
  initialCategories?: Category[];
};

const GRID = "grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4";

export function CatalogView({ initialResult, initialKey, initialProducts, initialCategories }: CatalogViewProps) {
  const { filters, page, updateFilters, setPage } = useCatalogQuery();
  const [sheetOpen, setSheetOpen] = useState(false);

  const key = serializeCatalogParams(filters, page);
  const search = useSearchProducts(filters, page, siteConfig.pageSize, key === initialKey ? initialResult : undefined);
  const productsQuery = useProducts({ onlyPublic: true }, initialProducts);
  const categoriesQuery = useCategories(false, initialCategories);

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const facets = useMemo(() => buildFacets(productsQuery.data ?? []), [productsQuery.data]);
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const title = getCatalogTitle(filters, categories);
  const activeCategory = filters.category ? categories.find((c) => c.slug === filters.category) : undefined;
  const activeCount = countActiveFilters(filters);
  const result = search.data;

  // Garde le titre de l'onglet cohérent avec les filtres (la navigation est faite côté client).
  useEffect(() => {
    document.title = `${title} | ${siteConfig.name}`;
  }, [title]);

  const onChange = (patch: Partial<ProductFilters>) => updateFilters(patch);
  const reset = () => updateFilters((current) => resetFilters(current));

  return (
    <div className="container-store py-8 md:py-12">
      <header className="reveal mb-8 max-w-2xl space-y-3">
        <p className="eyebrow">Boutique</p>
        <h1 className="font-display text-3xl md:text-5xl">{title}</h1>
        {activeCategory?.description && <p className="text-muted-foreground text-base leading-relaxed">{activeCategory.description}</p>}
      </header>

      <div className="mb-6 max-w-xl">
        <CatalogSearch value={filters.search ?? ""} onSearch={(value) => updateFilters({ search: value || undefined }, "replace")} />
      </div>

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-14">
        {/* Desktop : panneau latéral sticky */}
        <aside aria-label="Filtres" className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium">Filtres</h2>
              {activeCount > 0 && (
                <button type="button" onClick={reset} className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4">
                  Effacer
                </button>
              )}
            </div>
            <FilterPanel filters={filters} facets={facets} categoryTree={categoryTree} onChange={onChange} idPrefix="desktop" />
          </div>
        </aside>

        <section aria-labelledby="catalog-results-title" className="min-w-0">
          <h2 id="catalog-results-title" className="sr-only">
            Résultats
          </h2>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p role="status" aria-live="polite" className="text-muted-foreground text-sm tabular-nums">
              {result ? `${result.total} produit${result.total > 1 ? "s" : ""}` : "Chargement…"}
            </p>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="h-10 lg:hidden" onClick={() => setSheetOpen(true)}>
                <SlidersHorizontal aria-hidden />
                Filtres{activeCount > 0 ? ` (${activeCount})` : ""}
              </Button>
              <Select
                value={filters.sort ?? DEFAULT_SORT}
                onValueChange={(value) => updateFilters({ sort: value === DEFAULT_SORT ? undefined : (value as ProductSort) })}
              >
                <SelectTrigger aria-label="Trier les produits" className="h-10 min-w-36 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-6 empty:hidden">
            <ActiveFilters filters={filters} categories={categories} onRemove={onChange} onReset={reset} />
          </div>

          {search.isError && !result ? (
            <div role="alert" className="border-destructive/30 bg-destructive-soft flex flex-col items-center rounded-lg border px-6 py-12 text-center">
              <AlertTriangle className="text-destructive mb-3 size-6" aria-hidden />
              <h3 className="font-medium">Impossible de charger les produits</h3>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">Un problème est survenu lors du chargement du catalogue. Vérifiez votre connexion puis réessayez.</p>
              <Button type="button" variant="outline" className="mt-5" onClick={() => void search.refetch()}>
                Réessayer
              </Button>
            </div>
          ) : !result ? (
            <div className={GRID} aria-busy="true" aria-label="Chargement des produits">
              {Array.from({ length: 8 }, (_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : result.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucun produit ne correspond"
              description="Essayez de retirer certains filtres ou de modifier votre recherche pour élargir les résultats."
              action={
                <Button type="button" onClick={reset}>
                  Réinitialiser les filtres
                </Button>
              }
            />
          ) : (
            <>
              <div className={cn(GRID, "transition-opacity", search.isPlaceholderData && "opacity-50")} aria-busy={search.isPlaceholderData}>
                {result.items.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 4} />
                ))}
              </div>
              <CatalogPagination page={result.page} totalPages={result.totalPages} filters={filters} onPageChange={setPage} />
            </>
          )}
        </section>
      </div>

      {/* Mobile : tiroir de filtres */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[90vw] max-w-sm gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b">
            <SheetTitle>Filtres</SheetTitle>
            <SheetDescription>Affinez la sélection ; les résultats se mettent à jour immédiatement.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <FilterPanel filters={filters} facets={facets} categoryTree={categoryTree} onChange={onChange} idPrefix="mobile" />
          </div>
          <SheetFooter className="bg-background grid grid-cols-[auto_1fr] gap-3 border-t">
            <Button type="button" variant="outline" className="h-11" onClick={reset} disabled={activeCount === 0 && !filters.search}>
              Effacer
            </Button>
            <SheetClose asChild>
              <Button type="button" className="h-11">
                {result ? `Voir ${result.total} résultat${result.total > 1 ? "s" : ""}` : "Voir les résultats"}
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="container-store py-8 md:py-12" aria-busy="true">
      <div className="bg-secondary mb-8 h-12 w-64 animate-pulse rounded" />
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
