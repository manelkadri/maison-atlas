import Image from "next/image";
import Link from "next/link";
import { discountPercent, getProductColors, isNewProduct, isOnSale, isProductInStock } from "@fashion/shared";
import { Price } from "@/components/ui/price";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product.types";
import { FavoriteButton } from "./favorite-button";

type ProductCardProps = {
  product: Product;
  /** true pour les premières cartes visibles (LCP). */
  priority?: boolean;
  className?: string;
};

/**
 * Carte produit de la boutique : image principale, seconde image au survol, badges, prix, favoris.
 * Server Component — seul le bouton favoris est un Client Component.
 */
export function ProductCard({ product, priority = false, className }: ProductCardProps) {
  const primary = product.images[0];
  const secondary = product.images[1];
  const inStock = isProductInStock(product);
  const onSale = isOnSale(product);
  const isNew = isNewProduct(product);
  const colors = getProductColors(product);

  return (
    <article className={cn("group relative", className)}>
      <div className="bg-secondary relative aspect-[4/5] overflow-hidden rounded-sm">
        <Link href={`/product/${product.slug}`} className="absolute inset-0 z-0" aria-label={product.name}>
          {primary && (
            <Image
              src={primary.url}
              alt={primary.alt}
              fill
              priority={priority}
              sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
              className={cn(
                "object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-[1.03]",
                !inStock && "opacity-60",
              )}
            />
          )}
          {secondary && (
            <Image
              src={secondary.url}
              alt=""
              aria-hidden
              fill
              sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none"
            />
          )}
        </Link>

        <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5">
          {onSale && (
            <span className="bg-destructive text-primary-foreground rounded-sm px-2 py-0.5 text-[0.7rem] font-medium tracking-wide">
              -{discountPercent(product.compareAtPrice, product.price)}%
            </span>
          )}
          {isNew && (
            <span className="bg-foreground text-background rounded-sm px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase">
              Nouveau
            </span>
          )}
          {!inStock && (
            <span className="bg-background text-muted-foreground rounded-sm px-2 py-0.5 text-[0.7rem] font-medium tracking-wide">
              Rupture de stock
            </span>
          )}
        </div>

        <FavoriteButton productId={product.id} productName={product.name} className="absolute top-2.5 right-2.5 z-10" />
      </div>

      <div className="mt-3 space-y-1">
        <h3 className="text-sm leading-snug font-medium">
          <Link href={`/product/${product.slug}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <Price price={product.price} compareAtPrice={product.compareAtPrice} size="sm" />
        {colors.length > 1 && (
          <div className="flex items-center gap-1 pt-0.5" aria-label={`${colors.length} coloris`}>
            {colors.slice(0, 5).map((c) => (
              <span key={c.name} title={c.name} className="border-foreground/20 size-3 rounded-full border" style={{ backgroundColor: c.code }} />
            ))}
            {colors.length > 5 && <span className="text-muted-foreground text-xs">+{colors.length - 5}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="bg-secondary aspect-[4/5] animate-pulse rounded-sm" />
      <div className="mt-3 space-y-2">
        <div className="bg-secondary h-3.5 w-3/4 animate-pulse rounded" />
        <div className="bg-secondary h-3.5 w-1/3 animate-pulse rounded" />
      </div>
    </div>
  );
}
