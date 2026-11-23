import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { env, webOrigins } from "../config/env";
import { AppError, forbidden } from "../utils/errors";

/**
 * Protection CSRF complémentaire à SameSite=Lax : une requête qui modifie des données et qui porte un en-tête
 * Origin doit venir du site web autorisé. (Les navigateurs envoient toujours Origin sur les requêtes
 * inter-sites non-GET ; les clients non navigateur n'ont pas de cookie ambiant à protéger.)
 */
export function csrfOriginCheck(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !webOrigins.includes(origin)) throw forbidden("Origine non autorisée.");
  next();
}

/** Limiteur de débit (désactivé si RATE_LIMIT=off, pour les tests). */
export function limiter(options: { windowMs: number; limit: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => env.RATE_LIMIT === "off",
    handler: (_req, _res, next) => next(new AppError(429, "RATE_LIMITED", options.message)),
  });
}

export const loginLimiter = () => limiter({ windowMs: 15 * 60_000, limit: 10, message: "Trop de tentatives de connexion. Réessayez dans quelques minutes." });
export const orderLimiter = () => limiter({ windowMs: 60 * 60_000, limit: 20, message: "Trop de commandes depuis cette adresse. Réessayez plus tard." });
export const publicWriteLimiter = () => limiter({ windowMs: 15 * 60_000, limit: 30, message: "Trop de requêtes. Réessayez dans quelques minutes." });
