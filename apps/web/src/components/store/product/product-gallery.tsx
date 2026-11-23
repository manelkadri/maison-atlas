"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/product.types";

type ProductGalleryProps = {
  images: ProductImage[];
  productName: string;
  className?: string;
};

const ZOOM_SCALE = 1.7;

/**
 * Galerie : défilement tactile (scroll-snap) sur mobile, flèches clavier / boutons sur desktop,
 * miniatures cliquables et zoom léger au survol (souris, écrans larges uniquement).
 * Le parent la remonte (`key`) quand la couleur change : l'index repart à 0.
 */
export function ProductGallery({ images, productName, className }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<number | undefined>(undefined);
  const count = images.length;

  useEffect(() => () => cancelAnimationFrame(frame.current ?? 0), []);

  const goTo = useCallback(
    (target: number) => {
      const next = Math.min(Math.max(target, 0), count - 1);
      const el = scroller.current;
      if (el && el.clientWidth > 0) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
      setIndex(next);
    },
    [count],
  );

  const onScroll = () => {
    cancelAnimationFrame(frame.current ?? 0);
    frame.current = requestAnimationFrame(() => {
      const el = scroller.current;
      if (!el || el.clientWidth === 0) return;
      setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(count - 1);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !window.matchMedia("(min-width: 1024px)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  if (count === 0) {
    return (
      <div className={cn("bg-secondary text-muted-foreground flex aspect-[4/5] items-center justify-center rounded-sm text-sm", className)}>
        Aucune photo disponible
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row-reverse lg:gap-4", className)}>
      <div
        className="bg-secondary group relative min-w-0 flex-1 overflow-hidden rounded-sm"
        role="region"
        aria-roledescription="carrousel"
        aria-label={`Photos de ${productName}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setZoom(null)}
      >
        <div
          ref={scroller}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth outline-offset-[-2px]"
        >
          {images.map((image, i) => (
            <div
              key={image.id}
              role="group"
              aria-roledescription="diapositive"
              aria-label={`Photo ${i + 1} sur ${count}`}
              className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden"
            >
              <Image
                src={image.url}
                alt={image.alt || `${productName}, photo ${i + 1}`}
                fill
                priority={i === 0}
                sizes="(min-width:1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-200 ease-out"
                style={
                  zoom && i === index
                    ? { transform: `scale(${ZOOM_SCALE})`, transformOrigin: `${zoom.x}% ${zoom.y}%` }
                    : undefined
                }
                draggable={false}
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Photo précédente"
              className="bg-background/90 hover:bg-background absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 disabled:hidden md:flex"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === count - 1}
              aria-label="Photo suivante"
              className="bg-background/90 hover:bg-background absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 disabled:hidden md:flex"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <p className="bg-background/90 pointer-events-none absolute right-3 bottom-3 rounded-full px-2.5 py-1 text-xs tabular-nums lg:hidden" aria-hidden>
              {index + 1} / {count}
            </p>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 py-1 lg:mx-0 lg:w-20 lg:flex-col lg:overflow-visible lg:px-0 lg:py-0" role="group" aria-label="Miniatures">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Voir la photo ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "bg-secondary relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-sm border-2 transition-colors lg:w-full",
                i === index ? "border-foreground" : "border-transparent hover:border-foreground/40",
              )}
            >
              <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
