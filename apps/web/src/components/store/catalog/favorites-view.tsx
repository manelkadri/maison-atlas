"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard, ProductCardSkeleton } from "@/components/store/product-card";
import { useProducts } from "@/features/products/hooks";
import { useHydrated } from "@/hooks/use-hydrated";
import { useFavoritesStore } from "@/stores/favorites.store";

const GRID = "grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4";

/** Liste des favoris (localStorage). Les produits retirés du catalogue sont ignorés. */
export function FavoritesView() {
  const hydrated = useHydrated();
  const productIds = useFavoritesStore((s) => s.productIds);
  const clear = useFavoritesStore((s) => s.clear);
  const { data: products, isPending, isError, refetch } = useProducts({ onlyPublic: true });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const favorites = useMemo(() => {
    if (!products) return [];
    // Conserve l'ordre des favoris (le plus récent d'abord) et ignore les produits supprimés ou dépubliés.
    return productIds.flatMap((id) => {
      const product = products.find((p) => p.id === id);
      return product ? [product] : [];
    });
  }, [productIds, products]);

  const loading = !hydrated || (productIds.length > 0 && isPending);

  return (
    <div className="container-store py-8 md:py-12">
      <header className="reveal mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="eyebrow">Ma sélection</p>
          <h1 className="font-display text-3xl md:text-5xl">Mes favoris</h1>
          {hydrated && favorites.length > 0 && (
            <p className="text-muted-foreground text-sm" role="status">
              {favorites.length} article{favorites.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {hydrated && favorites.length > 0 && (
          <Button type="button" variant="outline" className="h-10" onClick={() => setConfirmOpen(true)}>
            Tout effacer
          </Button>
        )}
      </header>

      {loading ? (
        <div className={GRID} aria-busy="true" aria-label="Chargement des favoris">
          {Array.from({ length: 4 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="border-destructive/30 bg-destructive-soft rounded-lg border px-6 py-12 text-center">
          <p className="font-medium">Impossible de charger vos favoris.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Vous n'avez pas encore de favoris"
          description="Touchez le cœur d'un article pour le retrouver ici. Votre sélection reste enregistrée sur cet appareil."
          action={
            <Button asChild className="h-11">
              <Link href="/shop">Découvrir la boutique</Link>
            </Button>
          }
        />
      ) : (
        <div className={GRID}>
          {favorites.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index < 4} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Effacer tous vos favoris ?"
        description="Les articles seront retirés de votre liste. Cette action est irréversible."
        confirmLabel="Tout effacer"
        variant="destructive"
        onConfirm={() => {
          clear();
          setConfirmOpen(false);
          toast.success("Favoris effacés");
        }}
      />
    </div>
  );
}
