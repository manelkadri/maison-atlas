import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Product } from "@/types/product.types";
import { SectionHeading } from "./section-heading";

type ProductSectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  products: Product[];
  viewAllHref: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Fond secondaire pour alterner les sections. */
  tinted?: boolean;
};

/** Section de produits (Nouveautés, Meilleures ventes) : grille de `ProductCard` ou état vide sobre. */
export function ProductSection({ id, eyebrow, title, products, viewAllHref, emptyTitle, emptyDescription, tinted = false }: ProductSectionProps) {
  return (
    <section aria-labelledby={id} className={tinted ? "bg-background-secondary" : undefined}>
      <div className="container-store py-16 sm:py-24">
        <SectionHeading id={id} eyebrow={eyebrow} title={title} action={products.length > 0 ? { label: "Voir tout", href: viewAllHref } : undefined} />
        {products.length === 0 ? (
          <EmptyState
            className="mt-8"
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Link href="/shop" className="text-sm font-medium underline underline-offset-4">
                Parcourir la boutique
              </Link>
            }
          />
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
