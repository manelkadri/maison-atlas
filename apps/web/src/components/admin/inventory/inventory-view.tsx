"use client";

import { PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { TablePagination } from "@/components/admin/table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventory } from "@/features/inventory/hooks";
import { INVENTORY_PAGE_SIZE, deriveFilterOptions, parseStatusParam, sortInventory } from "@/features/inventory/logic";
import { useLatest } from "@/features/inventory/use-latest";
import { useUrlParams } from "@/features/inventory/use-url-params";
import { getErrorMessage } from "@/services";
import type { InventoryFilters as InventoryQueryFilters, InventoryItem } from "@/types/inventory.types";
import { DEFAULT_INVENTORY_FILTERS, InventoryFilters, type InventoryFilterState } from "./inventory-filters";
import { InventorySummary } from "./inventory-summary";
import { InventoryTable, type InventoryAction } from "./inventory-table";
import { MovementDialog } from "./movement-dialog";
import { MovementsPanel } from "./movements-panel";
import { VariantHistorySheet } from "./variant-history-sheet";
import type { ManualMovementType } from "@/features/inventory/logic";

type MovementTarget = { item: InventoryItem; type: ManualMovementType };

/** Vue Stocks : filtres (statut et produit pilotés par l'URL), tableau/cartes, mouvements, historique. */
export function InventoryView() {
  const { searchParams, setParams } = useUrlParams();
  const tab = searchParams.get("tab") === "movements" ? "movements" : "stock";
  const status = parseStatusParam(searchParams.get("status"));
  const productId = searchParams.get("productId") ?? "all";

  const [local, setLocal] = useState({
    search: DEFAULT_INVENTORY_FILTERS.search,
    color: DEFAULT_INVENTORY_FILTERS.color,
    size: DEFAULT_INVENTORY_FILTERS.size,
    sort: DEFAULT_INVENTORY_FILTERS.sort,
  });
  const [page, setPage] = useState(1);
  const [movement, setMovement] = useState<MovementTarget | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  const filters: InventoryFilterState = { ...local, status, productId };

  const query: InventoryQueryFilters = {
    search: filters.search || undefined,
    productId: productId === "all" ? undefined : productId,
    color: filters.color === "all" ? undefined : filters.color,
    size: filters.size === "all" ? undefined : filters.size,
    status: filters.status,
  };
  const all = useInventory();
  const list = useInventory(query);
  const listData = useLatest(list.data);

  const options = useMemo(() => deriveFilterOptions(all.data ?? []), [all.data]);
  const sorted = useMemo(() => sortInventory(listData ?? [], filters.sort), [listData, filters.sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / INVENTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * INVENTORY_PAGE_SIZE, currentPage * INVENTORY_PAGE_SIZE);

  const isFiltered = !!filters.search || filters.color !== "all" || filters.size !== "all" || status !== "all" || productId !== "all";

  const onChange = (patch: Partial<InventoryFilterState>) => {
    setPage(1);
    const { status: nextStatus, productId: nextProduct, ...rest } = patch;
    if (Object.keys(rest).length > 0) setLocal((prev) => ({ ...prev, ...rest }));
    if (nextStatus !== undefined || nextProduct !== undefined) {
      setParams({
        ...(nextStatus !== undefined ? { status: nextStatus === "all" ? null : nextStatus } : {}),
        ...(nextProduct !== undefined ? { productId: nextProduct === "all" ? null : nextProduct } : {}),
      });
    }
  };
  const reset = () => {
    setLocal({ search: "", color: "all", size: "all", sort: local.sort });
    setPage(1);
    setParams({ status: null, productId: null });
  };

  const onAction = (action: InventoryAction) => {
    if (action.kind === "history") setHistoryItem(action.item);
    else setMovement({ item: action.item, type: action.type });
  };

  return (
    <div className="space-y-4">
      <InventorySummary items={all.data} isLoading={all.isLoading} />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v === "movements" ? "movements" : null })}>
        <TabsList aria-label="Sections du module stock">
          <TabsTrigger value="stock">Stock par variante</TabsTrigger>
          <TabsTrigger value="movements">Mouvements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-2">
          <Card className="gap-0 overflow-hidden py-0">
            <InventoryFilters value={filters} options={options} onChange={onChange} onReset={reset} isFiltered={isFiltered} />
            <div className="border-t">
              {!listData && list.isLoading ? (
                <div className="space-y-2 p-4" aria-busy="true" aria-label="Chargement du stock">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : list.isError ? (
                <div className="p-4">
                  <EmptyState
                    icon={PackageSearch}
                    title="Impossible de charger le stock"
                    description={getErrorMessage(list.error)}
                    action={
                      <Button variant="outline" onClick={() => void list.refetch()}>
                        Réessayer
                      </Button>
                    }
                  />
                </div>
              ) : sorted.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={PackageSearch}
                    title="Aucune variante trouvée"
                    description={isFiltered ? "Aucune variante ne correspond à ces filtres." : "Aucune variante n'est encore enregistrée."}
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
                  <InventoryTable items={pageItems} onAction={onAction} />
                  <TablePagination page={currentPage} pageSize={INVENTORY_PAGE_SIZE} total={sorted.length} onPageChange={setPage} />
                </>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-2">
          <MovementsPanel />
        </TabsContent>
      </Tabs>

      <MovementDialog
        key={movement ? `${movement.item.variantId}-${movement.type}` : "closed"}
        open={movement !== null}
        onOpenChange={(o) => !o && setMovement(null)}
        items={all.data ?? []}
        variantId={movement?.item.variantId}
        defaultType={movement?.type}
      />
      <VariantHistorySheet item={historyItem} onOpenChange={(o) => !o && setHistoryItem(null)} />
    </div>
  );
}
