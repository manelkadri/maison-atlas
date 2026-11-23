"use client";

import { formatDZD } from "@fashion/shared";
import { X } from "lucide-react";
import type { Category, ProductFilters } from "@/types/product.types";

export type FilterChip = { key: string; label: string; remove: Partial<ProductFilters> };

export function getActiveChips(filters: ProductFilters, categories: Category[]): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.category) {
    chips.push({
      key: "category",
      label: categories.find((c) => c.slug === filters.category)?.name ?? filters.category,
      remove: { category: undefined },
    });
  }
  if (filters.collection) {
    chips.push({ key: "collection", label: filters.collection === "new" ? "Nouveautés" : "Promotions", remove: { collection: undefined } });
  }
  for (const size of filters.sizes ?? []) {
    chips.push({ key: `size-${size}`, label: `Taille ${size}`, remove: { sizes: filters.sizes!.filter((s) => s !== size) } });
  }
  for (const color of filters.colors ?? []) {
    chips.push({ key: `color-${color}`, label: color, remove: { colors: filters.colors!.filter((c) => c !== color) } });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const label =
      filters.minPrice !== undefined && filters.maxPrice !== undefined
        ? `${formatDZD(filters.minPrice)} – ${formatDZD(filters.maxPrice)}`
        : filters.minPrice !== undefined
          ? `Dès ${formatDZD(filters.minPrice)}`
          : `Jusqu'à ${formatDZD(filters.maxPrice!)}`;
    chips.push({ key: "price", label, remove: { minPrice: undefined, maxPrice: undefined } });
  }
  if (filters.inStockOnly) chips.push({ key: "stock", label: "En stock", remove: { inStockOnly: undefined } });
  if (filters.search?.trim()) chips.push({ key: "search", label: `« ${filters.search.trim()} »`, remove: { search: undefined } });
  return chips;
}

type ActiveFiltersProps = {
  filters: ProductFilters;
  categories: Category[];
  onRemove: (patch: Partial<ProductFilters>) => void;
  onReset: () => void;
};

/** Puces des filtres actifs, supprimables une à une, + « Tout réinitialiser ». */
export function ActiveFilters({ filters, categories, onRemove, onReset }: ActiveFiltersProps) {
  const chips = getActiveChips(filters, categories);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtres actifs" role="group">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.remove)}
          aria-label={`Retirer le filtre : ${chip.label}`}
          className="border-input bg-card hover:border-foreground/50 inline-flex min-h-9 items-center gap-1.5 rounded-full border py-1 pr-2 pl-3.5 text-sm transition-colors"
        >
          {chip.label}
          <X className="text-muted-foreground size-3.5" aria-hidden />
        </button>
      ))}
      <button type="button" onClick={onReset} className="text-muted-foreground hover:text-foreground min-h-9 px-2 text-sm underline underline-offset-4">
        Tout réinitialiser
      </button>
    </div>
  );
}
