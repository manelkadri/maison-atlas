"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Plafond = stock disponible de la variante. */
  max: number;
  size?: "sm" | "md";
  className?: string;
  label?: string;
};

export function QuantityStepper({ value, onChange, min = 1, max, size = "md", className, label = "Quantité" }: QuantityStepperProps) {
  const btn = cn(
    "text-foreground hover:bg-accent flex items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-40",
    size === "md" ? "size-11" : "size-9",
  );
  return (
    <div role="group" aria-label={label} className={cn("border-input bg-card inline-flex items-center rounded-md border", className)}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Diminuer la quantité">
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className={cn("text-center text-sm font-medium tabular-nums", size === "md" ? "w-10" : "w-8")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Augmenter la quantité">
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
