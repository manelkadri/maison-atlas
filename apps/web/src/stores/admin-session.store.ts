import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * SESSION ADMIN LOCALE.
 * Mode mock : drapeau SIMULÉ — NON SÉCURISÉ (n'importe qui peut le modifier dans son navigateur).
 * Mode API : simple miroir d'affichage (e-mail du propriétaire) ; la vraie session est le cookie httpOnly
 * vérifié par le serveur (`authService.me()`), et la vraie protection est le 401 de l'API.
 */
type AdminSessionState = {
  isAuthenticated: boolean;
  email: string | null;
  login: (email: string) => void;
  logout: () => void;
};

export const useAdminSessionStore = create<AdminSessionState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      email: null,
      login: (email) => set({ isAuthenticated: true, email }),
      logout: () => set({ isAuthenticated: false, email: null }),
    }),
    { name: "fashion-admin-demo-session", storage: createJSONStorage(() => sessionStorage), version: 1 },
  ),
);
