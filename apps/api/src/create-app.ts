import compression from "compression";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { resolve } from "node:path";
import { env, isTest } from "./config/env";
import { requireAdmin } from "./middlewares/auth";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { csrfOriginCheck } from "./middlewares/security";
import { adminRouter, publicRouter } from "./modules";

/**
 * Fabrique l'application Express (sans écouter sur un port : les tests l'utilisent directement).
 *
 *   /api/health              état du service
 *   /api/...                 routes PUBLIQUES (catalogue, commande, suivi…)
 *   /api/admin/...           routes ADMIN : cookie de session httpOnly obligatoire (requireAdmin)
 *   /uploads/...             fichiers du driver d'upload « local » (développement)
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  // Derrière un proxy (Next rewrite, reverse proxy) : nécessaire pour la vraie IP des limiteurs de débit.
  app.set("trust proxy", 1);

  app.use(pinoHttp({ level: isTest ? "silent" : env.LOG_LEVEL, redact: ["req.headers.cookie", "req.headers.authorization"] }));
  app.use(
    helmet({
      // Les images /uploads sont affichées par le site web (origine différente en développement).
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  if (env.UPLOAD_DRIVER === "local") {
    app.use("/uploads", express.static(resolve(process.cwd(), env.UPLOAD_DIR), { maxAge: "7d", index: false, dotfiles: "deny" }));
  }

  app.use("/api", csrfOriginCheck, publicRouter);
  app.use("/api/admin", csrfOriginCheck, requireAdmin, adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
