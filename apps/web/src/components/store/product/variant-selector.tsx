"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { ColorSwatch } from "@/components/ui/color-swatch";
import { cn } from "@/lib/utils";
import type { ColorOption, SizeChoice } from "@/features/products/variant-selection";

type ColorPickerProps = {
  options: ColorOption[];
  value: string | undefined;
  onChange: (color: string) => void;
};

/** Sélecteur de couleur : pastilles avec libellé accessible ; une couleur entièrement épuisée reste choisissable (info). */
export function ColorPicker({ options, value, onChange }: ColorPickerProps) {
  const labelId = useId();
  if (options.length === 0) return null;
  return (
    <div>
      <p id={labelId} className="mb-3 text-sm">
        <span className="text-muted-foreground">Couleur : </span>
        <span className="font-medium">{value ?? "—"}</span>
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2.5">
        {options.map((option) => {
          const selected = option.name === value;
          return (
            <button
              key={option.name}
              type="button"
              aria-pressed={selected}
              aria-label={option.soldOut ? `${option.name} (épuisée)` : option.name}
              title={option.soldOut ? `${option.name} — épuisée` : option.name}
              onClick={() => onChange(option.name)}
              className={cn(
                "relative flex size-11 items-center justify-center rounded-full border-2 transition-colors",
                selected ? "border-foreground" : "hover:border-foreground/40 border-transparent",
              )}
            >
              <ColorSwatch color={option.code} className={cn("size-8", option.soldOut && "opacity-40")} />
              {selected && (
                <Check
                  className="absolute size-4 drop-shadow"
                  style={{ color: isLight(option.code) ? "#171412" : "#ffffff" }}
                  aria-hidden
                />
              )}
              {option.soldOut && <span aria-hidden className="bg-foreground/60 absolute h-px w-8 rotate-45" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Luminance approximative : choisit un coche lisible sur la pastille. */
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return true;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

type SizePickerProps = {
  choices: SizeChoice[];
  value: string | undefined;
  onChange: (size: string) => void;
  /** Bouton « Guide des tailles » affiché à droite du libellé. */
  guide?: React.ReactNode;
  invalid?: boolean;
  id?: string;
};

/** Sélecteur de taille. Une combinaison inexistante ou épuisée ne peut pas être sélectionnée. */
export function SizePicker({ choices, value, onChange, guide, invalid, id }: SizePickerProps) {
  const labelId = useId();
  if (choices.length === 0) return null;
  return (
    <div id={id} className="scroll-mt-28">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p id={labelId} className="text-sm">
          <span className="text-muted-foreground">Taille : </span>
          <span className="font-medium">{value ?? "—"}</span>
        </p>
        {guide}
      </div>
      <div
        role="group"
        aria-labelledby={labelId}
        className={cn("flex flex-wrap gap-2", invalid && "ring-destructive/60 rounded-md ring-2 ring-offset-4")}
      >
        {choices.map((choice) => {
          const selected = choice.size === value;
          const disabled = choice.state !== "available";
          return (
            <button
              key={choice.size}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={
                choice.state === "sold_out"
                  ? `Taille ${choice.size}, épuisée`
                  : choice.state === "unavailable"
                    ? `Taille ${choice.size}, non proposée dans cette couleur`
                    : `Taille ${choice.size}`
              }
              onClick={() => onChange(choice.size)}
              className={cn(
                "relative inline-flex h-11 min-w-12 items-center justify-center rounded-md border px-3.5 text-sm transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-card hover:border-foreground/60",
                disabled && "text-muted-foreground/60 bg-muted hover:border-input cursor-not-allowed overflow-hidden",
              )}
            >
              {choice.size}
              {disabled && (
                <span aria-hidden className="bg-muted-foreground/40 pointer-events-none absolute inset-x-0 top-1/2 h-px -rotate-[24deg]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
