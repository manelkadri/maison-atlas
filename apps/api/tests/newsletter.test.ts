import { beforeAll, describe, expect, it } from "vitest";
import { http, prisma, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

describe("POST /api/newsletter", () => {
  it("inscrit un e-mail : 204 sans contenu", async () => {
    const res = await http().post("/api/newsletter").send({ email: "client@example.com" });
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(await prisma.newsletterSubscriber.count()).toBe(1);
  });

  it("est idempotent et ne révèle pas si l'e-mail existait déjà (réponse identique, une seule ligne)", async () => {
    const first = await http().post("/api/newsletter").send({ email: "double@example.com" });
    const again = await http().post("/api/newsletter").send({ email: "double@example.com" });
    const otherCase = await http().post("/api/newsletter").send({ email: "  Double@Example.COM " });
    for (const res of [first, again, otherCase]) {
      expect(res.status).toBe(204);
      expect(res.text).toBe("");
    }
    expect(first.headers["content-length"]).toBe(again.headers["content-length"]);
    expect(await prisma.newsletterSubscriber.count({ where: { email: "double@example.com" } })).toBe(1);
  });

  it("rejette un e-mail invalide ou absent (400 VALIDATION)", async () => {
    for (const body of [{ email: "pas-un-email" }, { email: "" }, {}]) {
      const res = await http().post("/api/newsletter").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION");
    }
  });

  it("est public (aucune session requise) et n'expose aucune lecture", async () => {
    expect((await http().get("/api/newsletter")).status).toBe(404);
    expect((await http().get("/api/admin/newsletter")).status).toBe(401);
  });
});
