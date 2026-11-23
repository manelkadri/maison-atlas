import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { execFileSync, spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export type EmbeddedDb = {
  url: string;
  stop: () => Promise<void>;
};

/** Retrouve pg_ctl dans le paquet binaire de la plateforme (ex. @embedded-postgres/windows-x64). */
function findPgCtl(): string {
  const requireFromLib = createRequire(createRequire(import.meta.url).resolve("embedded-postgres"));
  const platformPkg = `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
  // Le paquet n'exporte pas son package.json : on part de son point d'entrée et on remonte jusqu'au dossier `native`.
  let dir = dirname(requireFromLib.resolve(platformPkg));
  while (!existsSync(join(dir, "native")) && dirname(dir) !== dir) dir = dirname(dir);
  const bin = join(dir, "native", "bin");
  const exe = readdirSync(bin).find((f) => f === "pg_ctl" || f === "pg_ctl.exe");
  if (!exe) throw new Error(`pg_ctl introuvable dans ${bin}`);
  return join(bin, exe);
}

/**
 * Démarre un VRAI PostgreSQL (binaires embarqués, aucune installation requise) pour le développement
 * et les tests. En production, on utilise simplement DATABASE_URL vers un PostgreSQL géré.
 *
 * Windows : postgres.exe refuse de tourner sous un compte administrateur. `pg_ctl` relance le serveur
 * avec un jeton restreint, c'est donc lui qui démarre/arrête le serveur sur cette plateforme.
 */
export async function startEmbeddedPostgres(options: {
  dataDir: string;
  port: number;
  database?: string;
  user?: string;
  password?: string;
  /** false = répertoire jetable (tests) ; true = base persistante (développement). */
  persistent?: boolean;
  logFile?: string;
}): Promise<EmbeddedDb> {
  const { dataDir, port, database = "fashion", user = "fashion", password = "fashion", persistent = true, logFile } = options;
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent,
    // UTF-8 obligatoire (accents, noms arabes…) ; sinon initdb reprend l'encodage Windows de la machine.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });

  if (!existsSync(join(dataDir, "PG_VERSION"))) await server.initialise();

  const useCtl = process.platform === "win32";
  const pgCtl = useCtl ? findPgCtl() : "";
  // Le journal doit rester HORS du dossier de données : sous Windows PostgreSQL ne peut pas synchroniser
  // un fichier que pg_ctl garde ouvert (« sharing violation »).
  const log = logFile ?? `${dataDir}.log`;

  if (useCtl) {
    // Démarrage parfois refusé par Windows quand plusieurs serveurs se lancent en même temps : on réessaie,
    // en gardant la sortie de pg_ctl pour le diagnostic.
    const ctlOut = `${log}.ctl`;
    const attempts = 4;
    for (let attempt = 1; ; attempt++) {
      const fd = openSync(ctlOut, "a");
      const code = await new Promise<number | null>((resolve, reject) => {
        // detached + stdio vers un fichier : sinon le serveur garde les tubes du processus parent ouverts.
        const child = spawn(pgCtl, ["-D", dataDir, "-o", `-p ${port}`, "-l", log, "-w", "-t", "60", "start"], {
          stdio: ["ignore", fd, fd],
          detached: true,
          windowsHide: true,
        });
        child.on("error", reject);
        child.on("exit", resolve);
      });
      closeSync(fd);
      if (code === 0) break;
      // Arrêt best-effort d'un serveur éventuellement démarré à moitié, puis nouvelle tentative.
      try {
        execFileSync(pgCtl, ["-D", dataDir, "-m", "immediate", "stop"], { stdio: "ignore", windowsHide: true });
      } catch {
        /* rien à arrêter */
      }
      if (attempt >= attempts) throw new Error(`pg_ctl start a échoué après ${attempts} tentatives (code ${code}). Voir ${ctlOut} et ${log}`);
      await new Promise((r) => setTimeout(r, 750 * attempt));
    }
  } else {
    await server.start();
  }

  // Crée la base si elle n'existe pas (connexion à la base d'administration « postgres »).
  const admin = new pg.Client({ host: "localhost", port, user, password, database: "postgres" });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${database.replace(/"/g, "")}"`);
  } finally {
    await admin.end();
  }

  return {
    url: `postgresql://${user}:${password}@localhost:${port}/${database}?schema=public`,
    stop: async () => {
      if (useCtl) execFileSync(pgCtl, ["-D", dataDir, "-m", "fast", "-w", "-t", "60", "stop"], { stdio: "ignore", windowsHide: true });
      else await server.stop();
    },
  };
}
