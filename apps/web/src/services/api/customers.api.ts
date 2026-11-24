import { apiFetch, apiFetchOrNull } from "@/lib/api-client";
import type { CustomerSummary } from "@/types/customer.types";
import type { Order } from "@/types/order.types";
import type { CustomerService } from "../contracts";

export const apiCustomerService: CustomerService = {
  getCustomers: () => apiFetch<CustomerSummary[]>("/admin/customers"),

  getCustomerById: (id) => apiFetchOrNull<{ customer: CustomerSummary; orders: Order[] }>(`/admin/customers/${encodeURIComponent(id)}`),

  async resetPassword(customerId, adminPassword) {
    const result = await apiFetch<{ customerId: string; temporaryPassword: string; mustChangePassword: true }>(
      `/admin/customers/${encodeURIComponent(customerId)}/reset-password`,
      { method: "POST", body: { adminPassword } },
    );
    return { temporaryPassword: result.temporaryPassword };
  },
};
