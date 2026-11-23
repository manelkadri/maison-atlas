import { apiFetch, apiFetchOrNull } from "@/lib/api-client";
import type { CustomerSummary } from "@/types/customer.types";
import type { Order } from "@/types/order.types";
import type { CustomerService } from "../contracts";

export const apiCustomerService: CustomerService = {
  getCustomers: () => apiFetch<CustomerSummary[]>("/admin/customers"),

  getCustomerById: (id) => apiFetchOrNull<{ customer: CustomerSummary; orders: Order[] }>(`/admin/customers/${encodeURIComponent(id)}`),

  /** Aucune recherche de client par téléphone côté public : ce serait une fuite de données personnelles. */
  async findByPhone() {
    return null;
  },
};
