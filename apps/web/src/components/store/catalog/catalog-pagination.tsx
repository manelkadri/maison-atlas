"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import type { ProductFilters } from "@/types/product.types";
import { catalogUrl } from "./params";

/** Numéros de pages à afficher : 1 … 4 5 6 … 12 (null = ellipse). */
export function getPageItems(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const items: Array<number | null> = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev > 1) items.push(null);
    items.push(p);
  });
  return items;
}

type CatalogPaginationProps = {
  page: number;
  totalPages: number;
  filters: ProductFilters;
  onPageChange: (page: number) => void;
};

export function CatalogPagination({ page, totalPages, filters, onPageChange }: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  const link = (target: number) => ({
    href: catalogUrl(filters, target),
    onClick: (e: React.MouseEvent) => {
      // Navigation interne ; Ctrl/Cmd/Maj+clic garde le comportement natif (nouvel onglet).
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      onPageChange(target);
    },
  });

  return (
    <Pagination aria-label="Pagination du catalogue" className="mt-10">
      <PaginationContent>
        <PaginationItem>
          {page > 1 ? (
            <PaginationLink size="default" aria-label="Page précédente" className="gap-1 px-3" {...link(page - 1)}>
              <ChevronLeft aria-hidden />
              <span className="hidden sm:inline">Précédent</span>
            </PaginationLink>
          ) : (
            <span aria-hidden className="text-muted-foreground/50 inline-flex h-9 items-center gap-1 px-3 text-sm">
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Précédent</span>
            </span>
          )}
        </PaginationItem>

        <PaginationItem className="sm:hidden">
          <span className="px-3 text-sm tabular-nums" aria-live="polite">
            Page {page} sur {totalPages}
          </span>
        </PaginationItem>

        {getPageItems(page, totalPages).map((item, index) =>
          item === null ? (
            <PaginationItem key={`gap-${index}`} className="hidden sm:block">
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item} className="hidden sm:block">
              <PaginationLink isActive={item === page} aria-label={`Page ${item}`} className="size-10" {...link(item)}>
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          {page < totalPages ? (
            <PaginationLink size="default" aria-label="Page suivante" className="gap-1 px-3" {...link(page + 1)}>
              <span className="hidden sm:inline">Suivant</span>
              <ChevronRight aria-hidden />
            </PaginationLink>
          ) : (
            <span aria-hidden className="text-muted-foreground/50 inline-flex h-9 items-center gap-1 px-3 text-sm">
              <span className="hidden sm:inline">Suivant</span>
              <ChevronRight className="size-4" />
            </span>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
