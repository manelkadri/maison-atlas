"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** Pagination simple et accessible pour les tableaux admin. */
export function TablePagination({ page, pageSize, total, onPageChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <p className="text-muted-foreground text-sm tabular-nums">
        {from}–{to} sur {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft aria-hidden /> Précédent
        </Button>
        <span className="text-sm tabular-nums">
          Page {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Suivant <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
