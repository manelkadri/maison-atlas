import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

/** Hero immersif plein largeur (photo en fond, texte foncé sur la partie claire). Seul <h1> de la page d'accueil. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-background relative isolate flex min-h-[88svh] items-end overflow-hidden sm:min-h-[72svh] lg:min-h-[80svh] lg:items-center">
      {/* Photo : le modèle est à droite. Sur mobile elle occupe le haut de la section (le texte reste en bas, sans la recouvrir) ; dès `lg` elle remplit tout le fond. */}
      <div className="absolute inset-x-0 top-0 -z-20 h-[62%] [mask-image:linear-gradient(to_bottom,black_62%,transparent)] sm:h-full sm:[mask-image:none]">
        <Image src="/images/hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[68%_30%] sm:object-[68%_35%] lg:object-[center_38%]" />
      </div>
      {/* Voile clair : garantit le contraste du texte foncé (dégradé depuis le bas sur mobile, depuis la gauche sur ordinateur). */}
      <div className="from-background via-background/55 absolute inset-0 -z-10 bg-gradient-to-t to-transparent sm:from-background/85 sm:via-background/35 lg:from-background/75 lg:via-background/25 lg:bg-gradient-to-r" aria-hidden />

      <div className="container-store py-16 sm:py-24">
        <div className="text-foreground max-w-xl">
          <p className="eyebrow reveal text-foreground/75">Nouvelle collection</p>
          <h1 className="font-display reveal mt-4 text-4xl leading-[1.1] [animation-delay:80ms] sm:text-5xl lg:text-6xl">
            L&apos;élégance du quotidien, taillée pour durer
          </h1>
          <p className="reveal text-foreground/80 mt-5 max-w-md text-base leading-relaxed [animation-delay:160ms] sm:text-lg">
            Des pièces intemporelles pour femme chez {siteConfig.name}. Commandez en ligne, payez à la réception, partout en Algérie.
          </p>
          <div className="reveal mt-8 flex flex-col gap-3 [animation-delay:240ms] sm:flex-row">
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link href="/shop">Découvrir la collection</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-foreground/60 bg-background/40 text-foreground hover:bg-foreground hover:text-background h-12 px-8 text-base backdrop-blur-sm">
              <Link href="/shop?collection=new">Voir les nouveautés</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
