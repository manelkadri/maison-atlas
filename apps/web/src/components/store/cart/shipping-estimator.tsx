"use client";

import { formatDZD, getShippingFee } from "@fashion/shared";
import { Building2, Home } from "lucide-react";
import { useId } from "react";
import { WilayaSelect } from "@/components/store/checkout/wilaya-select";
import { cn } from "@/lib/utils";
import type { CartShippingEstimate } from "@/stores/cart.store";
import type { DeliveryMethod } from "@/types/order.types";
import type { StoreSettings } from "@/types/settings.types";

type ShippingEstimatorProps = {
  shipping: CartShippingEstimate;
  settings: StoreSettings | undefined;
  subtotal: number;
  onChange: (patch: Partial<CartShippingEstimate>) => void;
};

const METHODS: Array<{ value: DeliveryMethod; label: string; icon: typeof Home }> = [
  { value: "home", label: "À domicile", icon: Home },
  { value: "pickup_point", label: "En bureau", icon: Building2 },
];

/** Estimation des frais de livraison : wilaya + mode. Mémorisée dans le panier, reprise au checkout. */
export function ShippingEstimator({ shipping, settings, subtotal, onChange }: ShippingEstimatorProps) {
  const id = useId();
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-wilaya`} className="text-sm font-medium">
          Estimer la livraison
        </label>
        <WilayaSelect id={`${id}-wilaya`} value={shipping.wilayaCode} onChange={(wilayaCode) => onChange({ wilayaCode })} />
      </div>

      <div role="radiogroup" aria-label="Mode de livraison" className="grid grid-cols-2 gap-2">
        {METHODS.map(({ value, label, icon: Icon }) => {
          const selected = shipping.method === value;
          const fee = settings ? getShippingFee(settings, shipping.wilayaCode, value, subtotal) : undefined;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ method: value })}
              className={cn(
                "flex min-h-14 flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selected ? "border-foreground bg-card ring-foreground ring-1" : "border-input bg-card hover:border-foreground/50",
              )}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">{fee === undefined ? "—" : fee === 0 ? "Offerte" : formatDZD(fee)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
