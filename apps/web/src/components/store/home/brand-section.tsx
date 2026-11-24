import { HandCoins, Ruler, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { siteConfig } from "@/config/site";

const values: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: "Matières soignées", text: "Des tissus choisis pour leur tenue et leur confort, lavage après lavage." },
  { icon: Ruler, title: "Coupes intemporelles", text: "Des lignes sobres qui traversent les saisons et se marient entre elles." },
  { icon: Truck, title: "Livraison partout en Algérie", text: "Dans les 69 wilayas, à domicile ou en bureau de livraison." },
  { icon: HandCoins, title: "Paiement à la réception", text: "Vous réglez en espèces à la livraison, après avoir vu votre colis." },
];

/** Section marque : identité, valeurs et engagements. */
export function BrandSection() {
  return (
    <section aria-labelledby="home-brand" className="container-store py-16 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <div className="bg-secondary relative aspect-[4/5] overflow-hidden rounded-sm lg:aspect-[5/6]">
          <Image src="/images/brand.jpg" alt={`Intérieur de la boutique ${siteConfig.name} : vêtements et accessoires pour femme`} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover object-[48%_center]" />
        </div>
        <div>
          <p className="eyebrow">La maison</p>
          <h2 id="home-brand" className="font-display mt-3 text-3xl sm:text-4xl">
            Une mode sobre, pensée pour durer
          </h2>
          <p className="text-muted-foreground mt-5 max-w-lg leading-relaxed">
            {siteConfig.name} imagine une garde-robe essentielle : peu de pièces, bien coupées, faciles à porter au quotidien comme en occasion. Chaque modèle est sélectionné
            pour sa qualité et sa longévité.
          </p>
          <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {values.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="bg-brand-soft text-brand flex size-11 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
