import { Writable } from "node:stream";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/create-app";
import { sanitizeParams, sanitizePathSegment, sanitizeQuery, sanitizeUrl } from "../src/utils/log-scrub";

/** Application dont les journaux HTTP sont capturés (mêmes options que la production). */
function loggedApp() {
  const lines: string[] = [];
  let buffer = "";
  const stream = new Writable({
    write(chunk, _enc, cb) {
      buffer += chunk.toString();
      let i;
      while ((i = buffer.indexOf("\n")) >= 0) {
        lines.push(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
      }
      cb();
    },
  });
  return { app: createApp({ logStream: stream }), lines, text: () => lines.join("\n") };
}
const lastRequestLog = (lines: string[]) => JSON.parse(lines.filter((l) => l.includes('"req"')).at(-1)!) as { req: Record<string, any>; res: Record<string, any>; responseTime: number };

describe("masquage des paramètres d'URL (téléphones, identifiants personnels)", () => {
  it("suivi public : ni le téléphone ni le numéro de commande ne sont journalisés, mais la route et le code HTTP le sont", async () => {
    const { app, lines, text } = loggedApp();
    await supertest(app).get("/api/orders/track").query({ number: "CMD-2026-000123", phone: "0555123456" }).expect(404);
    const log = lastRequestLog(lines);
    expect(log.req.url).toMatch(/^\/api\/orders\/track\?/);
    expect(log.req.query).toEqual({ number: "[Redacted]", phone: "[Redacted]" });
    expect(log.res.statusCode).toBe(404);
    expect(typeof log.responseTime).toBe("number");
    for (const secret of ["0555123456", "555123456", "CMD-2026-000123"]) expect(text(), secret).not.toContain(secret);
  });

  it("recherches et identifiants de l'administration : masqués (refus par défaut) ; pagination, tri et filtres de catalogue conservés", async () => {
    const { app, lines, text } = loggedApp();
    await supertest(app).get("/api/admin/orders").query({ search: "Amina Benali 0555123456", phone: "+213555123456", customerId: "cmabc123", page: "2", sort: "newest", status: "pending", inconnu: "VALEUR-SECRETE" });
    const log = lastRequestLog(lines);
    expect(log.req.query).toMatchObject({ search: "[Redacted]", phone: "[Redacted]", customerId: "[Redacted]", inconnu: "[Redacted]", page: "2", sort: "newest", status: "pending" });
    for (const secret of ["Amina", "Benali", "555123456", "cmabc123", "VALEUR-SECRETE"]) expect(text(), secret).not.toContain(secret);
    expect(log.req.url).toContain("page=2");
    expect(log.req.url).toContain("sort=newest");
  });

  it("numéro de commande ou téléphone placés dans le CHEMIN : masqués aussi", async () => {
    const { app, lines, text } = loggedApp();
    await supertest(app).get("/api/customers/me/orders/CMD-2026-000456");
    await supertest(app).get("/api/admin/orders/by-number/CMD-2026-000789");
    await supertest(app).get("/api/some/0555123456/path");
    await supertest(app).get("/api/some/%2B213555123456/path");
    for (const secret of ["CMD-2026-000456", "CMD-2026-000789", "0555123456", "213555123456"]) expect(text(), secret).not.toContain(secret);
    expect(text()).toContain("[Redacted]");
    expect(lastRequestLog(lines).req.url).toBe("/api/some/[Redacted]/path");
  });

  it("fonctions de masquage : encodages, clés répétées, formats de téléphone, texte normal inchangé", () => {
    expect(sanitizeUrl("/api/orders/track?number=CMD-2026-000123&phone=%2B213555123456")).toBe("/api/orders/track?number=%5BRedacted%5D&phone=%5BRedacted%5D");
    expect(sanitizeUrl("/api/products?page=2&search=robe&search=jupe&sort=newest")).toBe("/api/products?page=2&search=%5BRedacted%5D&search=%5BRedacted%5D&sort=newest");
    expect(sanitizeUrl("/api/products?%70hone=0555123456")).toBe("/api/products?%70hone=%5BRedacted%5D"); // clé encodée : décodée avant comparaison
    expect(sanitizeUrl("/api/products/robe-longue")).toBe("/api/products/robe-longue");
    expect(sanitizeUrl("/api/health")).toBe("/api/health");
    expect(sanitizeUrl(undefined)).toBe("");
    for (const segment of ["CMD-2026-000123", "cmd-2026-000123", "0555123456", "+213555123456", "00213555123456", "0555 12 34 56", "0555-12-34-56", "%2B213555123456"]) {
      expect(sanitizePathSegment(segment), segment).toBe("[Redacted]");
    }
    for (const segment of ["robe-longue", "cmwv0et7000bxv5a8xo0yvdhk", "123", "api", "2026"]) expect(sanitizePathSegment(segment), segment).toBe(segment);
    expect(sanitizeQuery({ phone: "x", page: "3", color: ["noir", "blanc"] })).toEqual({ phone: "[Redacted]", page: "3", color: "noir,blanc" });
    expect(sanitizeParams({ id: "abc", slug: "robe", number: "CMD-2026-000123", phone: "0555123456" })).toEqual({ id: "abc", slug: "robe", number: "[Redacted]", phone: "[Redacted]" });
    expect(sanitizeQuery(null)).toEqual({});
  });
});

describe("en-têtes : liste blanche (cookies, jetons, autorisation, signatures du proxy, localisation, IP complète)", () => {
  it("ne journalise AUCUN en-tête sensible ; l'adresse du client n'apparaît que masquée", async () => {
    const { app, lines, text } = loggedApp();
    const secrets = {
      cookie: "admin_session=COOKIE-ADMIN-SECRET; customer_session=COOKIE-CLIENTE-SECRET",
      authorization: "Bearer BEARER-SECRET-123",
      "x-vercel-proxy-signature": "Bearer SIGNATURE-DU-PROXY-SECRETE",
      forwarded: "for=198.51.100.9;host=ali.example;proto=https;sig=SIG-FORWARDED-SECRETE;exp=1",
      "x-vercel-ip-city": "VILLE-SECRETE",
      "x-vercel-ip-postal-code": "99999",
      "x-vercel-ip-latitude": "36.123456",
      "x-vercel-ip-longitude": "7.654321",
      "x-vercel-id": "cdg1::ID-VERCEL-SECRET",
      "x-vercel-deployment-url": "interne.vercel.app",
      "x-api-key": "API-KEY-SECRETE",
      "x-forwarded-for": "198.51.100.9",
      "x-real-ip": "198.51.100.9",
    };
    await supertest(app).get("/api/admin/orders").set({ ...secrets, "user-agent": "Mozilla/5.0 (Test)", "accept-language": "fr-FR" });
    const log = lastRequestLog(lines);
    const t = text();
    for (const value of ["COOKIE-ADMIN-SECRET", "COOKIE-CLIENTE-SECRET", "BEARER-SECRET-123", "SIGNATURE-DU-PROXY-SECRETE", "SIG-FORWARDED-SECRETE", "VILLE-SECRETE", "99999", "36.123456", "7.654321", "ID-VERCEL-SECRET", "interne.vercel.app", "API-KEY-SECRETE", "198.51.100.9"]) {
      expect(t, `fuite : ${value}`).not.toContain(value);
    }
    // Seuls des en-têtes de la liste blanche subsistent (aucun des en-têtes sensibles envoyés ci-dessus).
    expect(Object.keys(log.req.headers).every((h) => ["host", "user-agent", "accept", "accept-language", "accept-encoding", "content-type", "content-length", "origin", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "x-forwarded-proto", "x-forwarded-host"].includes(h))).toBe(true);
    expect(log.req.headers["accept-language"]).toBe("fr-FR");
    expect(log.req.headers["user-agent"]).toBe("Mozilla/5.0 (Test)"); // ce qui sert à diagnostiquer reste là
    expect(log.req.ipMasked).toBe("198.51.100.0/24");
    expect(JSON.stringify(log.req)).not.toMatch(/remoteAddress|remotePort/);
  });

  it("réponse : jamais de Set-Cookie (ni valeur ni nom), seulement le code et quelques en-têtes sûrs", async () => {
    const { app, lines, text } = loggedApp();
    const res = await supertest(app).post("/api/customers/logout").set("Origin", "http://localhost:3000"); // pose un Set-Cookie (effacement)
    expect(res.headers["set-cookie"]).toBeTruthy();
    const log = lastRequestLog(lines);
    expect(log.res.statusCode).toBe(204);
    expect(Object.keys(log.res.headers).every((h) => ["content-type", "content-length", "cache-control", "retry-after", "content-encoding", "vary"].includes(h))).toBe(true);
    expect(text()).not.toMatch(/set-cookie|customer_session|Expires=/i);
    expect(JSON.stringify(log.res.headers)).not.toMatch(/content-security-policy|strict-transport|x-frame/i); // bruit des en-têtes de sécurité retiré
  });

  it("les journaux restent exploitables : chaque ligne est du JSON avec méthode, chemin, statut, durée et identifiant de requête", async () => {
    const { app, lines } = loggedApp();
    await supertest(app).get("/api/health").expect(200);
    const log = lastRequestLog(lines);
    expect(log.req).toMatchObject({ method: "GET", url: "/api/health" });
    expect(log.req.id).toBeDefined();
    expect(log.res.statusCode).toBe(200);
    expect(log.responseTime).toBeGreaterThanOrEqual(0);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  });

  it("aucun corps de requête n'est journalisé (mots de passe de connexion, d'inscription, de changement et de réinitialisation)", async () => {
    const { app, text } = loggedApp();
    const secrets = { a: "MOT-DE-PASSE-CONNEXION-1", b: "MOT-DE-PASSE-INSCRIPTION-2", c: "MOT-DE-PASSE-ACTUEL-3", d: "NOUVEAU-MOT-DE-PASSE-4", e: "MOT-DE-PASSE-ADMIN-5" };
    await supertest(app).post("/api/customers/login").send({ phone: "0555123456", password: secrets.a });
    await supertest(app).post("/api/customers/register").send({ firstName: "Ab", lastName: "Cd", phone: "0555123457", wilayaCode: "16", commune: "Alger", password: secrets.b });
    await supertest(app).post("/api/customers/me/password").send({ currentPassword: secrets.c, newPassword: secrets.d });
    await supertest(app).post("/api/admin/customers/x/reset-password").send({ adminPassword: secrets.e });
    await supertest(app).post("/api/auth/login").send({ email: "a@b.dz", password: secrets.a });
    for (const secret of Object.values(secrets)) expect(text(), secret).not.toContain(secret);
  }, 60_000);
});
