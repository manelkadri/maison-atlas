import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogSkeleton, CatalogView } from "@/components/store/catalog/catalog-view";
import { catalogUrl, getCatalogTitle, parseCatalogParams, serializeCatalogParams } from "@/components/store/catalog/params";
import { siteConfig } from "@/config/site";
import { categoryService, productService } from "@/services";

type ShopPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ShopPageProps): Promise<Metadata> {
  const { filters, page } = parseCatalogParams(await searchParams);
  const categories = await categoryService.getCategories();
  const title = getCatalogTitle(filters, categories);
  const category = filters.category ? categories.find((c) => c.slug === filters.category) : undefined;
  const description =
    category?.description || filters.collection
      ? `${category?.description ?? (filters.collection === "new" ? "Les dernières arrivées en boutique." : "Nos pièces en promotion.")} Paiement à la livraison partout en Algérie.`
      : siteConfig.description;

  return {
    title,
    description,
    // Une recherche interne n'a pas de valeur SEO : on l'exclut de l'index.
    robots: filters.search ? { index: false, follow: true } : undefined,
    alternates: { canonical: catalogUrl({ category: filters.category, collection: filters.collection }, page) },
    openGraph: { title: `${title} | ${siteConfig.name}`, description },
  };
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const { filters, page } = parseCatalogParams(await searchParams);
  const [initialResult, initialProducts, initialCategories] = await Promise.all([
    productService.searchProducts(filters, page, siteConfig.pageSize),
    productService.getProducts({ onlyPublic: true }),
    categoryService.getCategories(),
  ]);

  return (
    // `useSearchParams` (dans CatalogView) exige une frontière Suspense.
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogView
        initialResult={initialResult}
        initialKey={serializeCatalogParams(filters, page)}
        initialProducts={initialProducts}
        initialCategories={initialCategories}
      />
    </Suspense>
  );
}
