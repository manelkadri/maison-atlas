import { validatePromotion } from "@fashion/shared";
import type { Promotion } from "@/types/promotion.types";
import type { PromotionService } from "./contracts";
import { ServiceError } from "./errors";
import { commit, getDb, nextId } from "./mock/db";

function assertUniqueCode(code: string, exceptId?: string) {
  if (getDb().promotions.some((p) => p.code.toUpperCase() === code.toUpperCase() && p.id !== exceptId)) {
    throw new ServiceError("CONFLICT", `Le code « ${code} » existe déjà.`);
  }
}

export const promotionService: PromotionService = {
  async getPromotions() {
    return structuredClone([...getDb().promotions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async createPromotion(data) {
    assertUniqueCode(data.code);
    const promo: Promotion = { ...data, code: data.code.toUpperCase(), id: nextId("promo"), usageCount: 0, createdAt: new Date().toISOString() };
    getDb().promotions.unshift(promo);
    commit();
    return structuredClone(promo);
  },

  async updatePromotion(id, data) {
    const promo = getDb().promotions.find((p) => p.id === id);
    if (!promo) throw new ServiceError("NOT_FOUND", "Promotion introuvable.");
    if (data.code) assertUniqueCode(data.code, id);
    Object.assign(promo, data, data.code ? { code: data.code.toUpperCase() } : {});
    commit();
    return structuredClone(promo);
  },

  async deletePromotion(id) {
    const db = getDb();
    if (!db.promotions.some((p) => p.id === id)) throw new ServiceError("NOT_FOUND", "Promotion introuvable.");
    db.promotions = db.promotions.filter((p) => p.id !== id);
    commit();
  },

  async validateCode(code, subtotal) {
    const promo = getDb().promotions.find((p) => p.code.toUpperCase() === code.trim().toUpperCase());
    return structuredClone(validatePromotion(promo, subtotal));
  },
};
