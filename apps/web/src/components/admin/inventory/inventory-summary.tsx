"use client";

import { formatDZD } from "@fashion/shared";
import { AlertTriangle, Boxes, PackageX, Wallet } from "lucide-react";
import { useMemo } from "react";
import { StatCard } from "@/components/admin/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/features/products/hooks";
import { summarizeInventory } from "@/features/inventory/logic";
import type { InventoryItem } from "@/types/inventory.types";

/** Résumé calculé sur TOUTES les variantes (indépendamment des filtres du tableau). */
export function InventorySummary({ items, isLoading }: { items: InventoryItem[] | undefined; isLoading: boolean }) {
  const { data: products } = useProducts();
  const summary = useMemo(() => {
    if (!items) return null;
    const costByProduct = new Map((products ?? []).map((p) => [p.id, p.costPrice]));
    return summarizeInventory(items, costByProduct);
  }, [items, products]);

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[102px]" />
        ))}
      </div>
    );
  }

  return (
    <section aria-label="Résumé du stock" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Variantes au total" value={String(summary.totalVariants)} hint={`${summary.totalUnits} pièces en stock`} icon={Boxes} />
      <StatCard label="Stock faible" value={String(summary.lowStock)} hint="Au seuil d'alerte ou en dessous" icon={AlertTriangle} tone="warning" />
      <StatCard label="Ruptures" value={String(summary.outOfStock)} hint="Variantes à 0 pièce" icon={PackageX} tone="danger" />
      <StatCard label="Valeur du stock" value={formatDZD(summary.stockValueAtCost)} hint="Au prix d'achat (hors marge)" icon={Wallet} />
    </section>
  );
}
