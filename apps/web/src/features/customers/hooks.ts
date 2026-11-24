"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { customerService } from "@/services";

export function useCustomers() {
  return useQuery({ queryKey: queryKeys.customers.list(), queryFn: () => customerService.getCustomers() });
}

export function useCustomer(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.customers.byId(id ?? ""), queryFn: () => customerService.getCustomerById(id!), enabled: !!id });
}

/** Réinitialisation du mot de passe d'une cliente (l'administrateur ressaisit son propre mot de passe). */
export function useResetCustomerPassword() {
  return useMutation({
    mutationFn: ({ customerId, adminPassword }: { customerId: string; adminPassword: string }) => customerService.resetPassword(customerId, adminPassword),
  });
}
