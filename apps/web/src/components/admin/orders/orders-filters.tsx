"use client";

import { ORDER_STATUSES, ORDER_STATUS_LABELS, formatDate, formatDZD } from "@fashion/shared";
import { RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DELIVERY_LABELS, ORDER_SORT_LABELS, parseAmount, type OrderSort, type StatusCounts } from "@/features/orders/logic";
import { cn } from "@/lib/utils";
import type { DeliveryMethod, OrderStatus } from "@/types/order.types";

export type OrderFilterState = {
  search: string;
  delivery: DeliveryMethod | "all";
  dateFrom: string;
  dateTo: string;
  minTotal: string;
  maxTotal: string;
  sort: OrderSort;
};

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  search: "",
  delivery: "all",
  dateFrom: "",
  dateTo: "",
  minTotal: "",
  maxTotal: "",
  sort: "date_desc",
};

type Props = {
  value: OrderFilterState;
  status: OrderStatus | "all";
  counts: StatusCounts;
  onChange: (patch: Partial<OrderFilterState>) => void;
  onStatusChange: (status: OrderStatus | "all") => void;
  onReset: () => void;
};

type Chip = { key: string; label: string; clear: () => void };

function activeChips({ value, status, onChange, onStatusChange }: Props): Chip[] {
  const chips: Chip[] = [];
  if (status !== "all") chips.push({ key: "status", label: `Statut : ${ORDER_STATUS_LABELS[status]}`, clear: () => onStatusChange("all") });
  if (value.search.trim()) chips.push({ key: "search", label: `Recherche : « ${value.search.trim()} »`, clear: () => onChange({ search: "" }) });
  if (value.delivery !== "all") chips.push({ key: "delivery", label: `Livraison : ${DELIVERY_LABELS[value.delivery]}`, clear: () => onChange({ delivery: "all" }) });
  if (value.dateFrom) chips.push({ key: "from", label: `Depuis le ${formatDate(value.dateFrom)}`, clear: () => onChange({ dateFrom: "" }) });
  if (value.dateTo) chips.push({ key: "to", label: `Jusqu'au ${formatDate(value.dateTo)}`, clear: () => onChange({ dateTo: "" }) });
  const min = parseAmount(value.minTotal);
  const max = parseAmount(value.maxTotal);
  if (min !== undefined) chips.push({ key: "min", label: `Min. ${formatDZD(min)}`, clear: () => onChange({ minTotal: "" }) });
  if (max !== undefined) chips.push({ key: "max", label: `Max. ${formatDZD(max)}`, clear: () => onChange({ maxTotal: "" }) });
  return chips;
}

export function OrdersFilters(props: Props) {
  const { value, status, counts, onChange, onStatusChange, onReset } = props;
  const chips = activeChips(props);
  const rangeInvalid = !!value.dateFrom && !!value.dateTo && value.dateFrom > value.dateTo;
  const amountInvalid = parseAmount(value.minTotal) !== undefined && parseAmount(value.maxTotal) !== undefined && parseAmount(value.minTotal)! > parseAmount(value.maxTotal)!;

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={value.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="N° de commande, nom, téléphone ou wilaya"
            aria-label="Rechercher une commande"
            className="pl-9"
          />
        </div>
        <Select value={value.sort} onValueChange={(v) => onChange({ sort: v as OrderSort })}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Trier les commandes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ORDER_SORT_LABELS) as OrderSort[]).map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div role="group" aria-label="Filtrer par statut" className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {(["all", ...ORDER_STATUSES] as const).map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusChange(s)}
              className={cn(
                "focus-visible:ring-ring/50 flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:ring-[3px]",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent",
              )}
            >
              {s === "all" ? "Tous" : ORDER_STATUS_LABELS[s]}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
                {counts[s]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="col-span-2 min-w-0 space-y-1 md:col-span-1">
          <Label htmlFor="ord-delivery" className="text-muted-foreground text-xs">
            Mode de livraison
          </Label>
          <Select value={value.delivery} onValueChange={(v) => onChange({ delivery: v as DeliveryMethod | "all" })}>
            <SelectTrigger id="ord-delivery" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="home">{DELIVERY_LABELS.home}</SelectItem>
              <SelectItem value="pickup_point">{DELIVERY_LABELS.pickup_point}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="ord-from" className="text-muted-foreground text-xs">
            Du
          </Label>
          <Input id="ord-from" type="date" value={value.dateFrom} max={value.dateTo || undefined} onChange={(e) => onChange({ dateFrom: e.target.value })} aria-invalid={rangeInvalid} />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="ord-to" className="text-muted-foreground text-xs">
            Au
          </Label>
          <Input id="ord-to" type="date" value={value.dateTo} min={value.dateFrom || undefined} onChange={(e) => onChange({ dateTo: e.target.value })} aria-invalid={rangeInvalid} />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="ord-min" className="text-muted-foreground text-xs">
            Montant min. (DA)
          </Label>
          <Input id="ord-min" type="number" inputMode="numeric" min={0} step={100} value={value.minTotal} onChange={(e) => onChange({ minTotal: e.target.value })} aria-invalid={amountInvalid} />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="ord-max" className="text-muted-foreground text-xs">
            Montant max. (DA)
          </Label>
          <Input id="ord-max" type="number" inputMode="numeric" min={0} step={100} value={value.maxTotal} onChange={(e) => onChange({ maxTotal: e.target.value })} aria-invalid={amountInvalid} />
        </div>
      </div>
      {(rangeInvalid || amountInvalid) && (
        <p role="alert" className="text-destructive text-xs">
          {rangeInvalid ? "La date de début doit précéder la date de fin." : "Le montant minimum doit être inférieur au montant maximum."}
        </p>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtres actifs" role="group">
          {chips.map((c) => (
            <span key={c.key} className="bg-secondary inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-xs">
              {c.label}
              <button
                type="button"
                onClick={c.clear}
                aria-label={`Retirer le filtre : ${c.label}`}
                className="hover:bg-accent focus-visible:ring-ring/50 flex size-6 items-center justify-center rounded-full focus-visible:ring-[3px]"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw aria-hidden /> Tout réinitialiser
          </Button>
        </div>
      )}
    </div>
  );
}
