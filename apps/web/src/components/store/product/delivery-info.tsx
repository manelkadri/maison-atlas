"use client";

import { formatDZD, getShippingFee } from "@fashion/shared";
import { Banknote, Building2, Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSettings } from "@/features/settings/hooks";
import type { StoreSettings } from "@/types/settings.types";

/** Wilaya d'exemple pour illustrer les tarifs (Alger). */
const EXAMPLE_WILAYA = { code: "16", name: "Alger" };

function minFee(settings: StoreSettings, key: "home" | "pickupPoint"): number {
  return Math.min(...Object.values(settings.shippingFees).map((zone) => zone[key]));
}

/** Contenu de l'accordéon « Livraison & retours » : modes, délais indicatifs, frais issus des paramètres. */
export function DeliveryInfo() {
  const { data: settings } = useSettings();

  const homeFrom = settings ? formatDZD(minFee(settings, "home")) : null;
  const pickupFrom = settings ? formatDZD(minFee(settings, "pickupPoint")) : null;
  const exampleHome = settings ? formatDZD(getShippingFee(settings, EXAMPLE_WILAYA.code, "home", 0)) : null;
  const examplePickup = settings ? formatDZD(getShippingFee(settings, EXAMPLE_WILAYA.code, "pickup_point", 0)) : null;

  return (
    <ul className="text-muted-foreground space-y-4 text-sm leading-relaxed">
      <li className="flex gap-3">
        <Home className="text-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-foreground font-medium">Livraison à domicile</p>
          <p>
            Livrée chez vous en 24 à 72 h selon la wilaya.
            {homeFrom && ` À partir de ${homeFrom}`}
            {exampleHome && ` (${EXAMPLE_WILAYA.name} : ${exampleHome})`}.
          </p>
        </div>
      </li>
      <li className="flex gap-3">
        <Building2 className="text-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-foreground font-medium">Livraison en bureau</p>
          <p>
            Retrait dans le bureau de votre choix, en 24 à 72 h selon la wilaya.
            {pickupFrom && ` À partir de ${pickupFrom}`}
            {examplePickup && ` (${EXAMPLE_WILAYA.name} : ${examplePickup})`}.
          </p>
        </div>
      </li>
      {settings && settings.freeShippingThreshold > 0 && (
        <li className="text-foreground pl-7 text-sm font-medium">Livraison offerte dès {formatDZD(settings.freeShippingThreshold)} d&apos;achats.</li>
      )}
      <li className="flex gap-3">
        <Banknote className="text-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-foreground font-medium">Paiement à la livraison</p>
          <p>Vous réglez en espèces à la réception de votre commande, après l&apos;avoir vérifiée. Aucun paiement en ligne.</p>
        </div>
      </li>
      <li className="flex gap-3">
        <RotateCcw className="text-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-foreground font-medium">Retours &amp; échanges</p>
          <p>
            Consultez nos conditions sur la page{" "}
            <Link href="/info/retours" className="text-foreground underline underline-offset-4">
              Retours &amp; échanges
            </Link>
            . Les frais de livraison sont indiqués séparément du prix des articles.
          </p>
        </div>
      </li>
    </ul>
  );
}
