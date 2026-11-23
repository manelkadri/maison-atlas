import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * Image produit avec ratio fixe (pas de déformation, pas de saut de mise en page).
 * Les SVG de démonstration sont servis tels quels ; les futures images Cloudinary passent par l'optimiseur Next.
 */
export function ProductImage({
  src,
  alt,
  ratio = "4/5",
  className,
  ...props
}: Omit<ImageProps, "fill" | "width" | "height"> & { ratio?: "4/5" | "1/1" | "3/4" | "16/9" | "3/2" }) {
  return (
    <div className={cn("bg-secondary relative overflow-hidden", className)} style={{ aspectRatio: ratio.replace("/", " / ") }}>
      <Image src={src} alt={alt} fill sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" className="object-cover" {...props} />
    </div>
  );
}
