import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { isProduction } from "../config/env";
import { AppError } from "../utils/errors";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `Route introuvable : ${req.method} ${req.path}`));
};

/** Format d'erreur unique : { error: { code, message, details? } }. Aucun détail interne n'est exposé pour les erreurs 500. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code: string = "INTERNAL";
  let message = "Une erreur interne est survenue.";
  let details: unknown;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION";
    message = err.issues[0]?.message ?? "Données invalides.";
    details = err.issues;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      code = "CONFLICT";
      message = "Cette valeur existe déjà (doublon).";
    } else if (err.code === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "Ressource introuvable.";
    } else if (err.code === "P2003") {
      status = 409;
      code = "CONFLICT";
      message = "Cette ressource est référencée ailleurs et ne peut pas être supprimée.";
    } else if (err.code === "P2010" || err.code === "P2004") {
      // Violation de contrainte CHECK (ex. stock négatif) levée par la base.
      status = 409;
      code = "CONFLICT";
      message = "Opération refusée par les règles d'intégrité de la base.";
    }
  } else if (typeof err === "object" && err !== null && "type" in err && (err as { type?: string }).type === "entity.parse.failed") {
    status = 400;
    code = "VALIDATION";
    message = "Corps JSON invalide.";
  } else if (typeof err === "object" && err !== null && "type" in err && (err as { type?: string }).type === "entity.too.large") {
    status = 413;
    code = "VALIDATION";
    message = "Corps de requête trop volumineux.";
  }

  if (status >= 500) req.log?.error({ err }, "erreur non gérée");
  else if (!isProduction) req.log?.debug({ code, message }, "erreur client");

  res.status(status).json({ error: { code, message, ...(details !== undefined && status < 500 ? { details } : {}) } });
};
