"use client";

import { ShoppingBag } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";

type StickyBuyBarProps = {
  /** Bloc d'achat principal : la barre apparaît quand il sort de l'écran. */
  anchorRef: RefObject<HTMLElement | null>;
  price: number;
  compareAtPrice?: number;
  /** Libellé de l'action : « Ajouter au panier » ou « Choisir une taille ». */
  actionLabel: string;
  disabled?: boolean;
  onAction: () => void;
};

/** Barre d'achat fixe (mobile uniquement), visible après défilement, masquée en bas de page pour ne rien recouvrir. */
export function StickyBuyBar({ anchorRef, price, compareAtPrice, actionLabel, disabled, onAction }: StickyBuyBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const anchorOffscreen = rect.bottom < 0 || rect.top > window.innerHeight;
      const nearPageEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
      const next = anchorOffscreen && window.scrollY > 320 && !nearPageEnd;
      setVisible((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [anchorRef]);

  if (!visible) return null;

  return (
    <div className="reveal bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden" role="region" aria-label="Achat rapide">
      <div className="container-store flex items-center justify-between gap-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Price price={price} compareAtPrice={compareAtPrice} size="md" className="shrink-0" />
        <Button type="button" className="h-11 flex-1 sm:flex-none sm:px-8" disabled={disabled} onClick={onAction}>
          <ShoppingBag aria-hidden />
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
