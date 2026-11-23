/**
 * `pnpm --filter @fashion/api dev:db` : lance PostgreSQL pour le développement (port 5433) et reste actif.
 * Données conservées dans apps/api/.pgdata (ignoré par git). Ctrl+C pour arrêter proprement.
 */
import { resolve } from "node:path";
import { startEmbeddedPostgres } from "./embedded-pg";

const port = Number(process.env.DEV_DB_PORT ?? 5433);
const dataDir = resolve(process.cwd(), ".pgdata");

const db = await startEmbeddedPostgres({ dataDir, port });
console.log(`\nPostgreSQL prêt sur le port ${port}`);
console.log(`DATABASE_URL="${db.url}"\n`);
console.log("Laissez cette fenêtre ouverte. Ctrl+C pour arrêter.");

const shutdown = async () => {
  console.log("\nArrêt de PostgreSQL…");
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
