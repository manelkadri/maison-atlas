import { ToneBadge } from "@/components/ui/status-badge";
import { MOVEMENT_TYPE_LABELS } from "@/features/inventory/logic";
import type { StockMovementType } from "@/types/inventory.types";

const TONES = {
  in: "success",
  out: "warning",
  adjustment: "info",
  sale: "neutral",
  return: "brand",
  initial: "neutral",
} as const satisfies Record<StockMovementType, "success" | "warning" | "info" | "neutral" | "brand">;

export function MovementTypeBadge({ type }: { type: StockMovementType }) {
  return <ToneBadge tone={TONES[type]}>{MOVEMENT_TYPE_LABELS[type]}</ToneBadge>;
}

/** Variation signée colorée (+ vert / − rouge). Le signe est écrit : la couleur n'est jamais seule porteuse du sens. */
export function SignedDelta({ delta }: { delta: number }) {
  const cls = delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground";
  const text = delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0";
  return <span className={`font-semibold tabular-nums ${cls}`}>{text}</span>;
}
