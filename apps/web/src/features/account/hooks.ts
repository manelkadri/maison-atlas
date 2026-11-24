"use client";

import type { CustomerAccountLoginValues, CustomerChangePasswordValues, CustomerProfileUpdateValues, CustomerRegisterValues } from "@fashion/validators";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { customerAccountService, orderService, ServiceError } from "@/services";
import type { CustomerAccount } from "@/types/customer.types";

/**
 * Compte de la cliente connectée (`GET /customers/me`).
 * `data === null` ⇒ visiteur non connecté ; `undefined` tant que la requête charge. Le cookie de session est httpOnly : le site
 * ne le lit jamais, il demande seulement au serveur « qui suis-je ? ».
 */
export function useAccount() {
  return useQuery({
    queryKey: queryKeys.account.me,
    queryFn: () => customerAccountService.me(),
    staleTime: 60_000,
    retry: false,
  });
}

/** Met à jour le cache du compte et vide ce qui dépend de la session (commandes de la cliente). */
function useSessionCache() {
  const client = useQueryClient();
  return {
    set(account: CustomerAccount | null) {
      client.setQueryData(queryKeys.account.me, account);
      void client.invalidateQueries({ queryKey: queryKeys.account.orders });
    },
    clear() {
      client.setQueryData(queryKeys.account.me, null);
      client.removeQueries({ queryKey: queryKeys.account.orders });
    },
  };
}

export function useLogin() {
  const cache = useSessionCache();
  return useMutation({ mutationFn: (values: CustomerAccountLoginValues) => customerAccountService.login(values), onSuccess: cache.set });
}

export function useRegister() {
  const cache = useSessionCache();
  return useMutation({ mutationFn: (values: CustomerRegisterValues) => customerAccountService.register(values), onSuccess: cache.set });
}

/** Déconnexion : même si le serveur est injoignable, la session locale (cache) est vidée. */
export function useLogout() {
  const cache = useSessionCache();
  return useMutation({
    mutationFn: async () => {
      try {
        await customerAccountService.logout();
      } finally {
        cache.clear();
      }
    },
  });
}

export function useUpdateProfile() {
  const cache = useSessionCache();
  return useMutation({ mutationFn: (values: CustomerProfileUpdateValues) => customerAccountService.updateProfile(values), onSuccess: cache.set });
}

export function useChangePassword() {
  const cache = useSessionCache();
  return useMutation({ mutationFn: (values: CustomerChangePasswordValues) => customerAccountService.changePassword(values), onSuccess: cache.set });
}

/** Commandes de la cliente connectée (jamais d'une autre : le serveur filtre par la session). */
export function useMyOrders(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.account.orders, queryFn: () => customerAccountService.getMyOrders(), enabled, retry: false });
}

export function useMyOrder(orderNumber: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.account.order(orderNumber ?? ""),
    queryFn: () => customerAccountService.getMyOrder(orderNumber!),
    enabled: !!orderNumber && enabled,
    retry: false,
  });
}

/** Suivi public (numéro + téléphone) : déclenché à la demande, jamais mis en cache ni mémorisé. */
export function useTrackOrder() {
  return useMutation({ mutationFn: ({ orderNumber, phone }: { orderNumber: string; phone: string }) => orderService.trackOrder(orderNumber, phone) });
}

/** Le serveur demande de changer le mot de passe provisoire avant toute autre action ? */
export function isPasswordChangeRequired(error: unknown): boolean {
  return error instanceof ServiceError && error.code === "PASSWORD_CHANGE_REQUIRED";
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ServiceError && error.code === "UNAUTHENTICATED";
}
