import { newsletterSchema } from "@fashion/validators";
import { Router } from "express";
import { prisma } from "../../config/db";
import { publicWriteLimiter } from "../../middlewares/security";
import { parseBody } from "../../utils/validate";

/** Module « newsletter » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

/** Idempotent : la réponse est identique que l'e-mail soit nouveau ou déjà inscrit (rien n'est révélé). */
publicRoutes.post("/", publicWriteLimiter(), async (req, res) => {
  const { email } = parseBody(newsletterSchema, req);
  const normalized = email.toLowerCase();
  await prisma.newsletterSubscriber.upsert({ where: { email: normalized }, update: {}, create: { email: normalized } });
  res.status(204).end();
});
