/**
 * Scènes éditoriales : catégories, hero, promo, brand, icône d'application et visuel OG.
 */
import { arch, mix, svgDoc } from "./kit.mjs";
import { place } from "./products.mjs";

const compose = (pieces) => {
  const placed = pieces.map((p, i) => place({ ...p, pfx: `p${i}` }));
  return { content: placed.map((p) => p.svg).join(""), defs: placed.map((p) => p.defs).join("") };
};

const sun = (cx, cy, r, fill, op = 0.5) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${op}"/>`;
const BRASS = "#b99a62";

/* ------------------------------------------------------------------ catégories (1200 x 1500) */

const CAT = {
  femme: {
    bg: "#ebe2d4",
    deco: "A",
    pieces: [
      { kind: "dress", hex: "#6d1f2c", x: 400, y: 960, s: 0.62 },
      { kind: "coat", hex: "#b08a5b", x: 690, y: 780, s: 0.9 },
    ],
  },
  robes: {
    bg: "#ead9c6",
    deco: "B",
    pieces: [
      { kind: "dress", hex: "#f2eee6", opts: { kind: "linen" }, x: 360, y: 900, s: 0.66, rot: -4 },
      { kind: "dress", hex: "#6d1f2c", opts: { kind: "satin" }, x: 720, y: 790, s: 0.88, rot: 2 },
    ],
  },
  "hauts-femme": {
    bg: "#e3e5da",
    deco: "C",
    pieces: [
      { kind: "top", hex: "#bcd0e0", opts: { kind: "tie" }, x: 400, y: 880, s: 0.7, rot: -5 },
      { kind: "top", hex: "#efe8d8", opts: { kind: "silk" }, x: 700, y: 790, s: 0.82, rot: 2 },
    ],
  },
  "pantalons-femme": {
    bg: "#eee4d6",
    deco: "A",
    pieces: [
      { kind: "pants", hex: "#1a1a1a", opts: { kind: "tailor" }, x: 440, y: 880, s: 0.7, rot: -3 },
      { kind: "pants", hex: "#b08a5b", opts: { kind: "wide" }, x: 710, y: 780, s: 0.84, rot: 2 },
    ],
  },
  "manteaux-femme": {
    bg: "#e5dac9",
    deco: "B",
    pieces: [
      { kind: "coat", hex: "#9b9a97", x: 420, y: 860, s: 0.7, rot: -3 },
      { kind: "coat", hex: "#b08a5b", x: 700, y: 770, s: 0.88, rot: 2 },
    ],
  },
  vestes: {
    bg: "#e5dfd4",
    deco: "A",
    pieces: [
      { kind: "jacket", hex: "#6b6a3f", opts: { kind: "bomber" }, x: 440, y: 900, s: 0.68, rot: -4 },
      { kind: "jacket", hex: "#1a1a1a", opts: { kind: "leather" }, x: 700, y: 790, s: 0.84, rot: 2 },
    ],
  },
  accessoires: {
    bg: "#ecdfd0",
    deco: "B",
    pieces: [
      { kind: "silkScarf", hex: "#a2522f", x: 830, y: 560, s: 0.5, rot: 8 },
      { kind: "belt", hex: "#4a3426", x: 800, y: 1250, s: 0.7, rot: 0 },
      { kind: "bag", hex: "#b08a5b", x: 460, y: 880, s: 0.74 },
    ],
  },
  nouveautes: {
    bg: "#efe8dc",
    deco: "C",
    pieces: [
      { kind: "dress", hex: "#b4654a", opts: { kind: "linen" }, x: 380, y: 880, s: 0.66, rot: -4 },
      { kind: "top", hex: "#9aa58c", opts: { kind: "silk" }, x: 730, y: 740, s: 0.7, rot: 3 },
      { kind: "bag", hex: "#1a1a1a", x: 850, y: 1080, s: 0.42, rot: 4 },
    ],
  },
};

function catDecor(bg, v) {
  const deep = mix(bg, "#6b5444", 0.08);
  const deeper = mix(bg, "#6b5444", 0.14);
  const pale = mix(bg, "#ffffff", 0.45);
  const tint = mix(bg, "#b4654a", 0.16);
  if (v === "A") return `<path d="${arch(150, 150, 900, 1350)}" fill="${deep}"/><path d="${arch(300, 330, 600, 1170)}" fill="${deeper}" fill-opacity=".55"/>${sun(880, 330, 150, pale, 0.6)}`;
  if (v === "B") return `<path d="${arch(300, 110, 800, 1390)}" fill="${deep}"/><path d="${arch(70, 620, 380, 880)}" fill="${deeper}" fill-opacity=".7"/>${sun(330, 330, 190, tint, 0.45)}`;
  return `<path d="${arch(60, 260, 620, 1240)}" fill="${deeper}" fill-opacity=".7"/><path d="${arch(330, 150, 810, 1350)}" fill="${deep}"/>${sun(900, 400, 170, pale, 0.6)}`;
}

