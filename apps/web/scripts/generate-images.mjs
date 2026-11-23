/**
 * Génère toutes les images de démonstration (SVG) de la boutique Maison Atlas :
 *   public/images/products/{slug}/{couleur}-{1|2}.svg
 *   public/images/categories/{slug}.svg
 *   public/images/hero.svg, promo.svg, brand.svg
 *   src/app/icon.svg
 *   public/images/og.png (si Chromium/Playwright est disponible)
 *
 * Déterministe (aucun aléatoire) et idempotent (n'écrit un fichier que s'il change).
 * Usage : pnpm images:generate   (ajouter --no-og pour ignorer le PNG OpenGraph)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, PRODUCTS, slugify } from "./image-lib/manifest.mjs";
import { productSvg } from "./image-lib/products.mjs";
import { CATEGORY_SLUGS, brandSvg, categorySvg, heroSvg, iconSvg, ogSvg, promoSvg } from "./image-lib/scenes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicImages = join(root, "public", "images");

const stats = { written: 0, unchanged: 0, total: 0, biggest: ["", 0] };

function save(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  stats.total++;
  if (buf.length > stats.biggest[1]) stats.biggest = [file, buf.length];
  if (existsSync(file) && readFileSync(file).equals(buf)) {
    stats.unchanged++;
    return;
  }
  writeFileSync(file, buf);
  stats.written++;
}

// Produits : 2 vues par couleur
for (const product of PRODUCTS) {
  for (const [colorName, hex] of product.colors) {
    for (const view of [1, 2]) {
      const svg = productSvg({
        hex,
        kind: product.kind,
        opts: product.opts,
        view,
        key: `${product.slug}/${colorName}`,
        label: `${product.slug} ${colorName}`,
      });
      save(join(publicImages, "products", product.slug, `${slugify(colorName)}-${view}.svg`), svg);
    }
  }
}

// Catégories
for (const slug of CATEGORIES) {
  if (!CATEGORY_SLUGS.includes(slug)) throw new Error(`Catégorie sans scène : ${slug}`);
  save(join(publicImages, "categories", `${slug}.svg`), categorySvg(slug));
}

// Visuels éditoriaux
save(join(publicImages, "hero.svg"), heroSvg());
save(join(publicImages, "promo.svg"), promoSvg());
save(join(publicImages, "brand.svg"), brandSvg());
save(join(root, "src", "app", "icon.svg"), iconSvg());

// OpenGraph PNG (optionnel : nécessite Chromium via Playwright)
let og = "ignoré (--no-og)";
if (!process.argv.includes("--no-og")) {
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
      await page.setContent(`<html><body style="margin:0">${ogSvg()}</body></html>`);
      const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
      save(join(publicImages, "og.png"), png);
      og = "généré";
    } finally {
      await browser.close();
    }
  } catch (error) {
    og = `ignoré (Chromium indisponible : ${error instanceof Error ? error.message.split("\n")[0] : error})`;
  }
}

console.log(
  `Images : ${stats.total} fichiers (${stats.written} écrits, ${stats.unchanged} inchangés). ` +
    `Plus gros : ${stats.biggest[0].replace(root, ".")} (${(stats.biggest[1] / 1024).toFixed(1)} Ko). OG : ${og}.`,
);
