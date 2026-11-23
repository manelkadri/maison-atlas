import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Chargement des graphiques">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i} className="gap-3 px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-60 w-full" />
        </Card>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="gap-2 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </Card>
        ))}
      </div>
      <ChartsSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
