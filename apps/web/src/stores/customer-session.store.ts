import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CustomerProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  wilayaCode?: string;
  commune?: string;
  address?: string;
};

/**
 * ESPACE CLIENT SIMULÉ — NON SÉCURISÉ.
 * Le "compte" est identifié par un simple numéro de téléphone saisi dans le navigateur, sans mot de passe
 * ni vérification. Ne jamais l'utiliser pour protéger des données réelles : l'authentification réelle
 * (OTP SMS ou e-mail + mot de passe) sera fournie par le backend en phase 2.
 */
type CustomerSessionState = {
  profile: CustomerProfile | null;
  signIn: (profile: CustomerProfile) => void;
  updateProfile: (patch: Partial<CustomerProfile>) => void;
  signOut: () => void;
};

export const useCustomerSessionStore = create<CustomerSessionState>()(
  persist(
    (set) => ({
      profile: null,
      signIn: (profile) => set({ profile }),
      updateProfile: (patch) => set((state) => (state.profile ? { profile: { ...state.profile, ...patch } } : state)),
      signOut: () => set({ profile: null }),
    }),
    { name: "fashion-customer-demo-session", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);
