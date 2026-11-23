"use client";

import { History, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { TablePagination } from "@/components/admin/table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useInventory, useStockMovements } from "@/features/inventory/hooks";
import { INVENTORY_PAGE_SIZE, MOVEMENT_TYPE_LABELS, deriveFilterOptions, filterMovements } from "@/features/inventory/logic";
import { getErrorMessage } from "@/services";
import type { StockMovementType } from "@/types/inventory.types";
import { MovementList } from "./movement-list";

const TYPES = Object.keys(MOVEMENT_TYPE_LABELS) as StockMovementType[];

/** Onglet « Mouvements » : historique global filtrable par type, produit et plage de dates. */
export function MovementsPanel() {
  const [type, setType] = useState<StockMovementType | "all">("all");
  const [productId, setProductId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const { data: items } = useInventory();
  const products = useMemo(() => deriveFilterOptions(items ?? []).products, [items]);
  const { data, isLoading, isError, error, refetch } = useStockMovements(productId === "all" ? undefined : { productId });

  const filtered = useMemo(() => filterMovements(data ?? [], { type, dateFrom, dateTo }), [data, type, dateFrom, dateTo]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / INVENTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * INVENTORY_PAGE_SIZE, currentPage * INVENTORY_PAGE_SIZE);
  const isFiltered = type !== "all" || productId !== "all" || !!dateFrom || !!dateTo;
  const reset = () => {
    setType("all");
    setProductId("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };
  const invalidRange = !!dateFrom && !!dateTo && dateFrom > dateTo;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="mv-f-type" className="text-muted-foreground text-xs">
              Type
            </Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as StockMovementType | "all");
                setPage(1);
              }}
            >
              <SelectTrigger id="mv-f-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MOVEMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="mv-f-product" className="text-muted-foreground text-xs">
              Produit
            </Label>
            <Select
              value={productId}
              onValueChange={(v) => {
                setProductId(v);
                setPage(1);
              }}
            >
              <SelectTrigger id="mv-f-product" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="mv-f-from" className="text-muted-foreground text-xs">
              Du
            </Label>
            <Input
              id="mv-f-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="mv-f-to" className="text-muted-foreground text-xs">
              Au
            </Label>
            <Input
              id="mv-f-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {invalidRange && (
          <p role="alert" className="text-destructive text-xs">
            La date de début doit précéder la date de fin.
          </p>
        )}
        {isFiltered && (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden /> Réinitialiser les filtres
          </Button>
        )}
      </div>

      <div className="border-t">
        {isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Chargement des mouvements">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              title="Impossible de charger l'historique"
              description={getErrorMessage(error)}
              action={
                <Button variant="outline" onClick={() => void refetch()}>
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={History}
              title="Aucun mouvement"
              description={isFiltered ? "Aucun mouvement ne correspond à ces filtres." : "Les mouvements de stock apparaîtront ici."}
              action={
                isFiltered ? (
                  <Button variant="outline" onClick={reset}>
                    Réinitialiser les filtres
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <MovementList movements={pageItems} />
            <TablePagination page={currentPage} pageSize={INVENTORY_PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}
      </div>
    </Card>
  );
}
