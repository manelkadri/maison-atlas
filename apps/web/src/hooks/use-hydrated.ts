"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false pendant le rendu serveur ET le premier rendu client, puis true.
 * À utiliser pour afficher des données issues du localStorage (panier, favoris, session)
 * sans provoquer d'erreur d'hydratation.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
