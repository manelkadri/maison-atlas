"use client";

import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { useFavoritesStore } from "@/stores/favorites.store";

type FavoriteButtonProps = {
  productId: string;
  productName: string;
  /** "overlay" = pastille ronde posée sur une image ; "inline" = bouton de fiche produit. */
  variant?: "overlay" | "inline";
  className?: string;
};

export function FavoriteButton({ productId, productName, variant = "overlay", className }: FavoriteButtonProps) {
  const hydrated = useHydrated();
  const isFavorite = useFavoritesStore((s) => s.productIds.includes(productId));
  const toggle = useFavoritesStore((s) => s.toggle);
  const active = hydrated && isFavorite;

  const onClick = (e: React.MouseEvent) => {
    // Le bouton est souvent posé dans une carte cliquable : ne pas naviguer.
    e.preventDefault();
    e.stopPropagation();
    const nowFavorite = toggle(productId);
    toast.success(nowFavorite ? `« ${productName} » ajouté aux favoris` : `« ${productName} » retiré des favoris`);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Retirer ${productName} des favoris` : `Ajouter ${productName} aux favoris`}
      className={cn(
        "flex items-center justify-center transition-colors",
        variant === "overlay"
          ? "bg-background/90 hover:bg-background size-9 rounded-full shadow-sm backdrop-blur"
          : "border-input hover:bg-accent size-11 rounded-md border",
        className,
      )}
    >
      <Heart className={cn("size-[1.1rem] transition-colors", active ? "fill-destructive text-destructive" : "text-foreground")} aria-hidden />
    </button>
  );
}
