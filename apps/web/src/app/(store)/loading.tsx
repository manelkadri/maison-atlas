import { ProductCardSkeleton } from "@/components/store/product-card";
import { Skeleton } from "@/components/ui/skeleton";

/** Squelette de page générique affiché pendant la navigation dans la boutique. */
export default function StoreLoading() {
  return (
    <div className="container-store py-10" role="status" aria-live="polite">
      <span className="sr-only">Chargement en cours…</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-10 w-2/3 max-w-md" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
