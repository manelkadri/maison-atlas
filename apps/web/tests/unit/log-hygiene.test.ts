import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api-client";
import { ServiceError } from "@/services";

/**
 * Hygiène des journaux du site (Next.js). Constat de l'audit : le site ne journalise rien côté serveur de lui-même, ne contient
 * aucune bibliothèque de journalisation et ne met jamais le téléphone d'une cliente dans ses propres adresses. Ces tests
 * empêchent une régression : un `console.*` ajouté plus tard, la journalisation des appels `fetch` avec leur URL complète, ou un message
 * d'erreur qui recopierait l'adresse (et donc le téléphone) d'un appel d'API.
 */

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}
const rel = (file: string) => relative(ROOT, file).split(sep).join("/");

afterEach(() => vi.unstubAllGlobals());

describe("journaux de Next.js : aucune fuite possible par le code du site", () => {
  it("aucun console.* hors de la page d'erreur du NAVIGATEUR (jamais exécutée sur le serveur)", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      if (/\bconsole\.(log|info|warn|error|debug|trace|dir)\s*\(/.test(text)) offenders.push(rel(file));
    }
    // Seule exception connue et vérifiée : le composant d'erreur côté client (« use client », console du navigateur).
    expect(offenders).toEqual(["src/components/layout/status-pages.tsx"]);
    expect(readFileSync(join(SRC, "components/layout/status-pages.tsx"), "utf8").startsWith('"use client"')).toBe(true);
  });

  it("aucune bibliothèque de journalisation, d'analyse ou de suivi d'erreurs n'est installée (rien n'envoie de données à un tiers)", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const logging = names.filter((n) => /sentry|datadog|logrocket|posthog|mixpanel|segment|amplitude|hotjar|pino|winston|bunyan|@vercel\/(analytics|speed-insights)/i.test(n));
    expect(logging).toEqual([]);
  });

  it("la configuration Next.js n'active pas la journalisation des appels fetch avec leur URL complète", () => {
    const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    expect(config).not.toMatch(/logging\s*:/);
    expect(config).not.toMatch(/fullUrl/);
  });

  it("le middleware (proxy) et les services serveur ne journalisent rien", () => {
    expect(readFileSync(join(SRC, "proxy.ts"), "utf8")).not.toMatch(/console\.|logger|log\(/);
    for (const file of sourceFiles(join(SRC, "services")).concat(sourceFiles(join(SRC, "lib")))) {
      expect(readFileSync(file, "utf8"), rel(file)).not.toMatch(/\bconsole\./);
    }
  });

  it("une panne réseau d'un appel d'API ne recopie JAMAIS l'adresse appelée (téléphone et numéro de commande du suivi compris)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        throw new TypeError(`fetch failed: ${String(input)} ECONNREFUSED`);
      }),
    );
    const error = await apiFetch("/orders/track", { query: { number: "CMD-2026-000123", phone: "0555123456" } }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    const text = `${(error as Error).message} ${(error as Error).stack ?? ""} ${JSON.stringify(error)}`;
    for (const secret of ["0555123456", "555123456", "CMD-2026-000123", "orders/track"]) expect(text, secret).not.toContain(secret);
  });

  it("une erreur 5xx de la passerelle ne recopie pas non plus l'adresse appelée", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Bad gateway https://api/orders/track?phone=0555123456</html>", { status: 502 })));
    const error = await apiFetch("/orders/track", { query: { number: "CMD-2026-000123", phone: "0555123456" } }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect(`${(error as Error).message}`).not.toMatch(/0555123456|CMD-2026-000123|orders\/track/);
  });
});
