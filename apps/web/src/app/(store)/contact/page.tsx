import type { Metadata } from "next";
import { StoreLocation } from "@/components/store/store-location";
import { siteConfig } from "@/config/site";
import { settingsService } from "@/services";

export const metadata: Metadata = {
  title: "Nous trouver",
  description: `Adresse, horaires et plan d'accès de la boutique ${siteConfig.name}. Retrouvez-nous en magasin ou commandez en ligne.`,
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", url: "/contact", title: `Nous trouver | ${siteConfig.name}` },
};

export default async function ContactPage() {
  const settings = await settingsService.getSettings();

  // Données structurées : fiche locale de la boutique (aide au référencement local).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: settings.storeName,
    url: siteConfig.url,
    telephone: settings.phone,
    address: { "@type": "PostalAddress", streetAddress: settings.address, addressCountry: "DZ" },
  };

  return (
    <div className="container-store py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="reveal mb-10 max-w-2xl">
        <p className="eyebrow">Boutique</p>
        <h1 id="contact-title" className="font-display mt-3 text-3xl sm:text-4xl">
          Nous trouver
        </h1>
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
          Venez essayer nos pièces en magasin, ou commandez en ligne et payez à la livraison.
        </p>
      </header>
      <StoreLocation initialSettings={settings} headingId="contact-title" />
    </div>
  );
}
