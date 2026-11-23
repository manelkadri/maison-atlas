import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { OrdersView } from "@/components/admin/orders/orders-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Commandes" };

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Commandes" description="Suivez, confirmez et expédiez les commandes. Paiement à la livraison uniquement." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OrdersView />
      </Suspense>
    </>
  );
}
