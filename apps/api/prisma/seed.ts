/**
 * Seed MINIMAL de production : compte propriétaire + ligne de paramètres de la boutique. Idempotent (upsert).
 *   ADMIN_EMAIL     e-mail du propriétaire (défaut : owner@example.com)
 *   ADMIN_PASSWORD  mot de passe (≥ 12 caractères) — jamais affiché ni journalisé
 * Aucune donnée de démonstration ici (voir seed-demo.ts).
 */
import { prisma } from "../src/config/db";
import { env, isProduction } from "../src/config/env";
import { DEFAULT_SETTINGS } from "../src/modules/settings/defaults";
import { toSettingsData } from "../src/modules/settings/mappers";
import { hashPassword, validateAdminPassword } from "../src/utils/password";

async function seedSettings() {
  // `update: {}` : une configuration déjà personnalisée n'est jamais écrasée.
  await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...toSettingsData(DEFAULT_SETTINGS) } });
  console.log("Paramètres de la boutique : OK.");
}

async function seedAdmin() {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;

  if (!password) {
    if (isProduction) throw new Error("ADMIN_PASSWORD est obligatoire en production.");
    console.warn("ADMIN_PASSWORD absent : compte propriétaire non créé (définissez-le puis relancez db:seed).");
    return;
  }
  const weak = validateAdminPassword(password);
  if (weak) throw new Error(weak);

  const passwordHash = await hashPassword(password);
  await prisma.adminUser.upsert({ where: { email }, update: { passwordHash }, create: { email, passwordHash } });
  console.log(`Compte propriétaire : OK (${email}).`);

  const others = await prisma.adminUser.count({ where: { email: { not: email } } });
  if (others > 0) console.warn(`Attention : ${others} autre(s) compte(s) administrateur existent. Un seul propriétaire est attendu.`);
}

async function main() {
  await seedSettings();
  await seedAdmin();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Échec du seed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
