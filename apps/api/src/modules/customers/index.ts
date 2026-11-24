import type { CustomerSummary, Order } from "@fashion/types";
import {
  adminResetCustomerPasswordSchema,
  customerAccountLoginSchema,
  customerChangePasswordSchema,
  customerProfileUpdateSchema,
  customerRegisterSchema,
} from "@fashion/validators";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { CUSTOMER_SESSION_COOKIE } from "../../config/customer-auth";
import { requireCustomer, requireCustomerAllowPasswordChange } from "../../middlewares/customer-auth";
import { notFound } from "../../utils/errors";
import { clearCustomerSessionCookie, revokeCustomerSession, setCustomerSessionCookie } from "../../utils/customer-session";
import { clientIp } from "../../utils/ip";
import { parseBody, parseParams } from "../../utils/validate";
import { orderInclude, toOrder } from "../orders/mappers";
import { loginCustomer, registerCustomer, toCustomerAccount } from "./account";
import { changeOwnPassword, resetCustomerPasswordByAdmin, updateOwnProfile } from "./account-manage";
import { getOwnOrder, listOwnOrders } from "./own-orders";
import { EMPTY_STATS, statsFromOrders, toCustomerSummary, type CustomerStats } from "./mappers";

/** Module « customers » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

/* ───────── Compte cliente : routes PUBLIQUES (montées sur /api/customers) ─────────
 * Un visiteur non connecté garde accès à tout le site (catalogue, panier…) : seules ces routes manipulent un compte. */

const noStore = (res: Response) => res.setHeader("Cache-Control", "no-store");
const requestContext = (req: Request) => ({ ip: clientIp(req), userAgent: req.get("user-agent") });

publicRoutes.post("/register", async (req, res) => {
  const input = parseBody(customerRegisterSchema, req);
  const { customer, token } = await registerCustomer(input, requestContext(req));
  setCustomerSessionCookie(res, token);
  noStore(res);
  res.status(201).json(customer);
});

publicRoutes.post("/login", async (req, res) => {
  const input = parseBody(customerAccountLoginSchema, req);
  const { customer, token } = await loginCustomer(input, requestContext(req));
  setCustomerSessionCookie(res, token);
  noStore(res);
  res.json(customer);
});

/** Révocation RÉELLE : la ligne de session est supprimée en base, le jeton ne fonctionne plus nulle part. Toujours 204. */
publicRoutes.post("/logout", async (req, res) => {
  await revokeCustomerSession(req.cookies?.[CUSTOMER_SESSION_COOKIE] as string | undefined);
  clearCustomerSessionCookie(res);
  noStore(res);
  res.status(204).end();
});

publicRoutes.get("/me", requireCustomerAllowPasswordChange, async (req, res) => {
  const row = await prisma.customer.findUniqueOrThrow({ where: { id: req.customer!.id } });
  noStore(res);
  res.json(toCustomerAccount(row));
});

/* Toutes les routes ci-dessous : l'identité vient UNIQUEMENT de la session (`req.customer`), jamais du corps, de l'URL ni d'un en-tête. */

publicRoutes.patch("/me", requireCustomer, async (req, res) => {
  const input = parseBody(customerProfileUpdateSchema, req);
  noStore(res);
  res.json(await updateOwnProfile(req.customer!.id, input));
});

/** Change le mot de passe : ancien exigé, TOUTES les sessions révoquées, session neuve (cookie remplacé). Utilisable avant le changement obligatoire. */
publicRoutes.post("/me/password", requireCustomerAllowPasswordChange, async (req, res) => {
  const input = parseBody(customerChangePasswordSchema, req);
  const { customer, token } = await changeOwnPassword({ customerId: req.customer!.id }, input, requestContext(req));
  setCustomerSessionCookie(res, token);
  noStore(res);
  res.json(customer);
});

publicRoutes.get("/me/orders", requireCustomer, async (req, res) => {
  noStore(res);
  res.json(await listOwnOrders(req.customer!.id));
});

publicRoutes.get("/me/orders/:number", requireCustomer, async (req, res) => {
  const { number } = parseParams(z.object({ number: z.string().min(1).max(40) }), req);
  noStore(res);
  res.json(await getOwnOrder(req.customer!.id, number));
});

const idParams = z.object({ id: z.string().min(1).max(64) });

/** Statistiques de TOUS les clients en 2 requêtes d'agrégation (pas de N+1) : nombre, dernière commande, livré. */
async function loadStats(): Promise<Map<string, CustomerStats>> {
  const [all, delivered] = await Promise.all([
    prisma.order.groupBy({ by: ["customerId"], where: { customerId: { not: null } }, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { not: null }, status: "delivered" },
      _sum: { subtotal: true, discountTotal: true },
    }),
  ]);
  const spent = new Map(delivered.map((d) => [d.customerId, (d._sum.subtotal ?? 0) - (d._sum.discountTotal ?? 0)]));
  const stats = new Map<string, CustomerStats>();
  for (const a of all) {
    if (!a.customerId) continue;
    stats.set(a.customerId, { ordersCount: a._count._all, totalSpent: spent.get(a.customerId) ?? 0, lastOrderAt: a._max.createdAt });
  }
  return stats;
}

adminRoutes.get("/", async (_req, res) => {
  const [customers, stats] = await Promise.all([
    prisma.customer.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    loadStats(),
  ]);
  const body: CustomerSummary[] = customers.map((c) => toCustomerSummary(c, stats.get(c.id) ?? EMPTY_STATS));
  res.json(body);
});

adminRoutes.get("/:id", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw notFound("Client introuvable.");
  const rows = await prisma.order.findMany({
    where: { customerId: id },
    include: orderInclude,
    orderBy: [{ createdAt: "desc" }, { sequence: "desc" }],
  });
  const orders: Order[] = rows.map(toOrder);
  res.json({ customer: toCustomerSummary(customer, statsFromOrders(orders)), orders });
});

/**
 * Réinitialisation du mot de passe d'une cliente par l'administrateur (montée sur /api/admin : contrôle de l'origine +
 * `requireAdmin` déjà appliqués). Renvoie le mot de passe PROVISOIRE : affiché UNE SEULE FOIS, jamais stocké en clair ni journalisé.
 */
adminRoutes.post("/:id/reset-password", async (req, res) => {
  const { id } = parseParams(idParams, req);
  const { adminPassword } = parseBody(adminResetCustomerPasswordSchema, req);
  const result = await resetCustomerPasswordByAdmin({ adminId: req.admin!.sub, customerId: id, adminPassword, ip: clientIp(req) });
  // Jamais mis en cache (ni par le navigateur ni par un intermédiaire).
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.json({ customerId: result.customerId, temporaryPassword: result.temporaryPassword, mustChangePassword: true });
});
