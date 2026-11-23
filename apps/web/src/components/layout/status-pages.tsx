"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

function StatusLayout({ code, title, description, children }: { code: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="container-store flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow reveal">{code}</p>
      <h1 className="font-display reveal mt-4 text-4xl sm:text-5xl">{title}</h1>
      <p className="text-muted-foreground reveal mt-4 max-w-md text-base leading-relaxed">{description}</p>
      <div className="reveal mt-8 flex flex-col gap-3 sm:flex-row">{children}</div>
    </div>
  );
}

/** Contenu de la page 404 (racine et boutique). */
export function NotFoundContent() {
  return (
    <StatusLayout
      code="Erreur 404"
      title="Page introuvable"
      description={`La page que vous cherchez n'existe pas ou a été déplacée. Retrouvez toute la collection ${siteConfig.name} depuis l'accueil.`}
    >
      <Button asChild size="lg" className="h-11 px-6">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="h-11 px-6">
        <Link href="/shop">Voir la boutique</Link>
      </Button>
    </StatusLayout>
  );
}

/** Contenu de la page d'erreur (limite d'erreur Next.js). */
export function ErrorContent({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusLayout
      code="Erreur"
      title="Une erreur est survenue"
      description="Quelque chose s'est mal passé de notre côté. Vous pouvez réessayer ou revenir à l'accueil."
    >
      <Button type="button" size="lg" className="h-11 px-6" onClick={reset}>
        Réessayer
      </Button>
      <Button asChild size="lg" variant="outline" className="h-11 px-6">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </StatusLayout>
  );
}
