"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FORM_SECTIONS, type FormSectionId } from "./form-section";

/** Navigation par ancres entre les sections : barre horizontale collante (mobile), colonne collante (≥ lg). */
export function FormNav({ sectionsWithErrors }: { sectionsWithErrors: ReadonlySet<FormSectionId> }) {
  const [active, setActive] = useState<FormSectionId>(FORM_SECTIONS[0].id);

  // Mise en surbrillance de la section visible (scroll spy).
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id as FormSectionId);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    for (const s of FORM_SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Sections du formulaire"
      className="bg-background/95 sticky top-14 z-10 -mx-4 flex gap-1 overflow-x-auto border-b px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-20 lg:mx-0 lg:flex-col lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      {FORM_SECTIONS.map((s, i) => {
        const isActive = active === s.id;
        const hasError = sectionsWithErrors.has(s.id);
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={isActive ? "location" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
              isActive ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              hasError && "text-destructive",
            )}
          >
            <span className="text-xs tabular-nums">{i + 1}.</span>
            {s.label}
            {hasError && <span className="bg-destructive size-1.5 rounded-full" aria-hidden />}
            {hasError && <span className="sr-only">(contient des erreurs)</span>}
          </a>
        );
      })}
    </nav>
  );
}
