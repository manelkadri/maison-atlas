import { Router } from "express";
import * as analytics from "./analytics";
import * as auth from "./auth";
import * as categories from "./categories";
import * as customers from "./customers";
import * as inventory from "./inventory";
import * as newsletter from "./newsletter";
import * as orders from "./orders";
import * as products from "./products";
import * as promotions from "./promotions";
import * as settings from "./settings";
import * as uploads from "./uploads";

/**
 * Registre des modules. Chaque module possède son dossier et exporte `publicRoutes` / `adminRoutes`.
 * Convention de chemins (contrat : docs/API_CONTRACT.md) :
 *   public : /api/<module>/…        admin : /api/admin/<module>/…
 */
const modules = { auth, products, categories, orders, inventory, customers, promotions, settings, analytics, uploads, newsletter };

export const publicRouter = Router();
export const adminRouter = Router();

for (const [name, mod] of Object.entries(modules)) {
  publicRouter.use(`/${name}`, mod.publicRoutes);
  adminRouter.use(`/${name}`, mod.adminRoutes);
}
