import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoriesMock } from "@/mocks/categories.mock";
import { productsMock } from "@/mocks/products.mock";

const publicDir = join(process.cwd(), "public");
const fileOf = (url: string) => join(publicDir, ...url.split("/").filter(Boolean));

describe("images de démonstration", () => {
  it("chaque image de chaque produit existe dans public/", () => {
    const missing = productsMock.flatMap((p) => p.images.map((i) => i.url)).filter((url) => !existsSync(fileOf(url)));
    expect(missing).toEqual([]);
  });

  it("chaque catégorie a son image", () => {
    const missing = categoriesMock.map((c) => c.imageUrl).filter((url): url is string => !!url && !existsSync(fileOf(url)));
    expect(missing).toEqual([]);
    expect(categoriesMock.every((c) => !!c.imageUrl)).toBe(true);
  });

  it("les visuels éditoriaux et l'icône existent", () => {
    for (const url of ["/images/hero.svg", "/images/promo.svg", "/images/brand.svg"]) {
      expect(existsSync(fileOf(url)), url).toBe(true);
    }
    expect(existsSync(join(process.cwd(), "src", "app", "icon.svg"))).toBe(true);
  });

  it("les SVG sont sûrs et légers (pas de script, pas de ressource externe, < 40 Ko)", () => {
    const urls = [
      ...productsMock.flatMap((p) => p.images.map((i) => i.url)),
      ...categoriesMock.map((c) => c.imageUrl as string),
      "/images/hero.svg",
      "/images/promo.svg",
      "/images/brand.svg",
    ];
    for (const url of new Set(urls)) {
      const file = fileOf(url);
      expect(statSync(file).size, url).toBeLessThan(40 * 1024);
      const svg = readFileSync(file, "utf8");
      expect(svg.startsWith("<svg"), url).toBe(true);
      expect(svg, url).not.toMatch(/<script|xlink:|href=|<image|@import/i);
    }
  });
});
