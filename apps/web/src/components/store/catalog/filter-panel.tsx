"use client";

import { formatDZD } from "@fashion/shared";
import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ProductFilters } from "@/types/product.types";
import type { CatalogFacets, CategoryNode } from "./facets";

type FilterPanelProps = {
  filters: ProductFilters;
  facets: CatalogFacets;
  categoryTree: CategoryNode[];
  onChange: (patch: Partial<ProductFilters>) => void;
  /** Préfixe d'id : le panneau est monté à la fois dans la colonne desktop et dans le tiroir mobile. */
  idPrefix: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section role="group" aria-labelledby={id} className="border-border border-b py-5 first:pt-0 last:border-b-0">
      <h3 id={id} className="mb-3 text-sm font-medium tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}

const chip = (active: boolean) =>
  cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm transition-colors",
    active ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:border-foreground/50",
  );

function toggleValue(list: string[] | undefined, value: string): string[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

/** Filtres du catalogue : catégorie, collection, taille, couleur, prix, disponibilité. */
export function FilterPanel({ filters, facets, categoryTree, onChange, idPrefix }: FilterPanelProps) {
  const { min: boundMin, max: boundMax } = facets.priceBounds;

  return (
    <div className="text-sm">
      {categoryTree.length > 0 && (
        <Section title="Catégorie">
          <ul className="space-y-1">
            <li>
              <CategoryButton active={!filters.category} onClick={() => onChange({ category: undefined })}>
                Toutes les catégories
              </CategoryButton>
            </li>
            {categoryTree.map(({ category, children }) => (
              <li key={category.id}>
                <CategoryButton active={filters.category === category.slug} onClick={() => onChange({ category: category.slug })}>
                  {category.name}
                </CategoryButton>
                {children.length > 0 && (
                  <ul className="border-border mt-1 ml-3 space-y-1 border-l pl-3">
                    {children.map((child) => (
                      <li key={child.id}>
                        <CategoryButton active={filters.category === child.slug} onClick={() => onChange({ category: child.slug })}>
                          {child.name}
                        </CategoryButton>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Collection">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: undefined, label: "Toutes" },
              { value: "new", label: "Nouveautés" },
              { value: "sale", label: "Promotions" },
            ] as const
          ).map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={filters.collection === option.value}
              onClick={() => onChange({ collection: option.value })}
              className={chip(filters.collection === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Section>

      {facets.sizes.length > 0 && (
        <Section title="Taille">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => {
              const active = !!filters.sizes?.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ sizes: toggleValue(filters.sizes, size) })}
                  className={cn(chip(active), "min-w-10")}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {facets.colors.length > 0 && (
        <Section title="Couleur">
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((color) => {
              const active = !!filters.colors?.includes(color.name);
              return (
                <button
                  key={color.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ colors: toggleValue(filters.colors, color.name) })}
                  className={chip(active)}
                >
                  <ColorSwatch color={color.code} className={cn("size-4", active && "border-background/60")} />
                  {color.name}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Prix">
        <PriceFilter
          // Remonté quand l'URL change (réinitialisation, retrait d'une puce) : les poignées suivent le filtre.
          key={`${filters.minPrice ?? ""}-${filters.maxPrice ?? ""}-${boundMin}-${boundMax}`}
          bounds={facets.priceBounds}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onCommit={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
        />
      </Section>

      <Section title="Disponibilité">
        <div className="flex min-h-10 items-center gap-3">
          <Checkbox
            id={`${idPrefix}-in-stock`}
            checked={!!filters.inStockOnly}
            onCheckedChange={(checked) => onChange({ inStockOnly: checked === true ? true : undefined })}
          />
          <Label htmlFor={`${idPrefix}-in-stock`} className="cursor-pointer text-sm font-normal">
            En stock uniquement
          </Label>
        </div>
      </Section>
    </div>
  );
}

function CategoryButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "hover:bg-accent flex min-h-10 w-full items-center rounded-md px-2.5 text-left transition-colors",
        active && "bg-accent font-medium",
      )}
    >
      {children}
    </button>
  );
}

function PriceFilter({
  bounds,
  minPrice,
  maxPrice,
  onCommit,
}: {
  bounds: { min: number; max: number };
  minPrice?: number;
  maxPrice?: number;
  onCommit: (minPrice: number | undefined, maxPrice: number | undefined) => void;
}) {
  const [range, setRange] = useState<[number, number]>([
    Math.min(Math.max(minPrice ?? bounds.min, bounds.min), bounds.max),
    Math.min(Math.max(maxPrice ?? bounds.max, bounds.min), bounds.max),
  ]);

  return (
    <div className="space-y-4 px-1">
      <Slider
        min={bounds.min}
        max={bounds.max}
        step={100}
        minStepsBetweenThumbs={1}
        value={range}
        onValueChange={(v) => setRange([v[0] ?? bounds.min, v[1] ?? bounds.max])}
        onValueCommit={(v) => {
          const lo = v[0] ?? bounds.min;
          const hi = v[1] ?? bounds.max;
          onCommit(lo > bounds.min ? lo : undefined, hi < bounds.max ? hi : undefined);
        }}
      />
      <p className="text-muted-foreground flex items-center justify-between text-sm tabular-nums" aria-live="polite">
        <span>{formatDZD(range[0])}</span>
        <span aria-hidden>—</span>
        <span>{formatDZD(range[1])}</span>
      </p>
    </div>
  );
}
