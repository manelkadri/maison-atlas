import { validatePromotion } from "@fashion/shared";
import type { Promotion, PromotionValidation } from "@fashion/types";
import { promotionFormSchema } from "@fashion/validators";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { publicWriteLimiter } from "../../middlewares/security";
import { conflict, notFound, validation } from "../../utils/errors";
import { parseBody, parseParams } from "../../utils/validate";
import { toPromotion } from "./mappers";

/** Module « promotions » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

const idParams = z.object({ id: z.string().min(1).max(64) });

/** Corps de PATCH : tous les champs sont facultatifs ; le résultat fusionné est revalidé par `promotionFormSchema`. */
const patchSchema = z.object({
  code: z.string().max(60),
  label: z.string().max(200),
  type: z.enum(["percentage", "fixed"]),
  value: z.number(),
  startsAt: z.string().max(40),
  endsAt: z.string().max(40),
  minOrderAmount: z.number(),
  isActive: z.boolean(),
}).partial();

const validateBody = z.object({ code: z.string().trim().min(1).max(60), subtotal: z.number().int().min(0).max(1_000_000_000) });

/** Valide un formulaire de promotion complet (mêmes règles et messages que l'interface) et convertit les dates. */
function parseForm(input: unknown) {
  const parsed = promotionFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")} : ` : "";
    throw validation(`Promotion invalide — ${path}${issue?.message ?? "valeur incorrecte"}`, parsed.error.issues);
  }
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw validation("Dates de promotion invalides.");
  if (endsAt < startsAt) throw validation("La date de fin doit être postérieure au début.");
  return { ...parsed.data, startsAt, endsAt };
}

async function assertUniqueCode(code: string, exceptId?: string) {
  const dup = await prisma.promotion.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw conflict(`Le code « ${code} » existe déjà.`);
}

/** Une course entre deux requêtes identiques est tranchée par l'index unique : même réponse 409. */
function mapUniqueViolation(err: unknown, code: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw conflict(`Le code « ${code} » existe déjà.`);
  throw err;
}

adminRoutes.get("/", async (_req, res) => {
  const rows = await prisma.promotion.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  res.json(rows.map(toPromotion));
});

adminRoutes.post("/", async (req, res) => {
  const data = parseForm(req.body);
  await assertUniqueCode(data.code);
  try {
    const created = await prisma.promotion.create({ data });
    res.status(201).json(toPromotion(created));
  } catch (err) {
    mapUniqueViolation(err, data.code);
  }
});

adminRoutes.patch("/:id", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const patch = parseBody(patchSchema, req);
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw notFound("Promotion introuvable.");
  const current = toPromotion(existing);
  const data = parseForm({
    code: current.code,
    label: current.label,
    type: current.type,
    value: current.value,
    startsAt: current.startsAt,
    endsAt: current.endsAt,
    minOrderAmount: current.minOrderAmount,
    isActive: current.isActive,
    ...patch,
  });
  if (patch.code !== undefined) await assertUniqueCode(data.code, id);
  try {
    const updated = await prisma.promotion.update({ where: { id }, data });
    res.json(toPromotion(updated));
  } catch (err) {
    mapUniqueViolation(err, data.code);
  }
});

adminRoutes.delete("/:id", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const result = await prisma.promotion.deleteMany({ where: { id } });
  if (result.count === 0) throw notFound("Promotion introuvable.");
  res.status(204).end();
});

/**
 * Vérifie un code pour un sous-total (n'incrémente jamais l'usage). Ne renvoie que le résultat de `validatePromotion` ;
 * le compteur d'usage (donnée interne) n'est pas communiqué.
 */
publicRoutes.post("/validate", publicWriteLimiter(), async (req, res) => {
  const { code, subtotal } = parseBody(validateBody, req);
  const row = await prisma.promotion.findFirst({ where: { code: { equals: code, mode: "insensitive" } } });
  const result: PromotionValidation = validatePromotion(row ? toPromotion(row) : undefined, subtotal);
  if (!result.valid) {
    res.json(result);
    return;
  }
  const publicPromotion: Promotion = { ...result.promotion, usageCount: 0 };
  res.json({ valid: true, promotion: publicPromotion, discount: result.discount } satisfies PromotionValidation);
});
