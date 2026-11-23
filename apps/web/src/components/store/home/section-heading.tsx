import Link from "next/link";
import { ArrowRight } from "lucide-react";

type SectionHeadingProps = {
  id: string;
  eyebrow: string;
  title: string;
  /** Lien "Voir tout" aligné à droite. */
  action?: { label: string; href: string };
  className?: string;
};

/** En-tête de section de l'accueil : sur-titre, titre serif (h2) et lien optionnel. */
export function SectionHeading({ id, eyebrow, title, action, className }: SectionHeadingProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className ?? ""}`}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="font-display mt-2 text-3xl sm:text-4xl">
          {title}
        </h2>
      </div>
      {action && (
        <Link href={action.href} className="group inline-flex min-h-10 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline">
          {action.label}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