export function categorySvg(slug) {
  const cfg = CAT[slug];
  const { content, defs } = compose(cfg.pieces.map((p) => ({ ...p, y: p.y - 70, s: p.s * 1.06 })));
  return svgDoc({ w: 1200, h: 1500, bg: cfg.bg, defs, content: catDecor(cfg.bg, cfg.deco) + content, label: slug });
}
export const CATEGORY_SLUGS = Object.keys(CAT);

/* ------------------------------------------------------------------ hero 1600 x 1200 */

export function heroSvg() {
  const bg = "#f3eee4";
  const { content, defs } = compose([
    { kind: "dress", hex: "#1a1a1a", opts: { kind: "satin" }, x: 1000, y: 700, s: 0.5, rot: -3 },
    { kind: "coat", hex: "#b08a5b", x: 1225, y: 630, s: 0.68, rot: 1.5 },
    { kind: "bag", hex: "#6d1f2c", x: 1465, y: 870, s: 0.3, rot: 3 },
  ]);
  const deco =
    `<circle cx="330" cy="620" r="430" fill="none" stroke="${mix(bg, "#6b5444", 0.1)}" stroke-width="2"/>` +
    `<circle cx="330" cy="620" r="330" fill="none" stroke="${mix(bg, "#6b5444", 0.07)}" stroke-width="2"/>` +
    `<path d="${arch(860, 90, 700, 1110)}" fill="#e6dac7"/>` +
    `<path d="${arch(960, 230, 500, 970)}" fill="#dccdb5" fill-opacity=".8"/>` +
    sun(930, 330, 130, "#cf9a7e", 0.42) +
    `<rect x="0" y="1010" width="1600" height="190" fill="#e4d9c6"/>` +
    `<rect x="0" y="1010" width="1600" height="3" fill="#cdbfa6"/>` +
    `<ellipse cx="1220" cy="1030" rx="420" ry="30" fill="#5a4130" fill-opacity=".16" filter="url(#soft2)"/>`;
  return svgDoc({ w: 1600, h: 1200, bg, defs, content: deco + content, label: "Maison Atlas" });
}

/* ------------------------------------------------------------------ promo 1600 x 900 */

export function promoSvg() {
  const bg = "#b4654a";
  const { content, defs } = compose([
    { kind: "bag", hex: "#b08a5b", x: 1010, y: 540, s: 0.4, rot: -4 },
    { kind: "dress", hex: "#f2eee6", opts: { kind: "linen" }, x: 1240, y: 390, s: 0.5, rot: 2 },
    { kind: "silkScarf", hex: "#efe8d8", x: 1480, y: 600, s: 0.3, rot: 12 },
  ]);
  const deco =
    `<path d="${arch(880, -60, 640, 1000)}" fill="#8e4a36"/>` +
    `<path d="${arch(980, 80, 440, 860)}" fill="#6d3a2b" fill-opacity=".85"/>` +
    sun(830, 250, 120, "#dba98a", 0.5) +
    `<circle cx="260" cy="560" r="360" fill="none" stroke="#c98166" stroke-width="2"/>` +
    `<circle cx="260" cy="560" r="270" fill="none" stroke="#c07559" stroke-width="2"/>` +
    `<rect x="0" y="790" width="1600" height="110" fill="#a3573e"/>`;
  return svgDoc({ w: 1600, h: 900, bg, defs, content: deco + content, label: "Collection de saison" });
}

/* ------------------------------------------------------------------ brand (atelier) 1200 x 1500 */

