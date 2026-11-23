import type { Metadata } from "next";
import { ProductDetail } from "@/components/store/product/product-detail";
import { buildProductJsonLd, serializeJsonLd } from "@/components/store/product/json-ld";
import { siteConfig } from "@/config/site";
import { productService } from "@/services";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await productService.getProductBySlug(slug, { onlyPublic: true });

  // Mode mock : le serveur ne voit que les données de démonstration ; un produit créé dans l'admin peut exister
  // côté navigateur. On ne répond donc pas 404 ici, mais on n'indexe pas une page que le serveur ne connaît pas.
  // Mode API : le serveur connaît tout le catalogue ; un produit absent est simplement inconnu (même traitement, inoffensif).
  // Si le serveur API est injoignable, `getProductBySlug` lève une erreur : la limite d'erreur de la boutique l'affiche.
  if (!product) {
    return { title: "Produit", robots: { index: false, follow: false } };
  }

  const description = product.description.length > 160 ? `${product.description.slice(0, 157).trimEnd()}…` : product.description;
  const image = product.images[0];
  const canonical = `/product/${product.slug}`;

  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${product.name} | ${siteConfig.name}`,
      description,
      url: canonical,
      images: image ? [{ url: image.url, alt: image.alt || product.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title: product.name, description, images: image ? [image.url] : undefined },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await productService.getProductBySlug(slug, { onlyPublic: true });
  const related = product ? await productService.getRelatedProducts(product.id, 4) : [];

  return (
    <>
      {product && (
        <script
          type="application/ld+json"
          // Contenu 100 % maîtrisé (données du catalogue, `<` neutralisé) : injection JSON-LD standard.
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(buildProductJsonLd(product, { siteUrl: siteConfig.url, brand: siteConfig.name })),
          }}
        />
      )}
      <ProductDetail slug={slug} initialProduct={product} initialRelated={related} />
    </>
  );
}
