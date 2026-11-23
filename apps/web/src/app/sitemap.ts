import type { MetadataRoute } from "next";
import { INFO_PAGES } from "@/app/(store)/info/[slug]/content";
import { categoryHref, getChildCategories, getRootCategories } from "@/components/layout/category-links";
import { siteConfig } from "@/config/site";
import { categoryService, productService } from "@/services";

const baseUrl = siteConfig.url.replace(/\/$/, "");

// Produits et catégories viennent de l'API : le plan du site est calculé à chaque requête, pas figé à la compilation.
export const dynamic = "force-dynamic";

/** Plan du site : boutique publique uniquement (jamais /admin, /cart, /checkout, /account). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Si le serveur API est injoignable (ex. construction du site sans serveur), le plan du site reste valide : pages statiques seulement.
  const [products, categories] = await Promise.all([
    productService.getProducts({ onlyPublic: true }).catch(() => []),
    categoryService.getCategories().catch(() => []),
  ]);  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
  ];

  const roots = getRootCategories(categories);
  const categoryPages: MetadataRoute.Sitemap = [...roots, ...roots.flatMap((root) => getChildCategories(categories, root.id))].map((category) => ({
    url: `${baseUrl}${categoryHref(category)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productPages: MetadataRoute.Sitemap = products
    .filter((p) => p.isPublished && !p.isArchived)
    .map((product) => ({
      url: `${baseUrl}/product/${product.slug}`,
      lastModified: new Date(product.updatedAt),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const infoPages: MetadataRoute.Sitemap = INFO_PAGES.map((page) => ({
    url: `${baseUrl}/info/${page.slug}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.3,
  }));

  return [...staticPages, ...categoryPages, ...productPages, ...infoPages];
}
