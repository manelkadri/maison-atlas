"use client";

import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PRODUCT_SORT_LABELS,
  countActiveFilters,
  type ProductListFilters,
  type ProductListSort,
  type PublicationFilter,
  type StockFilter,
} from "@/features/products/list-utils";

type Props = {
  /** Filtres appliqués (la recherche est gérée à part pour le debounce). */
  filters: ProductListFilters;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onFilterChange: <K extends keyof ProductListFilters>(key: K, value: ProductListFilters[K]) => void;
  onReset: () => void;
  categoryOptions: Array<{ id: string; label: string }>;
};

export function ProductFilters({ filters, searchInput, onSearchChange, onFilterChange, onReset, categoryOptions }: Props) {
  const active = countActiveFilters({ ...filters, search: searchInput });
  return (
    <div className="flex flex-col gap-3 border-b p-4" role="search" aria-label="Filtrer les produits">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(0,1fr))_minmax(0,1fr)]">
        <div className="relative md:col-span-2 xl:col-span-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nom, référence, tag…"
            aria-label="Rechercher un produit"
            className="pl-9"
          />
        </div>

        <Select value={filters.categoryId} onValueChange={(v) => onFilterChange("categoryId", v)}>
          <SelectTrigger className="w-full" aria-label="Filtrer par catégorie">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.publication} onValueChange={(v) => onFilterChange("publication", v as PublicationFilter)}>
          <SelectTrigger className="w-full" aria-label="Filtrer par statut de publication">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="published">Publiés</SelectItem>
            <SelectItem value="draft">Brouillons</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.stock} onValueChange={(v) => onFilterChange("stock", v as StockFilter)}>
          <SelectTrigger className="w-full" aria-label="Filtrer par stock">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les stocks</SelectItem>
            <SelectItem value="partial">Rupture partielle</SelectItem>
            <SelectItem value="total">Rupture totale</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sort} onValueChange={(v) => onFilterChange("sort", v as ProductListSort)}>
          <SelectTrigger className="w-full" aria-label="Trier les produits">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PRODUCT_SORT_LABELS) as ProductListSort[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PRODUCT_SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox id="include-archived" checked={filters.includeArchived} onCheckedChange={(v) => onFilterChange("includeArchived", v === true)} />
          <Label htmlFor="include-archived" className="text-sm font-normal">
            Inclure les produits archivés
          </Label>
        </div>
        {active > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw aria-hidden /> Réinitialiser ({active})
          </Button>
        )}
      </div>
    </div>
  );
}
