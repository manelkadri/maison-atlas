"use client";

import { formatDZD } from "@fashion/shared";
import { AlertTriangle, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import type { CartLineIssue } from "@/features/cart/reconcile";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/stores/cart.store";

type CartLineProps = {
  item: CartItem;
  issue?: CartLineIssue;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onRemove: (item: CartItem) => void;
};

export function CartLine({ item, issue, onQuantityChange, onRemove }: CartLineProps) {
  const label = `${item.name} (${item.color}, taille ${item.size})`;
  const blocked = !!issue;

  return (
    <li className="flex gap-4 py-5 first:pt-0 sm:gap-6">
      <Link
        href={`/product/${item.slug}`}
        className={cn("bg-secondary relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-sm sm:w-32", blocked && "opacity-60")}
        aria-label={`Voir la fiche : ${item.name}`}
      >
        {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill sizes="(min-width:640px) 128px, 96px" className="object-cover" />}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm leading-snug font-medium sm:text-base">
              <Link href={`/product/${item.slug}`} className="hover:underline">
                {item.name}
              </Link>
            </h3>
            <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <ColorSwatch color={item.colorCode} />
                {item.color}
              </span>
              <span aria-hidden>·</span>
              <span>Taille {item.size}</span>
            </p>
            <p className="text-muted-foreground mt-1 text-sm tabular-nums">{formatDZD(item.unitPrice)} l&apos;unité</p>
          </div>
          <p className={cn("shrink-0 text-sm font-medium tabular-nums sm:text-base", blocked && "text-muted-foreground line-through")}>
            {formatDZD(item.unitPrice * item.quantity)}
          </p>
        </div>

        {issue && (
          <p role="alert" className="text-destructive mt-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {issue.kind === "out_of_stock" ? "Cet article est en rupture de stock." : "Cet article n'est plus disponible."} Retirez-le pour continuer.
            </span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
          <QuantityStepper
            size="md"
            label={`Quantité de ${label}`}
            value={item.quantity}
            max={Math.max(item.maxStock, 1)}
            onChange={(q) => onQuantityChange(item.variantId, q)}
            className={cn(blocked && "pointer-events-none opacity-50")}
          />
          <div className="flex items-center gap-3">
            {!blocked && item.quantity >= item.maxStock && (
              <p className="text-warning text-xs">Stock maximum atteint</p>
            )}
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`Supprimer ${label} du panier`}
              className="text-muted-foreground hover:text-destructive inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm transition-colors"
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="hidden sm:inline">Supprimer</span>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
