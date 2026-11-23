import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DeliveryMethod } from "@/types/order.types";

/**
 * Ligne de panier = UNE variante (couleur + taille).
 * Deux tailles ou deux couleurs d'un même produit sont deux lignes distinctes (règle n°5).
 * Les prix/stock stockés ici sont un instantané d'affichage : la commande les revalide
 * côté service au moment du checkout.
 */
export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  imageUrl: string;
  color: string;
  colorCode: string;
  size: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  /** Stock de la variante au moment de l'ajout (plafond de quantité). */
  maxStock: number;
};

export type CartShippingEstimate = {
  wilayaCode: string;
  method: DeliveryMethod;
};

type CartState = {
  items: CartItem[];
  promoCode: string | null;
  shipping: CartShippingEstimate;
  /** Retourne la quantité réellement ajoutée (0 si le stock est déjà atteint). */
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => number;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  /** Met à jour l'instantané prix/stock d'une ligne (réconciliation avec le catalogue). */
  syncItem: (variantId: string, patch: Partial<Pick<CartItem, "unitPrice" | "maxStock" | "imageUrl" | "name">>) => void;
  setPromoCode: (code: string | null) => void;
  setShipping: (shipping: Partial<CartShippingEstimate>) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      shipping: { wilayaCode: "16", method: "home" },

      addItem: (item, quantity = 1) => {
        if (item.maxStock <= 0 || quantity < 1) return 0;
        const existing = get().items.find((i) => i.variantId === item.variantId);
        const current = existing?.quantity ?? 0;
        const target = Math.min(current + quantity, item.maxStock);
        const added = target - current;
        if (added <= 0) return 0;
        set((state) => ({
          items: existing
            ? state.items.map((i) => (i.variantId === item.variantId ? { ...i, ...item, quantity: target } : i))
            : [...state.items, { ...item, quantity: target }],
        }));
        return added;
      },

      updateQuantity: (variantId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(Math.floor(quantity) || 1, i.maxStock)) } : i,
          ),
        })),

      removeItem: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),

      syncItem: (variantId, patch) =>
        set((state) => ({
          items: state.items.map((i) => {
            if (i.variantId !== variantId) return i;
            const next = { ...i, ...patch };
            return { ...next, quantity: Math.max(1, Math.min(next.quantity, Math.max(next.maxStock, 1))) };
          }),
        })),

      setPromoCode: (promoCode) => set({ promoCode }),
      setShipping: (shipping) => set((state) => ({ shipping: { ...state.shipping, ...shipping } })),
      clear: () => set({ items: [], promoCode: null }),
    }),
    {
      name: "fashion-cart-v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ items: state.items, promoCode: state.promoCode, shipping: state.shipping }),
    },
  ),
);

export const getCartSubtotal = (items: CartItem[]): number => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
export const getCartCount = (items: CartItem[]): number => items.reduce((s, i) => s + i.quantity, 0);
