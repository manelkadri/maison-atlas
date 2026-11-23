"use client";

import { formatDZD } from "@fashion/shared";
import { useSettings } from "@/features/settings/hooks";
import type { StoreSettings } from "@/types/settings.types";

const ZONES = [
  { key: "1", label: "Zone 1 — Alger et wilayas proches" },
  { key: "2", label: "Zone 2 — Nord et Hauts-Plateaux" },
  { key: "3", label: "Zone 3 — Sud et wilayas éloignées" },
] as const;

/** Tarifs de livraison réels (lus dans les paramètres de la boutique, donc toujours à jour). */
export function ShippingFeesTable({ initialSettings }: { initialSettings?: StoreSettings }) {
  const { data: settings } = useSettings(initialSettings);
  if (!settings) return null;
  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[420px] text-left text-sm">
          <caption className="sr-only">Tarifs de livraison par zone</caption>
          <thead className="bg-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Zone</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">À domicile</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">En bureau</th>
            </tr>
          </thead>
          <tbody>
            {ZONES.map((zone) => (
              <tr key={zone.key} className="border-t">
                <th scope="row" className="px-4 py-3 font-normal">{zone.label}</th>
                <td className="px-4 py-3 text-right tabular-nums">{formatDZD(settings.shippingFees[zone.key].home)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatDZD(settings.shippingFees[zone.key].pickupPoint)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {settings.freeShippingThreshold > 0 && (
        <p className="text-muted-foreground mt-3 text-sm">
          Livraison offerte dès {formatDZD(settings.freeShippingThreshold)} d&apos;achats.
        </p>
      )}
    </div>
  );
}
