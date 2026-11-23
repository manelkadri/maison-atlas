"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { Input } from "@/components/ui/input";
import type { InventoryItem } from "@/types/inventory.types";

type VariantPickerProps = {
  id: string;
  items: InventoryItem[];
  value: string;
  onChange: (variantId: string) => void;
  invalid?: boolean;
};

const MAX_RESULTS = 8;

/** Sélecteur de variante recherchable (produit, SKU, couleur, taille). */
export function VariantPicker({ id, items, value, onChange, invalid }: VariantPickerProps) {
  const [query, setQuery] = useState("");
  const selected = items.find((i) => i.variantId === value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? items.filter((i) => `${i.productName} ${i.sku} ${i.color} ${i.size}`.toLowerCase().includes(q)) : items;
    return list.slice(0, MAX_RESULTS);
  }, [items, query]);

  if (selected) {
    return (
      <div id={id} className="bg-muted/60 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{selected.productName}</p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <span className="font-mono">{selected.sku}</span>
            <span className="inline-flex items-center gap-1">
              <ColorSwatch color={selected.colorCode} className="size-3" /> {selected.color}
            </span>
            <span>Taille {selected.size}</span>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
          Changer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
        <Input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Produit, SKU, couleur ou taille"
          className="pl-9"
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
        />
      </div>
      {results.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">Aucune variante ne correspond.</p>
      ) : (
        <ul className="max-h-48 divide-y overflow-y-auto rounded-md border" aria-label="Variantes correspondantes">
          {results.map((i) => (
            <li key={i.variantId}>
              <button
                type="button"
                onClick={() => onChange(i.variantId)}
                className="hover:bg-accent focus-visible:bg-accent flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.productName}</span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                    <span className="font-mono">{i.sku}</span>
                    <span className="inline-flex items-center gap-1">
                      <ColorSwatch color={i.colorCode} className="size-3" /> {i.color}
                    </span>
                    <span>{i.size}</span>
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">Stock : {i.stock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > MAX_RESULTS && !query && <p className="text-muted-foreground text-xs">Saisissez un mot-clé pour affiner la liste.</p>}
    </div>
  );
}
