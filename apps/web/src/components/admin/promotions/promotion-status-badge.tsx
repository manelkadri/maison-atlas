import { ToneBadge } from "@/components/ui/status-badge";
import { PROMOTION_STATUS_LABELS, type PromotionStatus } from "@/features/promotions/logic";

const TONES = { active: "success", scheduled: "info", expired: "neutral", inactive: "warning" } as const satisfies Record<
  PromotionStatus,
  "success" | "info" | "neutral" | "warning"
>;

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  return (
    <ToneBadge tone={TONES[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {PROMOTION_STATUS_LABELS[status]}
    </ToneBadge>
  );
}
