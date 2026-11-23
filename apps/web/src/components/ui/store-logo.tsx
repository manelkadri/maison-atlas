import Image from "next/image";
import { cn } from "@/lib/utils";

/** N'accepte qu'une image affichable : data-URL image, chemin local ou URL http(s) complète. */
export function isRenderableLogo(src: string | undefined): src is string {
  if (!src) return false;
  if (src.startsWith("data:image/") || (src.startsWith("/") && !src.startsWith("//"))) return true;
  try {
    const url = new URL(src);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

type StoreLogoProps = {
  logoUrl?: string;
  storeName: string;
  /** Classes du texte de repli (nom de la boutique) quand aucun logo n'est défini. */
  textClassName?: string;
  /** Classes de l'image (hauteur, largeur max…). */
  imageClassName?: string;
};

/**
 * Logo de la boutique : l'image importée dans Paramètres si elle existe, sinon le nom en texte.
 * Le nom reste exposé aux lecteurs d'écran via l'attribut `alt`.
 * `unoptimized` : le logo peut être une data-URL (import simulé) ou une URL externe quelconque.
 */
export function StoreLogo({ logoUrl, storeName, textClassName, imageClassName }: StoreLogoProps) {
  if (isRenderableLogo(logoUrl)) {
    return <Image src={logoUrl} alt={storeName} width={240} height={80} unoptimized className={cn("h-9 w-auto max-w-44 object-contain object-left", imageClassName)} />;
  }
  return <span className={textClassName}>{storeName}</span>;
}
