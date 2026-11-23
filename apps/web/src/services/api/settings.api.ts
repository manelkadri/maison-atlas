import { apiFetch } from "@/lib/api-client";
import type { StoreSettings } from "@/types/settings.types";
import type { SettingsService } from "../contracts";
import { ServiceError } from "../errors";

export const apiSettingsService: SettingsService = {
  getSettings: () => apiFetch<StoreSettings>("/settings"),

  updateSettings: (data) => apiFetch<StoreSettings>("/admin/settings", { method: "PATCH", body: data }),

  async resetDemoData() {
    throw new ServiceError("FORBIDDEN", "La réinitialisation des données de démonstration n'existe pas avec le serveur réel.");
  },
};