function fabricRoll(x0, x1, cy, d, col, ringCol) {
  const r = d / 2;
  const dk = mix(col, "#1c120b", 0.25);
  const lt = mix(col, "#ffffff", 0.25);
  let s = `<g filter="url(#ds-s)">`;
  s += `<ellipse cx="${x0}" cy="${cy}" rx="${r * 0.46}" ry="${r}" fill="${dk}"/>`;
  s += `<rect x="${x0}" y="${cy - r}" width="${x1 - x0}" height="${d}" fill="${col}"/>`;
  s += `<rect x="${x0}" y="${cy - r}" width="${x1 - x0}" height="${d}" fill="url(#sh-v)"/>`;
  s += `<path d="M${x0} ${cy - r}H${x1}M${x0} ${cy + r}H${x1}" stroke="${dk}" stroke-opacity=".5" stroke-width="2"/>`;
  s += `<rect x="${x0 + 40}" y="${cy - r}" width="16" height="${d}" fill="${dk}" fill-opacity=".14"/><rect x="${x0 + 320}" y="${cy - r}" width="10" height="${d}" fill="#fff" fill-opacity=".1"/>`;
  s += `<ellipse cx="${x1}" cy="${cy}" rx="${r * 0.46}" ry="${r}" fill="${lt}" stroke="${dk}" stroke-opacity=".6" stroke-width="2"/>`;
  for (let i = 1; i <= 4; i++) s += `<ellipse cx="${x1}" cy="${cy}" rx="${(r * 0.46 * (1 - i * 0.2)).toFixed(1)}" ry="${(r * (1 - i * 0.2)).toFixed(1)}" fill="none" stroke="${ringCol}" stroke-opacity=".45" stroke-width="2"/>`;
  s += `<ellipse cx="${x1}" cy="${cy}" rx="9" ry="20" fill="${dk}" fill-opacity=".6"/>`;
  return s + `</g>`;
}

export function brandSvg() {
  const bg = "#e8dfd0";
  let s = "";
  s += `<path d="${arch(120, 150, 960, 1350)}" fill="${mix(bg, "#6b5444", 0.08)}"/>`;
  s += `<path d="${arch(300, 330, 600, 1170)}" fill="${mix(bg, "#6b5444", 0.13)}" fill-opacity=".6"/>`;
  s += sun(870, 380, 150, "#ffffff", 0.35);
  // plan de travail
  s += `<rect x="0" y="1180" width="1200" height="320" fill="#d6c9b3"/><rect x="0" y="1180" width="1200" height="3" fill="#c3b49b"/>`;
  s += `<ellipse cx="600" cy="1200" rx="560" ry="24" fill="#5a4130" fill-opacity=".14" filter="url(#soft2)"/>`;
  // rouleaux de tissu empilés
  s += fabricRoll(180, 840, 1290, 150, "#b08a5b", "#6b5444");
  s += fabricRoll(220, 860, 1148, 140, "#efe8d8", "#8a7a66");
  s += fabricRoll(260, 820, 1012, 130, "#b4654a", "#5a2f22");
  // bobine de fil
  s += `<g filter="url(#ds-s)"><rect x="940" y="1070" width="150" height="28" rx="6" fill="#8a6f3f"/><rect x="948" y="1098" width="134" height="110" fill="#a2522f"/><rect x="948" y="1098" width="134" height="110" fill="url(#sh-h)"/><path d="M948 1118H1082M948 1138H1082M948 1158H1082M948 1178H1082M948 1198H1082" stroke="#5a2a18" stroke-opacity=".35" stroke-width="2"/><rect x="940" y="1208" width="150" height="28" rx="6" fill="#8a6f3f"/></g>`;
  // ciseaux de tailleur
  const steel = "#a39d92";
  const steelDk = "#6f695f";
  let g = `<g filter="url(#ds-s)" transform="translate(620 620) rotate(-38) scale(1.15)">`;
  g += `<path d="M-30 -10L330 -26Q346 -14 330 -4L-30 22Z" fill="${steel}" stroke="${steelDk}" stroke-width="2.4"/>`;
  g += `<path d="M-30 -10L330 -26" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>`;
  g += `<path d="M-30 14L320 40Q338 30 320 22L-30 -14Z" fill="${mix(steel, "#ffffff", 0.12)}" stroke="${steelDk}" stroke-width="2.4"/>`;
  g += `<path d="M-30 14L320 40" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>`;
  g += `<path d="M-30 -10L-150 -60L-190 -40L-60 22Z" fill="#2b2420" stroke="#14100d" stroke-width="2"/>`;
  g += `<path d="M-30 14L-150 70L-190 48L-60 -14Z" fill="#2b2420" stroke="#14100d" stroke-width="2"/>`;
  g += `<ellipse cx="-230" cy="-62" rx="74" ry="52" fill="none" stroke="#2b2420" stroke-width="22" transform="rotate(-18 -230 -62)"/>`;
  g += `<ellipse cx="-236" cy="88" rx="64" ry="48" fill="none" stroke="#2b2420" stroke-width="22" transform="rotate(14 -236 88)"/>`;
  g += `<ellipse cx="-230" cy="-62" rx="74" ry="52" fill="none" stroke="#ffffff" stroke-opacity=".12" stroke-width="4" transform="rotate(-18 -230 -62) translate(-4 -6)"/>`;
  g += `<circle cx="-14" cy="4" r="11" fill="${BRASS}" stroke="#8a6f3f" stroke-width="2"/>`;
  s += g + `</g>`;
  // mètre ruban enroulé
  s += `<g filter="url(#ds-s)"><circle cx="900" cy="860" r="110" fill="#e9d9b8" stroke="#a8946d" stroke-width="3"/><circle cx="900" cy="860" r="84" fill="none" stroke="#a8946d" stroke-opacity=".7" stroke-width="3"/><circle cx="900" cy="860" r="62" fill="#d8c59e" stroke="#a8946d" stroke-width="2.5"/><circle cx="900" cy="860" r="22" fill="#e8dfd0" stroke="#a8946d" stroke-width="2.5"/>`;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r2 = i % 4 === 0 ? 112 : 106;
    s += `<path d="M${(900 + Math.cos(a) * 100).toFixed(1)} ${(860 + Math.sin(a) * 100).toFixed(1)}L${(900 + Math.cos(a) * r2).toFixed(1)} ${(860 + Math.sin(a) * r2).toFixed(1)}" stroke="#6b5444" stroke-opacity=".6" stroke-width="2"/>`;
  }
  s += `<path d="M1010 860C1040 880 1070 930 1100 1010" fill="none" stroke="#e9d9b8" stroke-width="30"/><path d="M1010 860C1040 880 1070 930 1100 1010" fill="none" stroke="#a8946d" stroke-width="2" transform="translate(-15 0)"/><path d="M1010 860C1040 880 1070 930 1100 1010" fill="none" stroke="#a8946d" stroke-width="2" transform="translate(15 0)"/></g>`;
  // épingles
  for (const [x, y, a] of [[300, 760, -20], [350, 790, 12], [330, 840, -4]]) {
    s += `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0V86" stroke="#9b958a" stroke-width="3.4"/><circle cx="0" cy="-3" r="8" fill="#a2522f"/></g>`;
  }
  return svgDoc({ w: 1200, h: 1500, bg, content: s, label: "Atelier Maison Atlas" });
}

