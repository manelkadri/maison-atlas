import { stockMovementSchema } from "@fashion/validators";
import { z } from "zod";
import { validation } from "../../utils/errors";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = z.preprocess(blankToUndefined, z.string().trim().max(120).optional());

export const inventoryFiltersSchema = z.object({
  search: optionalText,
  productId: optionalText,
  color: optionalText,
  size: optionalText,
  status: z.preprocess(blankToUndefined, z.enum(["available", "low", "out_of_stock", "all"]).optional()),
});

export const movementFiltersSchema = z.object({ variantId: optionalText, productId: optionalText });

/** Seul le champ `date` diffère de `stockMovementSchema` (facultatif côté API : défaut = maintenant). */
const bodySchema = z.object({
  variantId: z.string().max(64),
  type: z.string(),
  quantity: z.unknown(),
  reason: z.string().max(500),
  date: z.string().max(40).optional(),
});

export type ParsedMovement = { variantId: string; type: "in" | "out" | "adjustment" | "return"; quantity: number; reason: string; date: Date | null };

/** Valide un mouvement avec `stockMovementSchema` (mêmes règles et messages que le formulaire) puis contrôle la date. */
export function parseMovement(body: unknown): ParsedMovement {
  const shape = bodySchema.safeParse(body);
  if (!shape.success) throw validation("Mouvement invalide.", shape.error.issues);
  const { date, ...rest } = shape.data;
  const parsed = stockMovementSchema.safeParse({ ...rest, date: date?.trim() || new Date().toISOString() });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")} : ` : "";
    throw validation(`Mouvement invalide — ${path}${issue?.message ?? "valeur incorrecte"}`, parsed.error.issues);
  }
  let when: Date | null = null;
  if (date?.trim()) {
    when = new Date(date);
    if (Number.isNaN(when.getTime())) throw validation("Date invalide.");
    // Même tolérance que le mock : 1 minute d'avance sur l'horloge (décalage client/serveur).
    if (when.getTime() > Date.now() + 60_000) throw validation("La date d'un mouvement ne peut pas être dans le futur.");
  }
  const { variantId, type, quantity, reason } = parsed.data;
  return { variantId, type, quantity, reason, date: when };
}
