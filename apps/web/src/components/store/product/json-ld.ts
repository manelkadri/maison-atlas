import { isProductInStock } from "@fashion/shared";
import type { Product } from "@/types/product.types";

/**
 * JSON-LD schema.org `Product`.
 * La disponibilité se lit sur le stock RÉEL des variantes (au moins une variante > 0), jamais sur un champ agrégé.
 */
export function buildProductJsonLd(product: Product, options: { siteUrl: string; brand: string; currency?: string }) {
  const base = options.siteUrl.replace(/\/$/, "");
  const url = `${base}/product/${product.slug}`;
  const currency = options.currency ?? "DZD";
  const availability = isProductInStock(product) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const prices = product.variants.map((v) => v.price);
  const low = prices.length ? Math.min(...prices) : product.price;
  const high = prices.length ? Math.max(...prices) : product.price;

  const offers =
    low === high
      ? { "@type": "Offer", url, price: low, priceCurrency: currency, availability, itemCondition: "https://schema.org/NewCondition" }
      : {
          "@type": "AggregateOffer",
          url,
          lowPrice: low,
          highPrice: high,
          priceCurrency: currency,
          offerCount: product.variants.length,
          availability,
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.reference,
    mpn: product.reference,
    image: product.images.map((im) => (im.url.startsWith("http") ? im.url : `${base}${im.url}`)),
    brand: { "@type": "Brand", name: options.brand },
    url,
    offers,
  };
}

/** Sérialisation sûre pour <script type="application/ld+json"> (neutralise `</script>`). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