/* ------------------------------------------------------------------ icône (favicon) */

export function iconSvg() {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Maison Atlas">` +
    `<rect width="64" height="64" rx="14" fill="#171412"/>` +
    `<path d="M16 50L32 14L48 50" fill="none" stroke="#faf8f4" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M24 41V37a8 8 0 0 1 16 0V41" fill="none" stroke="#faf8f4" stroke-width="3.4" stroke-linecap="round"/>` +
    `</svg>\n`
  );
}

/* ------------------------------------------------------------------ visuel OG 1200 x 630 (rendu PNG) */

export function ogSvg() {
  const bg = "#f3eee4";
  const { content, defs } = compose([
    { kind: "dress", hex: "#1a1a1a", opts: { kind: "satin" }, x: 770, y: 360, s: 0.34, rot: -3 },
    { kind: "coat", hex: "#b08a5b", x: 930, y: 330, s: 0.46, rot: 1.5 },
    { kind: "bag", hex: "#6d1f2c", x: 1090, y: 520, s: 0.2, rot: 3 },
  ]);
  const deco =
    `<path d="${arch(640, 40, 440, 640)}" fill="#e6dac7"/><path d="${arch(700, 120, 320, 560)}" fill="#dccdb5" fill-opacity=".8"/>` +
    sun(700, 160, 70, "#cf9a7e", 0.42) +
    `<rect x="0" y="560" width="1200" height="70" fill="#e4d9c6"/>`;
  const text =
    `<g fill="#171412" font-family="Georgia, 'Times New Roman', serif">` +
    `<text x="84" y="300" font-size="68" letter-spacing="10">MAISON</text>` +
    `<text x="84" y="378" font-size="68" letter-spacing="10">ATLAS</text>` +
    `<rect x="86" y="410" width="72" height="3" fill="#6b5444"/>` +
    `<text x="86" y="458" font-size="24" fill="#6b5444" letter-spacing="3">Vêtements pour elle et lui</text>` +
    `</g>`;
  return svgDoc({ w: 1200, h: 630, bg, defs, content: deco + content + text, label: "Maison Atlas" });
}
