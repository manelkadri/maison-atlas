"use client";

import { Heart, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { getCartCount, useCartStore } from "@/stores/cart.store";
import { useFavoritesStore } from "@/stores/favorites.store";
import { countLabel, formatBadgeCount } from "./nav-utils";
import { SearchDialog } from "./search-dialog";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="bg-primary text-primary-foreground absolute top-1 right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-4 font-medium tabular-nums"
    >
      {formatBadgeCount(count)}
    </span>
  );
}

/** Compteur de pièces du panier (0 tant que le localStorage n'est pas lu : pas d'erreur d'hydratation). */
export function useCartCount(): number {
  const hydrated = useHydrated();
  const count = useCartStore((s) => getCartCount(s.items));
  return hydrated ? count : 0;
}

export function useFavoritesCount(): number {
  const hydrated = useHydrated();
  const count = useFavoritesStore((s) => s.productIds.length);
  return hydrated ? count : 0;
}

/** Recherche, compte, favoris et panier (avec compteurs). */
export function HeaderActions({ className }: { className?: string }) {
  const cartCount = useCartCount();
  const favoritesCount = useFavoritesCount();

  return (
    <div className={cn("flex items-center", className)}>
      <SearchDialog />
      <Button asChild variant="ghost" size="icon" className="hidden size-11 sm:inline-flex">
        <Link href="/account" aria-label="Mon compte">
          <User className="size-5" aria-hidden />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="relative size-11">
        <Link href="/favorites" aria-label={countLabel("Mes favoris", favoritesCount, "produit", "produits")}>
          <Heart className="size-5" aria-hidden />
          <CountBadge count={favoritesCount} />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="relative size-11">
        <Link href="/cart" aria-label={countLabel("Mon panier", cartCount, "pièce", "pièces")}>
          <ShoppingBag className="size-5" aria-hidden />
          <CountBadge count={cartCount} />
        </Link>
      </Button>
    </div>
  );
}
