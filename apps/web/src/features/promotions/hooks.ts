"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { promotionService } from "@/services";
import type { CreatePromotionInput, UpdatePromotionInput } from "@/types/promotion.types";

export function usePromotions() {
  return useQuery({ queryKey: queryKeys.promotions.all, queryFn: () => promotionService.getPromotions() });
}

export function useCreatePromotion() {
  return useMutation({ mutationFn: (data: CreatePromotionInput) => promotionService.createPromotion(data) });
}

export function useUpdatePromotion() {
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdatePromotionInput }) => promotionService.updatePromotion(id, data) });
}

export function useDeletePromotion() {
  return useMutation({ mutationFn: (id: string) => promotionService.deletePromotion(id) });
}

/** Vérification d'un code (panier / checkout). */
export function useValidatePromoCode() {
  return useMutation({ mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) => promotionService.validateCode(code, subtotal) });
}
