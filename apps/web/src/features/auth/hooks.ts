"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isApiMode } from "@/lib/api-config";
import { getQueryClient } from "@/lib/query-client";
import { authService } from "@/services";
import { useAdminSessionStore } from "@/stores/admin-session.store";

/**
 * Déconnexion administrateur (barre latérale et menu du profil).
 * Mode API : le serveur efface le cookie de session ; même si l'appel échoue (serveur injoignable),
 * la session locale est vidée et le cache des données admin est purgé.
 */
export function useAdminLogout(): () => Promise<void> {
  const router = useRouter();
  const logout = useAdminSessionStore((s) => s.logout);

  return async () => {
    try {
      await authService.logout();
    } catch {
      // Déconnexion locale quoi qu'il arrive.
    }
    logout();
    if (isApiMode()) getQueryClient().clear();
    toast.success("Vous êtes déconnecté.");
    router.replace("/admin/login");
  };
}
