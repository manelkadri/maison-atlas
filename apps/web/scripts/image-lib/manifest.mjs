/**
 * Table produit -> pièce dessinée + couleurs. Dupliquée volontairement depuis
 * src/mocks/products.mock.ts (Node ne lit pas le TypeScript) : le test
 * tests/unit/images.test.ts vérifie que CHAQUE image référencée par les mocks existe,
 * donc toute divergence (nouveau produit, nouvelle couleur) est détectée.
 */

export const slugify = (input) =>
  input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const PRODUCTS = [
  { slug: "robe-midi-satinee", kind: "dress", opts: { kind: "satin" }, colors: [["Noir", "#1a1a1a"], ["Beige", "#d8c3a5"], ["Bordeaux", "#6d1f2c"]] },
  { slug: "robe-longue-en-lin", kind: "dress", opts: { kind: "linen" }, colors: [["Blanc cassé", "#f2eee6"], ["Terracotta", "#b4654a"]] },
  { slug: "blouse-en-soie-fluide", kind: "top", opts: { kind: "silk" }, colors: [["Ivoire", "#efe8d8"], ["Noir", "#1a1a1a"], ["Sauge", "#9aa58c"]] },
  { slug: "chemisier-col-noue", kind: "top", opts: { kind: "tie" }, colors: [["Blanc", "#ffffff"], ["Bleu ciel", "#bcd0e0"]] },
  { slug: "pantalon-large-taille-haute", kind: "pants", opts: { kind: "wide" }, colors: [["Noir", "#1a1a1a"], ["Camel", "#b08a5b"], ["Gris", "#8a8a88"]] },
  { slug: "pantalon-tailleur-fluide", kind: "pants", opts: { kind: "tailor" }, colors: [["Noir", "#1a1a1a"], ["Beige", "#d8c3a5"]] },
  { slug: "manteau-long-en-laine", kind: "coat", opts: {}, colors: [["Camel", "#b08a5b"], ["Noir", "#1a1a1a"], ["Gris chiné", "#9b9a97"]] },
  { slug: "chemise-oxford", kind: "top", opts: { kind: "oxford" }, colors: [["Blanc", "#ffffff"], ["Bleu ciel", "#bcd0e0"], ["Rose poudré", "#e3c3c0"]] },
  { slug: "chemise-en-lin", kind: "top", opts: { kind: "linen" }, colors: [["Sable", "#d9ccb0"], ["Bleu marine", "#1f2f4a"]] },
  { slug: "t-shirt-coton-premium", kind: "tee", opts: {}, colors: [["Blanc", "#ffffff"], ["Noir", "#1a1a1a"], ["Gris chiné", "#9b9a97"], ["Marine", "#1f2f4a"]] },
  { slug: "polo-pique", kind: "tee", opts: { polo: true }, colors: [["Marine", "#1f2f4a"], ["Blanc", "#ffffff"], ["Vert forêt", "#2f4a3a"]] },
  { slug: "pantalon-chino", kind: "pants", opts: { kind: "chino" }, colors: [["Beige", "#d8c3a5"], ["Marine", "#1f2f4a"], ["Olive", "#6b6a3f"]] },
  { slug: "jean-droit-brut", kind: "pants", opts: { kind: "jean" }, colors: [["Bleu brut", "#2a3a55"], ["Noir", "#1a1a1a"]] },
  { slug: "veste-en-cuir", kind: "jacket", opts: { kind: "leather" }, colors: [["Noir", "#1a1a1a"], ["Brun", "#4a3426"]] },
  { slug: "blouson-bomber", kind: "jacket", opts: { kind: "bomber" }, colors: [["Olive", "#6b6a3f"], ["Noir", "#1a1a1a"]] },
  { slug: "sac-cabas-en-cuir", kind: "bag", opts: {}, colors: [["Noir", "#1a1a1a"], ["Camel", "#b08a5b"]] },
  { slug: "foulard-en-soie", kind: "silkScarf", opts: {}, colors: [["Rouille", "#a2522f"], ["Bleu nuit", "#1c2540"], ["Ivoire", "#efe8d8"]] },
  { slug: "ceinture-en-cuir", kind: "belt", opts: {}, colors: [["Noir", "#1a1a1a"], ["Brun", "#4a3426"]] },
  { slug: "echarpe-en-laine", kind: "woolScarf", opts: {}, colors: [["Gris", "#8a8a88"], ["Camel", "#b08a5b"], ["Bordeaux", "#6d1f2c"]] },
  { slug: "pull-maille-cotelee", kind: "sweater", opts: {}, colors: [["Écru", "#ece4d3"], ["Noir", "#1a1a1a"]] },
  { slug: "veste-en-jean-ancienne-collection", kind: "jacket", opts: { kind: "denim" }, colors: [["Bleu délavé", "#6f86a6"]] },
];

export const CATEGORIES = [
  "femme",
  "robes",
  "hauts-femme",
  "pantalons-femme",
  "manteaux-femme",
  "homme",
  "chemises",
  "t-shirts-polos",
  "pantalons-homme",
  "vestes",
  "accessoires",
  "nouveautes",
];
