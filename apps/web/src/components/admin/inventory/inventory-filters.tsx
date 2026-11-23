"use client";

import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVENTORY_SORT_LABELS, type InventoryFilterOptions, type InventorySort } from "@/features/inventory/logic";
import type { StockStatus } from "@/types/product.types";

export type InventoryFilterState = {
  search: string;
  productId: string;
  color: string;
  size: string;
  status: StockStatus | "all";
  sort: InventorySort;
};

export const DEFAULT_INVENTORY_FILTERS: InventoryFilterState = {
  search: "",
  productId: "all",
  color: "all",
  size: "all",
  status: "all",
  sort: "stock_asc",
};

type Props = {
  value: InventoryFilterState;
  options: InventoryFilterOptions;
  onChange: (patch: Partial<InventoryFilterState>) => void;
  onReset: () => void;
  isFiltered: boolean;
};

const STATUS_OPTIONS: Array<{ value: StockStatus | "all"; label: string }> = [
  { value: "all", label: "Tous les statuts" },
  { value: "available", label: "Disponible" },
  { value: "low", label: "Stock faible" },
  { value: "out_of_stock", label: "Rupture" },
];

function SelectField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function InventoryFilters({ value, options, onChange, onReset, isFiltered }: Props) {
  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Rechercher un produit ou un SKU"
          aria-label="Rechercher un produit ou un SKU"
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <SelectField label="Produit" id="inv-product">
          <Select value={value.productId} onValueChange={(v) => onChange({ productId: v })}>
            <SelectTrigger id="inv-product" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les produits</SelectItem>
              {options.products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SelectField>
        <SelectField label="Couleur" id="inv-color">
          <Select value={value.color} onValueChange={(v) => onChange({ color: v })}>
            <SelectTrigger id="inv-color" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les couleurs</SelectItem>
              {options.colors.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  <ColorSwatch color={c.code} className="size-3" /> {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SelectField>
        <SelectField label="Taille" id="inv-size">
          <Select value={value.size} onValueChange={(v) => onChange({ size: v })}>
            <SelectTrigger id="inv-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les tailles</SelectItem>
              {options.sizes.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SelectField>
        <SelectField label="Statut" id="inv-status">
          <Select value={value.status} onValueChange={(v) => onChange({ status: v as StockStatus | "all" })}>
            <SelectTrigger id="inv-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SelectField>
        <SelectField label="Trier par" id="inv-sort">
          <Select value={value.sort} onValueChange={(v) => onChange({ sort: v as InventorySort })}>
            <SelectTrigger id="inv-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(INVENTORY_SORT_LABELS) as InventorySort[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {INVENTORY_SORT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SelectField>
      </div>
      {isFiltered && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw aria-hidden /> Réinitialiser les filtres
        </Button>
      )}
    </div>
  );
}
