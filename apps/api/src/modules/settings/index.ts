import { settingsFormSchema } from "@fashion/validators";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/db";
import { parseBody } from "../../utils/validate";
import { DEFAULT_SETTINGS } from "./defaults";
import { toSettingsData, toStoreSettings } from "./mappers";

/**
 * PATCH : mêmes règles que le formulaire d'administration, tous les champs étant optionnels.
 * `currency` est accepté (le client renvoie souvent l'objet complet) mais seulement s'il vaut "DZD" ; il n'est jamais stocké.
 */
const settingsPatchSchema = settingsFormSchema.partial().extend({ currency: z.literal("DZD").optional() });

/** Lit la ligne unique (id = 1) ; la crée avec les valeurs par défaut si elle n'existe pas encore. */
export async function getOrCreateSettings() {
  const row = await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...toSettingsData(DEFAULT_SETTINGS) } });
  return toStoreSettings(row);
}

/** Module « settings » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

publicRoutes.get("/", async (_req, res) => {
  res.json(await getOrCreateSettings());
});

adminRoutes.patch("/", async (req, res) => {
  const { currency: _ignored, ...patch } = parseBody(settingsPatchSchema, req);
  const { currency: _dzd, ...current } = await getOrCreateSettings();
  const row = await prisma.storeSettings.update({ where: { id: 1 }, data: toSettingsData({ ...current, ...patch }) });
  res.json(toStoreSettings(row));
});
