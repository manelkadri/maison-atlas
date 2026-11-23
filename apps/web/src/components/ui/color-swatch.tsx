import { cn } from "@/lib/utils";

/** Pastille de couleur (bordure visible aussi pour le blanc). */
export function ColorSwatch({ color, className, title }: { color: string; className?: string; title?: string }) {
  return (
    <span
      title={title}
      aria-hidden
      className={cn("border-foreground/20 inline-block size-4 shrink-0 rounded-full border", className)}
      style={{ backgroundColor: color }}
    />
  );
}
