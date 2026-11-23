import { ORDER_STATUS_LABELS } from "@fashion/shared";
import type { OrderStatus } from "@/types/order.types";
import type { StockStatus } from "@/types/product.types";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-destructive-soft text-destructive border-transparent",
  info: "bg-info-soft text-info border-transparent",
  brand: "bg-brand-soft text-brand border-transparent",
};

export function ToneBadge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

const orderTone: Record<OrderStatus, Tone> = {
  pending: "warning",
  confirmed: "info",
  processing: "info",
  shipped: "brand",
  delivered: "success",
  cancelled: "neutral",
  rejected: "danger",
  delivery_failed: "danger",
  returned: "neutral",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <ToneBadge tone={orderTone[status]} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {ORDER_STATUS_LABELS[status]}
    </ToneBadge>
  );
}

const stockLabels: Record<StockStatus, string> = { available: "Disponible", low: "Stock faible", out_of_stock: "Rupture" };
const stockTone: Record<StockStatus, Tone> = { available: "success", low: "warning", out_of_stock: "danger" };

export function StockStatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <ToneBadge tone={stockTone[status]} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {stockLabels[status]}
    </ToneBadge>
  );
}
