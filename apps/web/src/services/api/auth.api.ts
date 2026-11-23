import { apiFetch } from "@/lib/api-client";
import type { AuthService } from "../contracts";
import { ServiceError } from "../errors";

export const apiAuthService: AuthService = {
  login: (email, password) => apiFetch<{ email: string }>("/auth/login", { method: "POST", body: { email, password } }),

  async logout() {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  },

  async changePassword(currentPassword, newPassword) {
    await apiFetch<void>("/admin/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
  },

  changeEmail: (currentPassword, newEmail) =>
    apiFetch<{ email: string }>("/admin/auth/change-email", { method: "POST", body: { currentPassword, newEmail } }),

  async me() {
    try {
      return await apiFetch<{ email: string }>("/auth/me");
    } catch (error) {
      if (error instanceof ServiceError && error.code === "UNAUTHENTICATED") return null;
      throw error;
    }
  },
};
