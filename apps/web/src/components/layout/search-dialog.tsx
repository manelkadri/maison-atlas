"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDZD } from "@fashion/shared";
import { Loader2, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { queryKeys } from "@/lib/query-keys";
import { productService } from "@/services";
import type { ProductFilters } from "@/types/product.types";

const MAX_RESULTS = 6;
const MIN_CHARS = 2;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Recherche instantanée : champ + max. 6 produits, navigation clavier (flèches, Entrée, Échap). */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11" aria-label="Rechercher un produit">
          <Search className="size-5" aria-hidden />
        </Button>
      </DialogTrigger>
      {/* Le contenu monte à l'ouverture : le champ de recherche (premier élément focalisable) prend le focus. */}
      <DialogContent className="top-[8vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Rechercher un produit</DialogTitle>
        <DialogDescription className="sr-only">
          Saisissez au moins deux caractères pour afficher des produits. Utilisez les flèches pour parcourir les résultats.
        </DialogDescription>
        <SearchPanel onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function SearchPanel({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const term = useDebouncedValue(query, 250).trim();
  const enabled = term.length >= MIN_CHARS;
  const filters: ProductFilters = { search: term };

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.products.search(filters, 1, MAX_RESULTS),
    queryFn: () => productService.searchProducts(filters, 1, MAX_RESULTS),
    enabled,
    placeholderData: keepPreviousData,
  });

  const typed = query.trim();
  const items = enabled && typed.length >= MIN_CHARS ? (data?.items ?? []) : [];
  const total = enabled ? (data?.total ?? 0) : 0;
  const searching = typed.length >= MIN_CHARS && (term !== typed || isFetching);
  const seeAllHref = `/shop?search=${encodeURIComponent(typed)}`;
  const optionId = (index: number) => `${listId}-option-${index}`;

  const go = (href: string) => {
    onNavigate();
    router.push(href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = items[activeIndex];
      if (active) go(`/product/${active.slug}`);
      else if (typed.length >= MIN_CHARS) go(seeAllHref);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 border-b px-4">
        <Search className="text-muted-foreground size-5 shrink-0" aria-hidden />
        <input
          type="search"
          role="combobox"
          aria-label="Rechercher un produit"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Rechercher une robe, une chemise…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={onKeyDown}
          className="placeholder:text-muted-foreground h-14 min-w-0 flex-1 bg-transparent pr-8 text-base outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {searching && <Loader2 className="text-muted-foreground mr-6 size-4 animate-spin" aria-hidden />}
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        <p className="sr-only" role="status" aria-live="polite">
          {enabled && !searching ? (total > 0 ? `${total} résultat${total > 1 ? "s" : ""}` : "Aucun résultat") : ""}
        </p>

        {typed.length < MIN_CHARS && (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            Saisissez au moins {MIN_CHARS} caractères pour lancer la recherche.
          </p>
        )}

        {typed.length >= MIN_CHARS && !searching && items.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="font-medium">Aucun résultat pour « {typed} »</p>
            <p className="text-muted-foreground mt-1 text-sm">Vérifiez l&apos;orthographe ou parcourez toute la boutique.</p>
            <Button asChild variant="outline" className="mt-4 h-11" onClick={onNavigate}>
              <Link href="/shop">Voir la boutique</Link>
            </Button>
          </div>
        )}

        <ul id={listId} role="listbox" aria-label="Résultats de recherche" className={items.length === 0 ? "hidden" : undefined}>
          {items.map((product, index) => {
            const image = product.images[0];
            const active = index === activeIndex;
            return (
              <li key={product.id} id={optionId(index)} role="option" aria-selected={active}>
                <Link
                  href={`/product/${product.slug}`}
                  onClick={onNavigate}
                  tabIndex={-1}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${active ? "bg-accent" : "hover:bg-accent/60"}`}
                >
                  <span className="bg-secondary relative block h-16 w-12 shrink-0 overflow-hidden rounded-sm">
                    {image && <Image src={image.url} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{product.name}</span>
                    <span className="text-muted-foreground block text-sm tabular-nums">{formatDZD(product.price)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {typed.length >= MIN_CHARS && items.length > 0 && (
        <div className="border-t p-2">
          <Link
            href={seeAllHref}
            onClick={onNavigate}
            className="hover:bg-accent/60 flex min-h-11 items-center justify-center rounded-md text-sm font-medium"
          >
            Voir tous les résultats{total > items.length ? ` (${total})` : ""}
          </Link>
        </div>
      )}
    </div>
  );
}
