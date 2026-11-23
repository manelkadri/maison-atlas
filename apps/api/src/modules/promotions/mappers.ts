import type { Promotion } from "@fashion/types";
import type { Promotion as PromotionRow } from "@prisma/client";

export function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    type: row.type,
    value: row.value,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    minOrderAmount: row.minOrderAmount,
    isActive: row.isActive,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
  };
}
