import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Bannière promotionnelle : collection de saison / promotions. */
export function PromoBanner() {
  return (
    <section aria-labelledby="home-promo" className="container-store">
      <div className="relative isolate flex min-h-[22rem] items-center overflow-hidden rounded-sm sm:min-h-[26rem]">
        <Image src="/images/promo.svg" alt="" fill sizes="(min-width:1280px) 1200px, 100vw" className="-z-20 object-cover" />
        <div className="bg-foreground/50 absolute inset-0 -z-10" aria-hidden />
        <div className="text-primary-foreground max-w-lg px-6 py-12 sm:px-12">
          <p className="eyebrow text-primary-foreground/85">Collection de saison</p>
          <h2 id="home-promo" className="font-display mt-3 text-3xl sm:text-4xl">
            Les prix baissent, le style reste
          </h2>
          <p className="text-primary-foreground/90 mt-4 leading-relaxed">
            Retrouvez une sélection de pièces à prix réduits, dans la limite des stocks disponibles.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-7 h-12 px-8">
            <Link href="/shop?collection=sale">Voir les promotions</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
