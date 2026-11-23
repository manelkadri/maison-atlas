import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Une commande passée depuis cet appareil : le couple (numéro, téléphone) suffit à la retrouver via l'API publique de suivi. */
export type PlacedOrder = {
  orderNumber: string;
  phone: string;
  createdAt: string;
};

/** Nombre maximal de commandes mémorisées (les plus anciennes sont oubliées). */
export const MAX_PLACED_ORDERS = 50;

type PlacedOrdersState = {
  orders: PlacedOrder[];
  /** Mémorise (ou met à jour) une commande ; la plus récente passe en tête. */
  remember: (order: PlacedOrder) => void;
  forget: (orderNumber: string) => void;
  clear: () => void;
};

/**
 * COMMANDES MÉMORISÉES SUR L'APPAREIL (mode API).
 * Sans compte client, l'espace « Mes commandes » liste uniquement les commandes dont le couple
 * (numéro, téléphone) a été enregistré ici — jamais une liste par téléphone seul (fuite de données personnelles).
 * Seuls le numéro, le téléphone saisi et la date sont conservés : le détail est relu auprès du serveur.
 */
export const usePlacedOrdersStore = create<PlacedOrdersState>()(
  persist(
    (set) => ({
      orders: [],
      remember: (order) =>
        set((state) => ({
          orders: [order, ...state.orders.filter((o) => o.orderNumber !== order.orderNumber)].slice(0, MAX_PLACED_ORDERS),
        })),
      forget: (orderNumber) => set((state) => ({ orders: state.orders.filter((o) => o.orderNumber !== orderNumber) })),
      clear: () => set({ orders: [] }),
    }),
    { name: "fashion-placed-orders", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);
