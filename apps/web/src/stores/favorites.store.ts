import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type FavoritesState = {
  productIds: string[];
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
};

/** Favoris conservés localement (phase 1). Ils pourront être rattachés à un compte client plus tard. */
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      productIds: [],
      /** Retourne true si le produit est désormais en favori. */
      toggle: (productId) => {
        const has = get().productIds.includes(productId);
        set((state) => ({ productIds: has ? state.productIds.filter((id) => id !== productId) : [productId, ...state.productIds] }));
        return !has;
      },
      remove: (productId) => set((state) => ({ productIds: state.productIds.filter((id) => id !== productId) })),
      clear: () => set({ productIds: [] }),
    }),
    { name: "fashion-favorites-v1", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);
