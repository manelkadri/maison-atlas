import { beforeAll, describe, expect, it } from "vitest";
import { http, prisma, resetDatabase } from "./helpers";

beforeAll(resetDatabase);

describe("socle de l'API", () => {
  it("répond sur /api/health", async () => {
    const res = await http().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("renvoie une 404 au format d'erreur standard pour une route inconnue", async () => {
    const res = await http().get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("protège /api/admin/* : 401 sans session, quelle que soit la route", async () => {
    for (const path of ["/api/admin/products", "/api/admin/orders", "/api/admin/settings", "/api/admin/inconnue"]) {
      const res = await http().get(path);
      expect(res.status, path).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("refuse un cookie de session forgé", async () => {
    const res = await http().get("/api/admin/products").set("Cookie", "admin_session=faux.jeton.forge");
    expect(res.status).toBe(401);
  });

  it("refuse une requête modifiante venant d'une origine non autorisée (CSRF)", async () => {
    const res = await http().post("/api/auth/login").set("Origin", "https://evil.example").send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejette un JSON invalide avec une erreur 400 propre", async () => {
    const res = await http().post("/api/auth/login").set("Content-Type", "application/json").send("{pas du json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });
});

describe("intégrité garantie par la base", () => {
  it("la base refuse un stock négatif même sans passer par l'API", async () => {
    const cat = await prisma.category.create({ data: { name: "T", slug: "t" } });
    const product = await prisma.product.create({
      data: { reference: "T-1", name: "T", slug: "t", description: "d", categoryId: cat.id, price: 1000, costPrice: 500 },
    });
    await expect(
      prisma.productVariant.create({ data: { productId: product.id, sku: "T-1-X", color: "Noir", colorCode: "#000000", size: "M", price: 1000, stock: -1 } }),
    ).rejects.toThrow();
  });

  it("la base refuse un total de commande incohérent", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Order" ("id","orderNumber","customerFirstName","customerLastName","customerPhone","wilayaCode","wilayaName","commune","deliveryMethod","subtotal","discountTotal","shippingFee","total","updatedAt")
         VALUES ('o1','CMD-X','A','B','0550000000','16','Alger','C','home',1000,0,450,9999,now())`,
      ),
    ).rejects.toThrow();
  });

  it("stocke correctement l'UTF-8 (accents)", async () => {
    const c = await prisma.category.create({ data: { name: "Écharpe en laine — Aïn Témouchent", slug: "echarpe" } });
    const back = await prisma.category.findUniqueOrThrow({ where: { id: c.id } });
    expect(back.name).toBe("Écharpe en laine — Aïn Témouchent");
  });
});
