import { Skeleton } from "@/components/ui/skeleton";

/** Chargement générique d'une page du dashboard (s'applique à toutes les sous-pages pendant la navigation). */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Chargement de la page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
