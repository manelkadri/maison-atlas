/* eslint-disable @typescript-eslint/no-unused-vars -- signatures homogènes (c, o) entre les dessins */
/**
 * Boîte à outils de dessin SVG pour les images de démonstration (couleurs, chemins symétriques,
 * ombrages, textures). Aucune dépendance : uniquement des chaînes de caractères.
 * Tout est déterministe : aucune source d'aléatoire.
 */

export const CX = 600;

/* ------------------------------------------------------------------ couleurs */

export const hexToRgb = (h) => {
  const s = h.replace("#", "");
  const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};

export const rgbToHex = (rgb) =>
  "#" +
  rgb
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
    .join("");

export const mix = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((x, i) => x + (B[i] - x) * t));
};

export const lum = (h) => {
  const [r, g, b] = hexToRgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Petit hash déterministe (FNV-1a) pour varier les compositions sans aléatoire. */
export const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const WARM_DARK = "#1c120b";

export function palette(base) {
  const L = lum(base);
  const dark = L < 0.04;
  const light = L > 0.55;
  return {
    base,
    L,
    dark,
    light,
    shc: mix(base, WARM_DARK, light ? 0.58 : 0.62), // couleur des ombres
    edge: mix(base, "#120b06", dark ? 0.1 : light ? 0.3 : 0.4),
    dk1: mix(base, "#120b06", 0.14),
    dk2: mix(base, "#120b06", 0.3),
    dk3: mix(base, "#120b06", 0.5),
    inn: mix(base, "#120b06", L > 0.55 ? 0.34 : 0.5),
    lt1: mix(base, "#ffffff", dark ? 0.1 : 0.14),
    lt2: mix(base, "#ffffff", dark ? 0.2 : 0.3),
    stitch: dark ? mix(base, "#ffffff", 0.26) : light ? mix(base, "#3a2a1c", 0.3) : mix(base, "#ffffff", 0.28),
    // multiplicateurs d'intensité des ombres / lumières selon la teinte du tissu
    ksh: dark ? 0.55 : light ? 1.15 : 1,
    khi: dark ? 1.5 : light ? 0.0 : 1,
  };
}

export const BRASS = "#b99a62";
export const BRASS_DK = "#8a6f3f";
export const PEARL = "#efe8da";

/* ------------------------------------------------------------------ chemins */

/**
 * Construit une forme symétrique par rapport à x = cx.
 * `start` et le dernier point doivent être sur l'axe. On ne décrit que la moitié droite.
 */
export function sym(start, segs, cx = CX) {
  const n = (v) => Math.round(v * 10) / 10;
  const m = (x) => 2 * cx - x;
  let d = `M${n(start[0])} ${n(start[1])}`;
  for (const s of segs) d += s[0] + s.slice(1).map(n).join(" ");
  const pts = [start, ...segs.map((s) => [s[s.length - 2], s[s.length - 1]])];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const t = pts[i];
    if (s[0] === "L") d += `L${n(m(t[0]))} ${n(t[1])}`;
    else if (s[0] === "Q") d += `Q${n(m(s[1]))} ${n(s[2])} ${n(m(t[0]))} ${n(t[1])}`;
    else if (s[0] === "C") d += `C${n(m(s[3]))} ${n(s[4])} ${n(m(s[1]))} ${n(s[2])} ${n(m(t[0]))} ${n(t[1])}`;
  }
  return d + "Z";
}

/** Dessine `s` puis son miroir (x → 1200 - x). */
export const both = (s) => `<g>${s}</g><g transform="matrix(-1 0 0 1 1200 0)">${s}</g>`;

/** Chemin polygonal fermé. */
export const poly = (pts) => "M" + pts.map((p) => `${p[0]} ${p[1]}`).join("L") + "Z";

/* ------------------------------------------------------------------ contexte de dessin */

/**
 * Contexte lié à une couleur de tissu. `pfx` garantit l'unicité des identifiants
 * quand plusieurs pièces cohabitent dans un même SVG.
 */
