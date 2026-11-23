import { formatDZD } from "@fashion/shared";
import Image from "next/image";
import Link from "next/link";
import { ColorSwatch } from "@/components/ui/color-swatch";
import type { CartItem } from "@/stores/cart.store";
import type { OrderItem } from "@/types/order.types";

/** Ligne de récapitulatif en lecture seule (panier validé ou commande passée). */
export type SummaryLine = {
  key: string;
  name: string;
  href?: string;
  imageUrl: string;
  color: string;
  colorCode: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export const cartItemToLine = (item: CartItem): SummaryLine => ({
  key: item.variantId,
  name: item.name,
  href: `/product/${item.slug}`,
  imageUrl: item.imageUrl,
  color: item.color,
  colorCode: item.colorCode,
  size: item.size,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  lineTotal: item.unitPrice * item.quantity,
});

export const orderItemToLine = (item: OrderItem): SummaryLine => ({
  key: item.id,
  name: item.productName,
  href: `/product/${item.productSlug}`,
  imageUrl: item.imageUrl,
  color: item.color,
  colorCode: item.colorCode,
  size: item.size,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  lineTotal: item.lineTotal,
});

export function OrderLines({ lines }: { lines: SummaryLine[] }) {
  return (
    <ul className="divide-border divide-y" aria-label="Articles">
      {lines.map((line) => (
        <li key={line.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <div className="bg-secondary relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-sm">
            {line.imageUrl && <Image src={line.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
            <span
              className="bg-foreground text-background absolute -top-0 -right-0 flex min-w-5 items-center justify-center rounded-bl-sm px-1 text-[0.7rem] leading-5 font-medium tabular-nums"
              aria-hidden
            >
              {line.quantity}
            </span>
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="leading-snug font-medium">
              {line.href ? (
                <Link href={line.href} className="hover:underline">
                  {line.name}
                </Link>
              ) : (
                line.name
              )}
            </p>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
              <ColorSwatch color={line.colorCode} className="size-3" />
              <span>{line.color}</span>
              <span aria-hidden>·</span>
              <span>Taille {line.size}</span>
              <span aria-hidden>·</span>
              <span>
                Qté {line.quantity}
              </span>
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium tabular-nums">{formatDZD(line.lineTotal)}</p>
        </li>
      ))}
    </ul>
  );
}
