export type PromotionType = "percentage" | "fixed";

export type Promotion = {
  id: string;
  code: string;
  label: string;
  type: PromotionType;
  /** % (1-100) si percentage, montant DZD si fixed. */
  value: number;
  startsAt: string;
  endsAt: string;
  minOrderAmount: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
};

export type CreatePromotionInput = Omit<Promotion, "id" | "usageCount" | "createdAt">;
export type UpdatePromotionInput = Partial<CreatePromotionInput>;

export type PromotionValidation =
  | { valid: true; promotion: Promotion; discount: number }
  | { valid: false; reason: string };
