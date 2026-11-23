import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "./helpers";

const run = () =>
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "tsx", "prisma/archive-men.ts"], {
    cwd: resolve(__dirname, ".."),
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

describe("script db:archive-men (boutique 100 % femme)", () => {
  beforeAll(async () => {
    await resetDatabase();
    const femme = await prisma.category.create({ data: { name: "Femme", slug: "femme" } });
    const homme = await prisma.category.create({ data: { name: "Homme", slug: "homme" } });
    const chemises = await prisma.category.create({ data: { name: "Chemises", slug: "chemises", parentId: homme.id } });
    const mk = (ref: string, categoryId: string, gender: "women" | "men" | "unisex") =>
      prisma.product.create({
        data: { reference: ref, name: ref, slug: ref.toLowerCase(), description: "d", categoryId, gender, price: 1000, costPrice: 400, isPublished: true },
      });
    await mk("ROBE-1", femme.id, "women");
    await mk("CEINTURE-1", femme.id, "unisex");
    await mk("CHEMISE-H", chemises.id, "men");
    await mk("MAL-RANGE", homme.id, "women"); // produit mal classé dans la branche Homme
  });

  it("archive la branche Homme et les produits masculins, sans toucher au reste", async () => {
    const out = run();
    expect(out).toContain("Catégories archivées : 2");
    expect(out).toContain("Produits archivés    : 2");

    const cats = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.slug, c.isArchived]));
    expect(cats).toEqual({ femme: false, homme: true, chemises: true });

    const products = Object.fromEntries((await prisma.product.findMany()).map((p) => [p.reference, { archived: p.isArchived, published: p.isPublished }]));
    expect(products["ROBE-1"]).toEqual({ archived: false, published: true });
    expect(products["CEINTURE-1"]).toEqual({ archived: false, published: true });
    expect(products["CHEMISE-H"]).toEqual({ archived: true, published: false });
    expect(products["MAL-RANGE"]).toEqual({ archived: true, published: false });
  });

  it("est idempotent et ne supprime rien", async () => {
    expect(run()).toContain("Rien à faire");
    expect(await prisma.product.count()).toBe(4);
    expect(await prisma.category.count()).toBe(3);
  });
});
