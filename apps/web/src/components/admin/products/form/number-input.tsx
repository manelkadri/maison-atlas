"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumberInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "defaultValue"> & {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  /** Valeur émise quand le champ est vidé : NaN (obligatoire), 0, ou undefined (champ facultatif). */
  whenEmpty?: "nan" | "zero" | "undefined";
  /** Texte affiché à droite (ex. « DA »). */
  suffix?: string;
};

/** Champ numérique entier contrôlé (compatible Controller RHF) : le champ vide devient NaN, 0 ou undefined selon `whenEmpty`. */
export function NumberInput({ value, onValueChange, whenEmpty = "nan", suffix, className, ...props }: NumberInputProps) {
  const display = value === undefined || Number.isNaN(value) ? "" : String(value);
  const input = (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") onValueChange(whenEmpty === "nan" ? Number.NaN : whenEmpty === "zero" ? 0 : undefined);
        else onValueChange(Number(raw));
      }}
      className={cn(suffix && "pr-10", className)}
      {...props}
    />
  );
  if (!suffix) return input;
  return (
    <div className="relative">
      {input}
      <span aria-hidden className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
        {suffix}
      </span>
    </div>
  );
}
