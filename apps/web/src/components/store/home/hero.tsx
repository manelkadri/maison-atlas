import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

/** Hero immersif plein largeur. Seul <h1> de la page d'accueil. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[72svh] items-end overflow-hidden lg:min-h-[80svh] lg:items-center">
      <Image src="/images/hero.svg" alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
      {/* Voile sombre : garantit le contraste du texte clair sur l'image. */}
      <div className="bg-foreground/45 absolute inset-0 -z-10" aria-hidden />

      <div className="container-store py-16 sm:py-24">
        <div className="text-primary-foreground max-w-xl">
          <p className="eyebrow reveal text-primary-foreground/85">Nouvelle collection</p>
          <h1 className="font-display reveal mt-4 text-4xl leading-[1.1] [animation-delay:80ms] sm:text-5xl lg:text-6xl">
            L&apos;élégance du quotidien, taillée pour durer
          </h1>
          <p className="reveal text-primary-foreground/90 mt-5 max-w-md text-base leading-relaxed [animation-delay:160ms] sm:text-lg">
            Des pièces intemporelles pour femme chez {siteConfig.name}. Commandez en ligne, payez à la réception, partout en Algérie.
          </p>
          <div className="reveal mt-8 flex flex-col gap-3 [animation-delay:240ms] sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="h-12 px-8 text-base">
              <Link href="/shop">Découvrir la collection</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground hover:text-foreground h-12 bg-transparent px-8 text-base dark:bg-transparent"
            >
              <Link href="/shop?collection=new">Voir les nouveautés</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
