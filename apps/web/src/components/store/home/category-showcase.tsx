import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { categoryHref, getRootCategories } from "@/components/layout/category-links";
import type { Category } from "@/types/product.types";
import { SectionHeading } from "./section-heading";

/** Cartes visuelles des catégories racines (issues du service, jamais codées en dur). */
export function CategoryShowcase({ categories }: { categories: Category[] }) {
  const roots = getRootCategories(categories);
  return (
    <section aria-labelledby="home-categories" className="container-store pt-10 pb-16 sm:pt-14 sm:pb-24">
      <SectionHeading id="home-categories" eyebrow="Explorer" title="Parcourir par univers" action={{ label: "Toutes les catégories", href: "/categories" }} />
      {roots.length === 0 ? (
        <EmptyState className="mt-8" title="Les catégories arrivent bientôt" description="Découvrez en attendant l'ensemble de la boutique." action={<Link href="/shop" className="text-sm font-medium underline underline-offset-4">Voir la boutique</Link>} />
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {roots.map((category) => (
            <li key={category.id}>
              <Link href={categoryHref(category)} className="group relative block aspect-[3/4] overflow-hidden rounded-sm">
                <Image
                  src={category.imageUrl}
                  alt={`Catégorie ${category.name}`}
                  fill
                  sizes="(min-width:1024px) 25vw, 50vw"
                  className="bg-secondary object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-[1.04]"
                />
                <span className="from-foreground/60 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-4 pt-16 sm:p-5" aria-hidden />
                <span className="text-primary-foreground absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <span className="font-display block text-xl sm:text-2xl">{category.name}</span>
                  <span className="mt-1 hidden text-sm opacity-90 underline-offset-4 group-hover:underline sm:block">Découvrir</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
