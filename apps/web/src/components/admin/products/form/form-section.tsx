import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const FORM_SECTIONS = [
  { id: "section-info", label: "Informations", fields: ["name", "slug", "reference", "description", "categoryId", "gender", "tags"] },
  { id: "section-pricing", label: "Prix", fields: ["regularPrice", "promoPrice", "costPrice"] },
  { id: "section-images", label: "Images", fields: ["images"] },
  { id: "section-variants", label: "Couleurs, tailles et stock", fields: ["colors", "sizes", "variants", "defaultAlertThreshold"] },
  { id: "section-publication", label: "Publication", fields: ["isPublished", "isFeatured"] },
] as const;

export type FormSectionId = (typeof FORM_SECTIONS)[number]["id"];

/** Section du formulaire produit : ancre de navigation + titre numéroté. */
export function FormSection({
  id,
  title,
  description,
  hasError,
  children,
}: {
  id: FormSectionId;
  title: string;
  description?: string;
  hasError?: boolean;
  children: ReactNode;
}) {
  const index = FORM_SECTIONS.findIndex((s) => s.id === id) + 1;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 lg:scroll-mt-24">
      <Card className={cn("gap-5 px-4 py-5 sm:px-6", hasError && "border-destructive/50")}>
        <header className="flex items-start gap-3">
          <span aria-hidden className="bg-secondary text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {index}
          </span>
          <div>
            <h2 id={`${id}-title`} className="text-base font-semibold">
              {title}
            </h2>
            {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
          </div>
        </header>
        {children}
      </Card>
    </section>
  );
}
