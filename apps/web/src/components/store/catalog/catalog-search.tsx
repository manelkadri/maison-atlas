"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type CatalogSearchProps = {
  /** Valeur actuelle dans l'URL. */
  value: string;
  onSearch: (value: string) => void;
  delay?: number;
};

/** Champ de recherche avec anti-rebond (~300 ms) ; l'URL reste la source de vérité. */
export function CatalogSearch({ value, onSearch, delay = 300 }: CatalogSearchProps) {
  const [text, setText] = useState(value);
  // Dernière valeur envoyée vers l'URL : distingue notre propre navigation d'un changement externe (réinitialisation).
  const [sent, setSent] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== sent) {
      setText(value);
      setSent(value);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: string) => {
    clearTimeout(timer.current);
    setSent(next);
    onSearch(next);
  };

  const schedule = (next: string) => {
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next.trim()), delay);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commit(text.trim());
      }}
      className="relative"
    >
      <label htmlFor="catalog-search" className="sr-only">
        Rechercher un produit
      </label>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" aria-hidden />
      <Input
        id="catalog-search"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={text}
        onChange={(e) => schedule(e.target.value)}
        placeholder="Rechercher une robe, une chemise, une référence…"
        className="h-11 pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            commit("");
          }}
          aria-label="Effacer la recherche"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </form>
  );
}
