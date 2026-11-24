import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startEmbeddedPostgres } from "../scripts/embedded-pg";

/** Trouve un port TCP libre (plusieurs exécutions de tests peuvent tourner en parallèle sur la machine). */
function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => res(port));
    });
    srv.on("error", rej);
  });
}

/**
 * Lance un PostgreSQL JETABLE (port libre + dossier temporaire), applique les migrations, puis expose
 * DATABASE_URL aux fichiers de test. Tout est détruit à la fin.
 */
export default async function setup() {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), "fashion-pg-"));
  const db = await startEmbeddedPostgres({ dataDir, port, database: "fashion_test", persistent: false, logFile: `${dataDir}.log` });

  process.env.DATABASE_URL = db.url;
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT = "off";
  process.env.CRON_SECRET = "test-cron-secret-0123456789";
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123456";
  process.env.WEB_ORIGIN = "http://localhost:3000";
  process.env.UPLOAD_DRIVER = "local";
  // Les tests ne doivent JAMAIS parler au vrai Cloudinary, même si apps/api/.env contient des identifiants :
  // on les vide explicitement (dotenv ne remplace pas une variable déjà définie).
  process.env.CLOUDINARY_CLOUD_NAME = "";
  process.env.CLOUDINARY_API_KEY = "";
  process.env.CLOUDINARY_API_SECRET = "";
  process.env.UPLOAD_DIR = join(dataDir, "uploads");
  process.env.LOG_LEVEL = "silent";

  const schema = resolve(__dirname, "../../../prisma/schema.prisma");
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "prisma", "migrate", "deploy", "--schema", schema], {
    cwd: resolve(__dirname, ".."),
    env: process.env,
    stdio: "pipe",
    shell: process.platform === "win32",
  });

  return async () => {
    try {
      await db.stop();
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
      rmSync(`${dataDir}.log`, { force: true });
      rmSync(`${dataDir}.log.ctl`, { force: true });
    }
  };
}
