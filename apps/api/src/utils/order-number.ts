import { buildOrderNumber } from "@fashion/shared";
import type { Prisma } from "@prisma/client";

type Tx = Pick<Prisma.TransactionClient, "$queryRaw">;

/**
 * Réserve le prochain numéro de séquence de commande (compteur PostgreSQL `Order.sequence`).
 * Une séquence n'est jamais annulée par un rollback : le compteur est unique même sous forte concurrence
 * (au pire, un numéro est « sauté » si la transaction échoue après coup).
 */
export async function nextOrderSequence(tx: Tx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ seq: bigint }>>`SELECT nextval(pg_get_serial_sequence('"Order"', 'sequence')) AS "seq"`;
  const seq = rows[0]?.seq;
  if (seq === undefined) throw new Error("Compteur de commandes indisponible.");
  return Number(seq);
}

/** Numéro lisible CMD-AAAA-NNNNNN dérivé du compteur. */
export const orderNumberFor = (sequence: number, date: Date = new Date()): string => buildOrderNumber(sequence, date);

/** Après une insertion avec `sequence` explicite (seed), recale le compteur pour que la suite reste unique. */
export async function syncOrderSequence(tx: Tx): Promise<void> {
  await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'sequence'), GREATEST((SELECT COALESCE(MAX("sequence"), 0) FROM "Order"), 1), (SELECT COUNT(*) > 0 FROM "Order"))`;
}
