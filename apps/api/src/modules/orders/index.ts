import { Router } from "express";
import { limiter, orderLimiter } from "../../middlewares/security";
import { notFound } from "../../utils/errors";
import { parseBody, parseParams, parseQuery } from "../../utils/validate";
import { idParamSchema, numberParamSchema, orderFiltersSchema, parseCreateOrder, trackQuerySchema, updateStatusSchema } from "./schemas";
import { createOrder, getOrderById, getOrderByNumber, listOrders, trackOrder, updateOrderStatus } from "./service";

/** Module « orders » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

/** Anti-énumération du suivi (numéros séquentiels + téléphone) : 60 essais / 15 min / IP. */
const trackLimiter = limiter({ windowMs: 15 * 60_000, limit: 60, message: "Trop de requêtes. Réessayez dans quelques minutes." });

publicRoutes.post("/", orderLimiter(), async (req, res) => {
  const order = await createOrder(parseCreateOrder(req.body));
  res.status(201).json(order);
});

publicRoutes.get("/track", trackLimiter, async (req, res) => {
  // Toute entrée invalide (paramètre manquant…) donne la même 404 qu'un couple inconnu : rien n'est révélé.
  const parsed = trackQuerySchema.safeParse(req.query);
  if (!parsed.success) throw notFound("Aucune commande ne correspond à ces informations.");
  res.setHeader("Cache-Control", "no-store");
  res.json(await trackOrder(parsed.data.number, parsed.data.phone));
});

adminRoutes.get("/", async (req, res) => {
  res.json(await listOrders(parseQuery(orderFiltersSchema, req)));
});

// Avant « /:id » pour que « by-number » ne soit pas pris pour un identifiant.
adminRoutes.get("/by-number/:number", async (req, res) => {
  const { number } = parseParams(numberParamSchema, req);
  const order = await getOrderByNumber(number);
  if (!order) throw notFound("Commande introuvable.");
  res.json(order);
});

adminRoutes.get("/:id", async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const order = await getOrderById(id);
  if (!order) throw notFound("Commande introuvable.");
  res.json(order);
});

adminRoutes.patch("/:id/status", async (req, res) => {
  const { id } = parseParams(idParamSchema, req);
  const { status, note } = parseBody(updateStatusSchema, req);
  res.json(await updateOrderStatus(id, status, note));
});
