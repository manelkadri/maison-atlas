import { PackageSearch } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * État « Produit introuvable ». Le `<meta name="robots">` est hoisté dans <head> par React 19 :
 * une page qui n'existe pas ne doit jamais être indexée.
 */
export function ProductNotFound() {
  return (
    <div className="container-store py-16 md:py-24">
      <meta name="robots" content="noindex" />
      <EmptyState
        icon={PackageSearch}
        title="Produit introuvable"
        description="Ce produit n'existe pas ou n'est plus disponible à la vente. Il a peut-être été retiré du catalogue."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="h-11">
              <Link href="/shop">Voir la boutique</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="container-store py-6 md:py-10" aria-busy="true" aria-label="Chargement du produit">
      <div className="bg-secondary mb-6 h-4 w-56 animate-pulse rounded" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="bg-secondary aspect-[4/5] animate-pulse rounded-sm" />
        <div className="space-y-5">
          <div className="bg-secondary h-4 w-24 animate-pulse rounded" />
          <div className="bg-secondary h-9 w-3/4 animate-pulse rounded" />
          <div className="bg-secondary h-6 w-32 animate-pulse rounded" />
          <div className="bg-secondary h-20 w-full animate-pulse rounded" />
          <div className="bg-secondary h-11 w-2/3 animate-pulse rounded" />
          <div className="bg-secondary h-12 w-full animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
