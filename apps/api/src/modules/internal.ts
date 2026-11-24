import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env";
import { notFound, unauthenticated } from "../utils/errors";
import { purgeAll } from "../utils/purge";

/**
 * Routes INTERNES (jamais appelées par le site) : tâche planifiée Vercel Cron, protégée par `CRON_SECRET`.
 * Vercel envoie `Authorization: Bearer <CRON_SECRET>` à chaque appel dès que la variable existe.
 */
export const internalRouter = Router();

const sha256 = (value: string) => createHash("sha256").update(value).digest();

internalRouter.get("/purge", async (req, res) => {
  const secret = env.CRON_SECRET;
  if (!secret) throw notFound("Route introuvable."); // non configurée : comme si elle n'existait pas
  const given = /^Bearer (.+)$/.exec(req.get("authorization") ?? "")?.[1] ?? "";
  // Comparaison à temps constant (sur des empreintes de même longueur).
  if (!timingSafeEqual(sha256(given), sha256(secret))) throw unauthenticated("Accès refusé.");
  res.setHeader("Cache-Control", "no-store");
  // Uniquement des compteurs : sessions expirées, compteurs de limitation périmés, journal d'audit au-delà de la conservation.
  // Jamais de données métier (clients, commandes, produits…).
  res.json(await purgeAll());
});
