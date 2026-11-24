import { normalizePhone } from "@fashion/shared";
import type { CustomerAccount } from "@/types/customer.types";
import type { CustomerOrder } from "@/types/order.types";
import { useCustomerSessionStore, type CustomerProfile } from "@/stores/customer-session.store";
import type { CustomerAccountService } from "./contracts";
import { ServiceError } from "./errors";
import { getDb } from "./mock/db";

/**
 * ESPACE CLIENTE SIMULÉ (mode mock) — AUCUNE SÉCURITÉ RÉELLE.
 * Le « compte » est un profil mémorisé dans le navigateur ; le mot de passe n'est ni vérifié ni stocké. Il sert uniquement à
 * développer l'interface sans serveur. L'authentification réelle est celle de l'API (`customer-account.api.ts`).
 */
const UNKNOWN = "Numéro ou mot de passe incorrect.";

function toAccount(profile: CustomerProfile): CustomerAccount {
  return {
    id: `demo-${normalizePhone(profile.phone)}`,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    ...(profile.email ? { email: profile.email } : {}),
    wilayaCode: profile.wilayaCode ?? "16",
    commune: profile.commune ?? "",
    address: profile.address ?? "",
    mustChangePassword: false,
  };
}

function current(): CustomerProfile | null {
  return useCustomerSessionStore.getState().profile;
}

function require(): CustomerProfile {
  const profile = current();
  if (!profile) throw new ServiceError("UNAUTHENTICATED", "Veuillez vous connecter.");
  return profile;
}

function ordersOf(profile: CustomerProfile): CustomerOrder[] {
  const key = normalizePhone(profile.phone);
  return structuredClone(
    getDb()
      .orders.filter((o) => normalizePhone(o.customer.phone) === key)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export const customerAccountService: CustomerAccountService = {
  async register(values) {
    const key = normalizePhone(values.phone);
    if (getDb().customers.some((c) => !c.isGuest && normalizePhone(c.phone) === key)) {
      throw new ServiceError("CONFLICT", "Impossible de créer un compte avec ces informations.");
    }
    const profile: CustomerProfile = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email ?? "",
      wilayaCode: values.wilayaCode,
      commune: values.commune,
      address: values.address,
    };
    useCustomerSessionStore.getState().signIn(profile);
    return toAccount(profile);
  },

  async login(values) {
    const key = normalizePhone(values.phone);
    const known = getDb().customers.find((c) => normalizePhone(c.phone) === key);
    if (!known) throw new ServiceError("UNAUTHENTICATED", UNKNOWN);
    const profile: CustomerProfile = {
      firstName: known.firstName,
      lastName: known.lastName,
      phone: known.phone,
      email: known.email ?? "",
      wilayaCode: known.wilayaCode,
      commune: known.commune,
      address: known.address,
    };
    useCustomerSessionStore.getState().signIn(profile);
    return toAccount(profile);
  },

  async logout() {
    useCustomerSessionStore.getState().signOut();
  },

  async me() {
    const profile = current();
    return profile ? toAccount(profile) : null;
  },

  async updateProfile(values) {
    const profile = require();
    useCustomerSessionStore.getState().updateProfile({
      ...(values.firstName !== undefined ? { firstName: values.firstName } : {}),
      ...(values.lastName !== undefined ? { lastName: values.lastName } : {}),
      ...(values.email !== undefined ? { email: values.email } : {}),
      ...(values.wilayaCode !== undefined ? { wilayaCode: values.wilayaCode } : {}),
      ...(values.commune !== undefined ? { commune: values.commune } : {}),
      ...(values.address !== undefined ? { address: values.address } : {}),
    });
    return toAccount(current() ?? profile);
  },

  async changePassword() {
    return toAccount(require()); // démonstration : aucun mot de passe réel
  },

  async getMyOrders() {
    return ordersOf(require());
  },

  async getMyOrder(orderNumber) {
    return ordersOf(require()).find((o) => o.orderNumber === orderNumber) ?? null;
  },
};
