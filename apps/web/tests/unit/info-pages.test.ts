import { describe, expect, it } from "vitest";
import { INFO_PAGES, getInfoPage } from "@/app/(store)/info/[slug]/content";
import { storeNav } from "@/config/site";

describe("pages d'information", () => {
  it("les slugs sont uniques", () => {
    const slugs = INFO_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("« À propos de nous » existe et est la cible du menu principal", () => {
    const page = getInfoPage("a-propos");
    expect(page?.title).toBe("À propos de nous");
    expect(storeNav.map((i) => i.href)).toContain("/info/a-propos");
    expect(page?.intro.length).toBeGreaterThan(20);
    expect(page?.sections.length).toBeGreaterThan(0);
  });

  it("chaque lien interne du menu principal mène à une page connue", () => {
    const known = new Set(["/", "/shop", "/contact", ...INFO_PAGES.map((p) => `/info/${p.slug}`)]);
    for (const item of storeNav) expect(known.has(item.href.split("?")[0]!)).toBe(true);
  });
});
