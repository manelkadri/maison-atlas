import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * E2E contre le VRAI serveur : site (mode API) + API Express + PostgreSQL.
 * Pré-requis (voir README) : base chargée avec `db:seed` + `db:seed:demo`, API sur :4000, site construit avec
 * NEXT_PUBLIC_DATA_SOURCE=api et lancé sur :3100. Les tests partagent une seule base : exécution séquentielle.
 */
export default defineConfig({
  testDir: "./tests/e2e-api",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure", locale: "fr-FR" },
  projects: [{ name: "api-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
