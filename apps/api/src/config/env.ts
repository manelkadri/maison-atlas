import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),
  /** Secret de signature des sessions admin (≥ 32 caractères en production). */
  JWT_SECRET: z.string().default("dev-only-secret-change-me-dev-only-secret"),
  /** Durée de la session admin (heures). */
  SESSION_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  /** Origines du site web autorisées à appeler l'API (séparées par des virgules). */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  /** Compte propriétaire créé par `db:seed`. */
  ADMIN_EMAIL: z.string().email().default("owner@example.com"),
  ADMIN_PASSWORD: z.string().optional(),
  /** "local" (dev : fichiers sur disque) ou "cloudinary". */
  UPLOAD_DRIVER: z.enum(["local", "cloudinary"]).default("local"),
  UPLOAD_DIR: z.string().default("uploads"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default("maison-atlas"),
  /**
   * Secret de la tâche planifiée de nettoyage (`GET /api/internal/purge`). Vercel l'envoie en `Authorization: Bearer …` à
   * chaque appel du cron quand cette variable existe. Absent : la route répond 404 (comme si elle n'existait pas).
   */
  CRON_SECRET: z.string().min(16, "CRON_SECRET doit faire au moins 16 caractères.").optional(),
  /** "off" désactive les limiteurs de débit (tests). */
  RATE_LIMIT: z.enum(["on", "off"]).default("on"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configuration invalide :", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const webOrigins = env.WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

if (isProduction) {
  if (!env.CRON_SECRET) console.warn("CRON_SECRET absent : le nettoyage quotidien des sessions et du journal d'audit est inactif (seul le nettoyage opportuniste reste).");
  if (env.JWT_SECRET.length < 32 || env.JWT_SECRET.startsWith("dev-only")) {
    console.error("JWT_SECRET doit être un secret aléatoire d'au moins 32 caractères en production.");
    process.exit(1);
  }
  if (env.UPLOAD_DRIVER === "cloudinary" && !(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)) {
    console.error("UPLOAD_DRIVER=cloudinary exige CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET.");
    process.exit(1);
  }
}
