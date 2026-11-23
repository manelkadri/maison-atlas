"use client";

import { Truck } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SettingsFormValues } from "@fashion/validators";
import type { ShippingZone } from "@fashion/shared";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ZONE_DESCRIPTIONS, getWilayasOfZone } from "@/features/settings/logic";

const ZONES: ShippingZone[] = ["1", "2", "3"];

type Props = {
  register: UseFormRegister<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
};

/** Frais de livraison par zone (domicile / bureau), avec la liste des wilayas de chaque zone en aide. */
export function ShippingZones({ register, errors }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {ZONES.map((zone) => {
        const wilayas = getWilayasOfZone(zone);
        const zoneErrors = errors.shippingFees?.[zone];
        return (
          <fieldset key={zone} className="space-y-3 rounded-lg border p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
              <Truck className="text-muted-foreground size-4" aria-hidden /> {ZONE_DESCRIPTIONS[zone].title}
            </legend>
            <p className="text-muted-foreground text-xs">{ZONE_DESCRIPTIONS[zone].hint}</p>
            <FormField label="Domicile (DA)" htmlFor={`fee-${zone}-home`} error={zoneErrors?.home?.message}>
              <Input
                id={`fee-${zone}-home`}
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                aria-invalid={!!zoneErrors?.home}
                aria-describedby={zoneErrors?.home ? `fee-${zone}-home-error` : undefined}
                {...register(`shippingFees.${zone}.home`, { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="Bureau (DA)" htmlFor={`fee-${zone}-pickup`} error={zoneErrors?.pickupPoint?.message}>
              <Input
                id={`fee-${zone}-pickup`}
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                aria-invalid={!!zoneErrors?.pickupPoint}
                aria-describedby={zoneErrors?.pickupPoint ? `fee-${zone}-pickup-error` : undefined}
                {...register(`shippingFees.${zone}.pickupPoint`, { valueAsNumber: true })}
              />
            </FormField>
            <details className="text-xs">
              <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 min-h-8 cursor-pointer rounded py-1 focus-visible:ring-[3px]">
                {wilayas.length} wilayas dans cette zone
              </summary>
              <p className="text-muted-foreground mt-1 leading-relaxed">{wilayas.map((w) => `${w.code} ${w.name}`).join(" · ")}</p>
            </details>
          </fieldset>
        );
      })}
    </div>
  );
}
