import { apiFetch, apiFetchOrNull } from "@/lib/api-client";
import type { CustomerAccount } from "@/types/customer.types";
import type { CustomerOrder } from "@/types/order.types";
import type { CustomerAccountService } from "../contracts";
import { ServiceError } from "../errors";

const seg = encodeURIComponent;

/** Espace cliente : cookie de session `customer_session` (httpOnly, posé par le serveur — jamais lu par le site). */
export const apiCustomerAccountService: CustomerAccountService = {
  register: (values) => apiFetch<CustomerAccount>("/customers/register", { method: "POST", body: values }),

  login: (values) => apiFetch<CustomerAccount>("/customers/login", { method: "POST", body: values }),

  async logout() {
    await apiFetch<void>("/customers/logout", { method: "POST" });
  },

  async me() {
    try {
      return await apiFetch<CustomerAccount>("/customers/me");
    } catch (error) {
      if (error instanceof ServiceError && error.code === "UNAUTHENTICATED") return null;
      throw error;
    }
  },

  updateProfile: (values) => apiFetch<CustomerAccount>("/customers/me", { method: "PATCH", body: values }),

  changePassword: (values) => apiFetch<CustomerAccount>("/customers/me/password", { method: "POST", body: values }),

  getMyOrders: () => apiFetch<CustomerOrder[]>("/customers/me/orders"),

  getMyOrder: (orderNumber) => apiFetchOrNull<CustomerOrder>(`/customers/me/orders/${seg(orderNumber)}`),
};
