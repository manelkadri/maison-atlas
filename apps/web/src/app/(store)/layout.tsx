import type { ReactNode } from "react";
import { StoreShell } from "@/components/layout/store-shell";

/**
 * Rendu à CHAQUE requête pour toute la boutique.
 * Avec l'API réelle, le catalogue, les stocks et les paramètres changent en permanence : une page générée
 * à la compilation figerait ces données (et obligerait l'API à tourner pendant `next build`).
 * (Une mise en cache à durée limitée — ISR — pourra être ajoutée plus tard pour la performance.)
 */
export const dynamic = "force-dynamic";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}
