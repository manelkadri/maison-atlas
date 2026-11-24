import type { Metadata } from "next";
import { BrandSection } from "@/components/store/home/brand-section";
import { CategoryShowcase } from "@/components/store/home/category-showcase";
import { Hero } from "@/components/store/home/hero";
import { NewsletterSection } from "@/components/store/home/newsletter-section";
import { ProductSection } from "@/components/store/home/product-section";
import { PromoBanner } from "@/components/store/home/promo-banner";
import { siteConfig } from "@/config/site";
import { categoryService, productService } from "@/services";

const title = "Mode femme & accessoires";

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — ${title}` },
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${title}`,
    description: siteConfig.description,
    images: [{ url: "/images/hero.svg", alt: `${siteConfig.name} — nouvelle collection` }],
  },
};

export default async function HomePage() {
  const [categories, newArrivals, bestSellers] = await Promise.all([
    categoryService.getCategories(),
    productService.searchProducts({ collection: "new", sort: "newest" }, 1, 8),
    productService.searchProducts({ sort: "popular" }, 1, 4),
  ]);

  return (
    <>
      <Hero />
      <CategoryShowcase categories={categories} />
      <ProductSection
        id="home-new"
        eyebrow="Fraîchement arrivé"
        title="Nouveautés"
        products={newArrivals.items}
        viewAllHref="/shop?collection=new"
        emptyTitle="Aucune nouveauté pour le moment"
        emptyDescription="Les prochaines pièces arrivent bientôt. Parcourez la boutique en attendant."
        tinted
      />
      <ProductSection
        id="home-best"
        eyebrow="Les plus aimés"
        title="Meilleures ventes"
        products={bestSellers.items}
        viewAllHref="/shop?sort=popular"
        emptyTitle="Les meilleures ventes arrivent bientôt"
        emptyDescription="Découvrez toute la collection en attendant."
      />
      <PromoBanner />
      <BrandSection />
      <NewsletterSection />
    </>
  );
}