export function makeCtx(hex, pfx = "a") {
  const p = palette(hex);
  const defs = [];
  let n = 0;
  const uid = () => `${pfx}${n++}`;

  const texCache = new Set();
  const tex = (kind) => {
    if (!kind) return "";
    const id = `${pfx}-tx-${kind}`;
    if (!texCache.has(kind)) {
      texCache.add(kind);
      const ink = p.dark ? "#ffffff" : p.shc;
      const o = p.dark ? 0.07 : 0.1;
      let inner = "";
      let size = "8";
      if (kind === "linen") {
        size = "9";
        inner = `<path d="M0 2.2H9M0 6.8H9" stroke="${ink}" stroke-opacity="${o}" stroke-width=".9"/><path d="M2.4 0V9M6.9 0V9" stroke="${ink}" stroke-opacity="${o * 0.7}" stroke-width=".7"/>`;
      } else if (kind === "rib") {
        size = "10";
        inner = `<path d="M2.5 0V10" stroke="${ink}" stroke-opacity="${o * 1.8}" stroke-width="2.6"/>`;
      } else if (kind === "knit") {
        size = "12";
        inner = `<path d="M0 12L6 0L12 12" fill="none" stroke="${ink}" stroke-opacity="${o * 1.6}" stroke-width="1.6"/>`;
      } else if (kind === "denim") {
        size = "7";
        inner = `<path d="M-1 7L7 -1M0 8L8 0" stroke="${ink}" stroke-opacity="${o * 1.4}" stroke-width=".9"/>`;
      } else if (kind === "leather") {
        size = "14";
        inner = `<circle cx="3" cy="3" r="1.1" fill="${p.dark ? "#fff" : "#000"}" fill-opacity="${p.dark ? 0.09 : 0.07}"/><circle cx="10" cy="9" r="1.3" fill="${p.dark ? "#fff" : "#000"}" fill-opacity="${p.dark ? 0.08 : 0.06}"/><circle cx="12" cy="2" r=".8" fill="${p.dark ? "#fff" : "#000"}" fill-opacity="${p.dark ? 0.07 : 0.05}"/><circle cx="6" cy="12" r=".9" fill="${p.dark ? "#fff" : "#000"}" fill-opacity="${p.dark ? 0.07 : 0.05}"/>`;
      } else if (kind === "twill") {
        size = "6";
        inner = `<path d="M-1 6L6 -1" stroke="${ink}" stroke-opacity="${o * 0.9}" stroke-width=".8"/>`;
      }
      defs.push(`<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${inner}</pattern>`);
    }
    return id;
  };

  const ctx = {
    p,
    defs,
    uid,

    /** Forme remplie + ombrage + détails clippés + contour. */
    piece(d, o = {}) {
      const {
        fill = p.base,
        inner = "",
        texture = null,
        shade = "h",
        stroke = true,
        sw = 2.4,
        edge = p.edge,
        shadeOp = 1,
      } = o;
      const id = uid();
      defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
      const t = tex(texture);
      let s = `<path d="${d}" fill="${fill}"/>`;
      if (t) s += `<path d="${d}" fill="url(#${t})"/>`;
      if (shade) s += `<path d="${d}" fill="url(#sh-${shade})" opacity="${shadeOp}"/>`;
      if (inner) s += `<g clip-path="url(#${id})">${inner}</g>`;
      if (stroke) s += `<path d="${d}" fill="none" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round"/>`;
      return s;
    },

    /** Bande d'ombre douce (plis, creux). */
    band(d, w = 18, op = 0.22) {
      return `<path d="${d}" fill="none" stroke="${p.shc}" stroke-opacity="${(op * p.ksh).toFixed(3)}" stroke-width="${w}" stroke-linecap="round" filter="url(#${w >= 20 ? "soft2" : "soft"})"/>`;
    },
    /** Reflet doux. */
    glow(d, w = 18, op = 0.2) {
      const v = op * p.khi;
      if (v <= 0.001) return "";
      return `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${Math.min(v, 0.3).toFixed(3)}" stroke-width="${w}" stroke-linecap="round" filter="url(#${w >= 20 ? "soft2" : "soft"})"/>`;
    },
    /** Pli : ombre + fin trait + reflet voisin. */
    crease(d, o = {}) {
      const { w = 16, op = 0.2, dx = 12, line = 0.22 } = o;
      return (
        ctx.band(d, w, op) +
        `<path d="${d}" fill="none" stroke="${p.shc}" stroke-opacity="${(line * p.ksh).toFixed(3)}" stroke-width="1.6" stroke-linecap="round"/>` +
        `<g transform="translate(${dx} 0)">${ctx.glow(d, w * 0.9, op * 0.9)}</g>`
      );
    },
    seam(d, w = 2, op = 0.5, col = p.shc) {
      return `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    },
    stitch(d, o = {}) {
      const { w = 2, dash = "8 6", col = p.stitch, op = 0.8 } = o;
      return `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${w}" stroke-dasharray="${dash}" stroke-linecap="round"/>`;
    },
    button(x, y, r = 11, col = null) {
      const c = col ?? (p.light ? mix(p.base, "#fff", 0.4) : p.dark ? "#3a3632" : mix(p.base, "#fff", 0.22));
      const ring = mix(c, "#120b06", 0.35);
      return (
        `<circle cx="${x}" cy="${y + 2}" r="${r}" fill="#000" fill-opacity=".18" filter="url(#soft3)"/>` +
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${ring}" stroke-width="1.6"/>` +
        `<circle cx="${x}" cy="${y}" r="${(r * 0.62).toFixed(1)}" fill="none" stroke="${ring}" stroke-opacity=".6" stroke-width="1.2"/>` +
        `<circle cx="${x - r * 0.2}" cy="${y - r * 0.2}" r="1.7" fill="${ring}"/><circle cx="${x + r * 0.2}" cy="${y + r * 0.2}" r="1.7" fill="${ring}"/>`
      );
    },
    metalRing(x, y, r = 12, col = BRASS) {
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="${BRASS_DK}" stroke-width="1.6"/><circle cx="${x - r * 0.25}" cy="${y - r * 0.28}" r="${(r * 0.38).toFixed(1)}" fill="#fff" fill-opacity=".35"/>`;
    },
  };
  return ctx;
}

/* ------------------------------------------------------------------ défs globaux */

export const GLOBAL_DEFS = `
<linearGradient id="sh-h" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#1c120b" stop-opacity=".17"/><stop offset=".2" stop-color="#1c120b" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".1"/><stop offset=".8" stop-color="#1c120b" stop-opacity="0"/><stop offset="1" stop-color="#1c120b" stop-opacity=".2"/></linearGradient>
<linearGradient id="sh-v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".1"/><stop offset=".55" stop-color="#1c120b" stop-opacity="0"/><stop offset="1" stop-color="#1c120b" stop-opacity=".16"/></linearGradient>
<radialGradient id="sh-r" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff" stop-opacity=".14"/><stop offset=".6" stop-color="#1c120b" stop-opacity="0"/><stop offset="1" stop-color="#1c120b" stop-opacity=".2"/></radialGradient>
<filter id="soft" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2000" height="2400"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="soft2" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2000" height="2400"><feGaussianBlur stdDeviation="16"/></filter>
<filter id="soft3" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2000" height="2400"><feGaussianBlur stdDeviation="2.5"/></filter>
<filter id="ds" x="-25%" y="-20%" width="150%" height="150%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="26"/><feOffset dy="32" result="o1"/><feFlood flood-color="#5a4130" flood-opacity=".3"/><feComposite in2="o1" operator="in" result="s1"/><feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dy="7" result="o2"/><feFlood flood-color="#33241a" flood-opacity=".3"/><feComposite in2="o2" operator="in" result="s2"/><feMerge><feMergeNode in="s1"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="ds-s" x="-30%" y="-30%" width="160%" height="170%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="14"/><feOffset dy="18" result="o1"/><feFlood flood-color="#5a4130" flood-opacity=".26"/><feComposite in2="o1" operator="in" result="s1"/><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dy="4" result="o2"/><feFlood flood-color="#33241a" flood-opacity=".26"/><feComposite in2="o2" operator="in" result="s2"/><feMerge><feMergeNode in="s1"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

export const svgDoc = ({ w, h, bg, defs = "", content, label }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label ?? ""}">` +
  `<defs>${GLOBAL_DEFS}${defs}</defs><rect width="${w}" height="${h}" fill="${bg}"/>${content}</svg>\n`;

/* ------------------------------------------------------------------ arrière-plans */

/** Couleur de fond adaptée à la teinte du tissu (les clairs restent lisibles). */
export function bgFor(hex) {
  const L = lum(hex);
  let neutral;
  if (L > 0.75) neutral = "#d6c8b2";
  else if (L > 0.42) neutral = "#f1ebe1";
  else if (L > 0.12) neutral = "#e9e1d3";
  else if (L > 0.035) neutral = "#ece5da";
  else neutral = "#e6e0d6";
  return mix(neutral, hex, L > 0.75 ? 0.05 : 0.09);
}

/** Arche : rectangle à sommet semi-circulaire. */
export const arch = (x, y, w, h) => {
  const r = w / 2;
  return `M${x} ${y + h}V${y + r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h}Z`;
};

/** Décor ton sur ton (arches / cercle) en 3 variantes. */
export function decor(bg, variant, w = 1200, h = 1500) {
  const deep = mix(bg, "#6b5444", 0.07);
  const deeper = mix(bg, "#6b5444", 0.12);
  const pale = mix(bg, "#ffffff", 0.4);
  const v = variant % 3;
  if (v === 0) {
    return `<path d="${arch(170, 190, 860, h - 190)}" fill="${deep}"/><circle cx="600" cy="520" r="250" fill="${pale}" fill-opacity=".45"/>`;
  }
  if (v === 1) {
    return `<path d="${arch(430, 120, 700, h - 120)}" fill="${deep}"/><circle cx="330" cy="400" r="190" fill="${pale}" fill-opacity=".5"/><path d="${arch(60, 760, 330, h - 760)}" fill="${deeper}" fill-opacity=".7"/>`;
  }
  return `<path d="${arch(70, 280, 600, h - 280)}" fill="${deeper}" fill-opacity=".75"/><path d="${arch(300, 140, 820, h - 140)}" fill="${deep}"/><circle cx="880" cy="430" r="170" fill="${pale}" fill-opacity=".5"/>`;
}

/** Fine ombre de contact au sol / sur le support. */
export const groundShadow = (cx, cy, rx, ry, op = 0.18) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#5a4130" fill-opacity="${op}" filter="url(#soft2)"/>`;
