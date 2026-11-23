import { formatDZD } from "@fashion/shared";
import { cn } from "@/lib/utils";

type TotalsBreakdownProps = {
  subtotal: number;
  discount?: number;
  promoCode?: string;
  /** undefined = pas encore connu (chargement des paramètres de livraison). */
  shippingFee?: number;
  total?: number;
  totalLabel?: string;
  /** Précise le contexte du tarif (ex. « Alger · à domicile »). */
  shippingHint?: string;
  className?: string;
};

/** Sous-total, remise, livraison (toujours séparée), total. Même présentation partout (panier, checkout, confirmation). */
export function TotalsBreakdown({
  subtotal,
  discount = 0,
  promoCode,
  shippingFee,
  total,
  totalLabel = "Total estimé",
  shippingHint,
  className,
}: TotalsBreakdownProps) {
  return (
    <dl className={cn("space-y-2.5 text-sm tabular-nums", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted-foreground">Sous-total</dt>
        <dd>{formatDZD(subtotal)}</dd>
      </div>
      {discount > 0 && (
        <div className="text-success flex items-baseline justify-between gap-4">
          <dt>Remise{promoCode ? ` (${promoCode})` : ""}</dt>
          <dd>-{formatDZD(discount)}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted-foreground">
          Livraison
          {shippingHint && <span className="block text-xs">{shippingHint}</span>}
        </dt>
        <dd>{shippingFee === undefined ? "—" : shippingFee === 0 ? <span className="text-success">Offerte</span> : formatDZD(shippingFee)}</dd>
      </div>
      <div className="border-border flex items-baseline justify-between gap-4 border-t pt-3 text-base font-medium">
        <dt>{totalLabel}</dt>
        <dd className="text-lg">{total === undefined ? "—" : formatDZD(total)}</dd>
      </div>
    </dl>
  );
}
