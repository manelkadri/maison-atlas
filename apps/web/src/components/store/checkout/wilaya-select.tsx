"use client";

import { WILAYAS } from "@fashion/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type WilayaSelectProps = {
  id: string;
  value: string | undefined;
  onChange: (code: string) => void;
  ref?: React.Ref<HTMLButtonElement>;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  /** Libellé accessible quand aucun `<label htmlFor>` n'est associé. */
  ariaLabel?: string;
};

/** Sélecteur de wilaya (69 wilayas) partagé par le panier (estimation) et le checkout. */
export function WilayaSelect({ id, value, onChange, ref, invalid, describedBy, className, ariaLabel }: WilayaSelectProps) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        ref={ref}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn("h-11 w-full bg-card", className)}
      >
        <SelectValue placeholder="Choisir une wilaya" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {WILAYAS.map((wilaya) => (
          <SelectItem key={wilaya.code} value={wilaya.code}>
            {wilaya.code} · {wilaya.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
