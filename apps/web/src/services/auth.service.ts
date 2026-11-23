import { useAdminSessionStore } from "@/stores/admin-session.store";
import type { AuthService } from "./contracts";

/**
 * Authentification SIMULÉE (mode mock) — NON SÉCURISÉE.
 * Tout e-mail et tout mot de passe sont acceptés ; la « session » est le drapeau du store local.
 * Le vrai service est `services/api/auth.api.ts` (cookie httpOnly posé par le serveur).
 */
export const authService: AuthService = {
  async login(email) {
    // Petite latence pour reproduire une vraie requête (état de chargement visible).
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { email };
  },

  async logout() {
    useAdminSessionStore.getState().logout();
  },

  async me() {
    const { isAuthenticated, email } = useAdminSessionStore.getState();
    return isAuthenticated && email ? { email } : null;
  },
};
