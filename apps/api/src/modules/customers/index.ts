import type { CustomerSummary, Order } from "@fashion/types";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { notFound } from "../../utils/errors";
import { parseParams } from "../../utils/validate";
import { orderInclude, toOrder } from "../orders/mappers";
import { EMPTY_STATS, statsFromOrders, toCustomerSummary, type CustomerStats } from "./mappers";

/** Module « customers » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

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
