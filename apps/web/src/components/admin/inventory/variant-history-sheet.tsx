"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StockStatusBadge } from "@/components/ui/status-badge";
import { useStockMovements } from "@/features/inventory/hooks";
import { getErrorMessage } from "@/services";
import type { InventoryItem } from "@/types/inventory.types";
import { History } from "lucide-react";
import { MovementList } from "./movement-list";

type VariantHistorySheetProps = {
  item: InventoryItem | null;
  onOpenChange: (open: boolean) => void;
};

/** Panneau latéral : historique des mouvements d'UNE variante. */
export function VariantHistorySheet({ item, onOpenChange }: VariantHistorySheetProps) {
  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Historique de la variante</SheetTitle>
          <SheetDescription>
            {item ? `${item.productName} — ${item.color}, taille ${item.size} (${item.sku})` : "Mouvements de stock"}
          </SheetDescription>
          {item && (
            <p className="flex items-center gap-2 pt-1 text-sm">
              Stock actuel : <strong className="tabular-nums">{item.stock}</strong> <StockStatusBadge status={item.status} />
            </p>
          )}
        </SheetHeader>
        <div className="p-4">{item && <HistoryBody variantId={item.variantId} />}</div>
      </SheetContent>
    </Sheet>
  );
}

function HistoryBody({ variantId }: { variantId: string }) {
  const { data, isLoading, isError, error } = useStockMovements({ variantId });
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Chargement de l'historique">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (isError) return <EmptyState icon={History} title="Historique indisponible" description={getErrorMessage(error)} />;
  if (!data || data.length === 0) return <EmptyState icon={History} title="Aucun mouvement" description="Cette variante n'a pas encore de mouvement de stock." />;
  return <MovementList movements={data} compact />;
}
