import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { categoryHref, getChildCategories, getRootCategories } from "@/components/layout/category-links";
import { EmptyState } from "@/components/ui/empty-state";
import { siteConfig } from "@/config/site";
import { categoryService } from "@/services";

export const metadata: Metadata = {
  title: "Catégories",
  description: `Parcourez toutes les catégories ${siteConfig.name} : femme, homme, accessoires et nouveautés.`,
  alternates: { canonical: "/categories" },
  openGraph: { title: `Catégories | ${siteConfig.name}`, description: "Toutes nos catégories de vêtements et d'accessoires.", url: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await categoryService.getCategories();
  const roots = getRootCategories(categories);

  return (
    <div className="container-store py-12 lg:py-16">
      <header className="reveal max-w-2xl">
        <p className="eyebrow">Boutique</p>
        <h1 className="font-display mt-3 text-3xl sm:text-5xl">Toutes les catégories</h1>
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed">Choisissez un univers, puis affinez par type de pièce.</p>
      </header>

      {roots.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="Aucune catégorie pour le moment"
          description="Le catalogue est en cours de préparation."
          action={
            <Link href="/shop" className="text-sm font-medium underline underline-offset-4">
              Voir la boutique
            </Link>
          }
        />
      ) : (
        <ul className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((root) => {
            const children = getChildCategories(categories, root.id);
            return (
              <li key={root.id}>
                <article>
                  <Link href={categoryHref(root)} className="group block">
                    <div className="bg-secondary relative aspect-[4/3] overflow-hidden rounded-sm">
                      <Image
                        src={root.imageUrl}
                        alt={`Catégorie ${root.name}`}
                        fill
                        sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-[1.03]"
                      />
                    </div>
                    <h2 className="font-display mt-4 text-2xl group-hover:underline">{root.name}</h2>
                  </Link>
                  {root.description && <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{root.description}</p>}
                  {children.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2" aria-label={`Sous-catégories de ${root.name}`}>
                      {children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={categoryHref(child)}
                            className="hover:bg-accent inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors"
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
