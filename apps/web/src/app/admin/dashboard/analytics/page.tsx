import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { AnalyticsView } from "@/components/admin/analytics/analytics-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Statistiques" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Statistiques"
        description="Ventes, marges et performance. Chiffre d'affaires = commandes livrées, hors livraison."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AnalyticsView />
      </Suspense>
    </>
  );
}
