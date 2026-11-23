import { discountPercent, formatDZD } from "@fashion/shared";
import { cn } from "@/lib/utils";

type PriceProps = {
  price: number;
  compareAtPrice?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showDiscount?: boolean;
};

const sizes = { sm: "text-sm", md: "text-base", lg: "text-xl" } as const;

/** Prix actuel + ancien prix barré. Police sans-serif tabulaire pour l'alignement des chiffres. */
export function Price({ price, compareAtPrice, size = "md", className, showDiscount = false }: PriceProps) {
  const onSale = compareAtPrice !== undefined && compareAtPrice > price;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 font-sans tabular-nums", sizes[size], className)}>
      <span className={cn("font-medium", onSale && "text-destructive")}>{formatDZD(price)}</span>
      {onSale && (
        <>
          <span className="text-muted-foreground text-[0.85em] line-through">
            <span className="sr-only">Ancien prix : </span>
            {formatDZD(compareAtPrice)}
          </span>
          {showDiscount && <span className="text-destructive text-[0.8em] font-medium">-{discountPercent(compareAtPrice, price)}%</span>}
        </>
      )}
    </span>
  );
}
