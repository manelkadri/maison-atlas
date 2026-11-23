import type { SettingsService } from "./contracts";
import { commit, getDb, resetDb } from "./mock/db";

export const settingsService: SettingsService = {
  async getSettings() {
    return structuredClone(getDb().settings);
  },

  async updateSettings(data) {
    const db = getDb();
    db.settings = { ...db.settings, ...data };
    commit();
    return structuredClone(db.settings);
  },

  async resetDemoData() {
    resetDb();
  },
};
