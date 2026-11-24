import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Bannière promotionnelle : collection de saison / promotions (photo en fond, texte foncé sur la partie claire à gauche). */
export function PromoBanner() {
  return (
    <section aria-labelledby="home-promo" className="container-store">
      <div className="bg-secondary relative isolate flex min-h-[32rem] items-end overflow-hidden rounded-sm sm:min-h-[26rem] sm:items-center">
        {/* Photo : les produits sont à droite. Sur mobile elle occupe le haut de la carte (fondu vers le texte) ; dès `sm` elle remplit tout le fond. */}
        <div className="absolute inset-x-0 top-0 -z-20 h-[44%] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:h-full sm:[mask-image:none]">
          <Image src="/images/promo.jpg" alt="" fill sizes="(min-width:1280px) 1200px, 100vw" className="object-cover object-[82%_center] sm:object-center" />
        </div>
        {/* Voile clair : garantit le contraste du texte foncé quand la carte est étroite. */}
        <div className="from-secondary/80 via-secondary/35 absolute inset-0 -z-10 hidden bg-gradient-to-r to-transparent sm:block lg:hidden" aria-hidden />
        <div className="text-foreground max-w-lg px-6 py-10 sm:px-12 sm:py-12">
          <p className="eyebrow text-foreground/75">Collection de saison</p>
          <h2 id="home-promo" className="font-display mt-3 text-3xl sm:text-4xl">
            Les prix baissent, le style reste
          </h2>
          <p className="text-foreground/80 mt-4 leading-relaxed">
            Retrouvez une sélection de pièces à prix réduits, dans la limite des stocks disponibles.
          </p>
          <Button asChild size="lg" className="mt-7 h-12 px-8">
            <Link href="/shop?collection=sale">Voir les promotions</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
