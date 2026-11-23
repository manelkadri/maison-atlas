import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Miniature d'image pour l'admin. `unoptimized` : les images « téléversées » sont des data URL ou des
 * URL externes saisies à la main (phase 1), qui ne passent pas par l'optimiseur Next.
 */
export function ProductThumb({ src, alt, className, sizes = "64px" }: { src: string | undefined; alt: string; className?: string; sizes?: string }) {
  return (
    <div className={cn("bg-secondary relative size-12 shrink-0 overflow-hidden rounded-md border", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} unoptimized className="object-cover" />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center">
          <ImageIcon className="size-4" aria-hidden />
          <span className="sr-only">Aucune image</span>
        </span>
      )}
    </div>
  );
}
