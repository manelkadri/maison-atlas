import type { CustomerOrder } from "@fashion/types";
import { prisma } from "../../config/db";
import { notFound } from "../../utils/errors";
import { orderInclude, toCustomerOrder } from "../orders/mappers";

/**
 * Commandes d'UNE cliente, lues par SON espace client.
 *
 * Isolation : chaque requête est filtrée par `customerId`, qui vient TOUJOURS de la session côté serveur (jamais de l'URL, du
 * corps ou d'un en-tête). Une commande d'une autre cliente est indiscernable d'une commande inexistante (même 404).
 *
 * Vue cliente (`toCustomerOrder`, liste blanche) : sans prix de revient ni notes internes.
 */
/** Nombre maximal de commandes renvoyées (les plus récentes d'abord). */
export const OWN_ORDERS_LIMIT = 100;

export async function listOwnOrders(customerId: string): Promise<CustomerOrder[]> {
  const rows = await prisma.order.findMany({
    where: { customerId },
    include: orderInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: OWN_ORDERS_LIMIT,
  });
  return rows.map(toCustomerOrder);
}

export async function getOwnOrder(customerId: string, orderNumber: string): Promise<CustomerOrder> {
  const row = await prisma.order.findFirst({ where: { customerId, orderNumber: orderNumber.trim().toUpperCase() }, include: orderInclude });
  if (!row) throw notFound("Commande introuvable.");
  return toCustomerOrder(row);
}
