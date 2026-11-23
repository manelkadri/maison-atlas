import type { StockMovement } from "@/types/inventory.types";
import { createRng, daysAgo } from "./helpers";
// NB : "daysAgo(0)" = début de journée courante, utilisé comme borne haute de l'historique.
import { productsMock } from "./products.mock";

/**
 * Historique de mouvements de stock de démonstration.
 * Construit à rebours pour que la dernière valeur `quantityAfter` de chaque variante
 * soit EXACTEMENT son stock courant (cohérence stock ↔ historique).
 */
const rng = createRng(7741);

const IN_REASONS = ["Réception fournisseur", "Réassort atelier", "Nouvelle collection"];
const OUT_REASONS = ["Pièce défectueuse", "Échantillon photo", "Casse en entrepôt"];

export const stockMovementsMock: StockMovement[] = (() => {
  const movements: StockMovement[] = [];
  let n = 0;

  for (const product of productsMock) {
    for (const variant of product.variants) {
      const stock = variant.stock;
      const incoming = rng.int(8, 30);
      const sold1 = rng.int(1, 6);
      const sold2 = rng.int(0, 4);
      const lost = rng.chance(0.15) ? rng.int(1, 2) : 0;

      // start + incoming - sold1 - sold2 - lost = stock  =>  start = stock - incoming + sold1 + sold2 + lost
      const rawStart = stock - incoming + sold1 + sold2 + lost;
      const start = Math.max(0, rawStart);
      const fixedIncoming = stock - start + sold1 + sold2 + lost; // ajuste l'arrivage si start a été borné à 0

      const created = product.createdAt;
      let current = 0;
      const push = (
        type: StockMovement["type"],
        delta: number,
        reason: string,
        at: string,
        reference?: string,
      ) => {
        if (delta === 0) return;
        const before = current;
        current += delta;
        n += 1;
        movements.push({
          id: `mv_${String(n).padStart(5, "0")}`,
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
          type,
          quantityDelta: delta,
          quantityBefore: before,
          quantityAfter: current,
          reason,
          reference,
          createdAt: at,
        });
      };

      // Dates croissantes entre la création du produit et aujourd'hui : l'ordre chronologique
      // correspond à l'ordre de calcul des quantités avant/après.
      const t0 = new Date(created).getTime();
      const span = new Date(daysAgo(0)).getTime() - t0;
      const at = (fraction: number) => new Date(t0 + fraction * span).toISOString();

      push("initial", start, "Stock initial", at(0));
      push("in", fixedIncoming, rng.pick(IN_REASONS), at(0.15 + rng.next() * 0.1));
      push("sale", -sold1, "Ventes en ligne", at(0.4 + rng.next() * 0.1));
      push("sale", -sold2, "Ventes en ligne", at(0.65 + rng.next() * 0.1));
      if (lost) push("out", -lost, rng.pick(OUT_REASONS), at(0.9));
    }
  }

  return movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
})();
