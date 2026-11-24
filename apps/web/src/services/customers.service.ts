import { normalizePhone } from "@fashion/shared";
import type { Customer, CustomerSummary } from "@/types/customer.types";
import type { Order } from "@/types/order.types";
import type { CustomerService } from "./contracts";
import { getDb } from "./mock/db";

function summarize(customer: Customer, orders: Order[]): CustomerSummary {
  const mine = orders.filter((o) => o.customer.customerId === customer.id);
  const lastOrderAt = mine.reduce<string | null>((latest, o) => (!latest || o.createdAt > latest ? o.createdAt : latest), null);
  return {
    ...customer,
    ordersCount: mine.length,
    // Total des achats = commandes LIVRÉES uniquement (COD : seul le livré est encaissé), hors livraison.
    totalSpent: mine.filter((o) => o.status === "delivered").reduce((s, o) => s + o.subtotal - o.discountTotal, 0),
    lastOrderAt,
  };
}

export const customerService: CustomerService = {
  async getCustomers() {
    const { customers, orders } = getDb();
    return structuredClone(customers.map((c) => summarize(c, orders)));
  },

  async getCustomerById(id) {
    const { customers, orders } = getDb();
    const customer = customers.find((c) => c.id === id);
    if (!customer) return null;
    const mine = orders.filter((o) => o.customer.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return structuredClone({ customer: summarize(customer, orders), orders: mine });
  },

  async findByPhone(phone) {
    const key = normalizePhone(phone);
    const c = getDb().customers.find((x) => normalizePhone(x.phone) === key);
    return c ? structuredClone(c) : null;
  },
};
