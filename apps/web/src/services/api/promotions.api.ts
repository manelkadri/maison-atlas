import { apiFetch } from "@/lib/api-client";
import type { Promotion, PromotionValidation } from "@/types/promotion.types";
import type { PromotionService } from "../contracts";

const seg = encodeURIComponent;

export const apiPromotionService: PromotionService = {
  getPromotions: () => apiFetch<Promotion[]>("/admin/promotions"),

  createPromotion: (data) => apiFetch<Promotion>("/admin/promotions", { method: "POST", body: data }),

  updatePromotion: (id, data) => apiFetch<Promotion>(`/admin/promotions/${seg(id)}`, { method: "PATCH", body: data }),

  async deletePromotion(id) {
    await apiFetch<void>(`/admin/promotions/${seg(id)}`, { method: "DELETE" });
  },

  validateCode: (code, subtotal) =>
    apiFetch<PromotionValidation>("/promotions/validate", { method: "POST", body: { code: code.trim(), subtotal } }),
};
