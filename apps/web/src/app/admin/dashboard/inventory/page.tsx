import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { InventoryView } from "@/components/admin/inventory/inventory-view";
import { NewMovementButton } from "@/components/admin/inventory/new-movement-button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Stocks" };

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Gestion des stocks"
        description="Le stock se gère par variante (taille × couleur). Chaque mouvement est historisé."
        actions={<NewMovementButton />}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <InventoryView />
      </Suspense>
    </>
  );
}
