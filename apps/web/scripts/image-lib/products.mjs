/**
 * Assemble les scènes « packshot » des produits : fond ton sur ton, ombre portée, vêtement.
 */
import { coat, coatZoom, dress, dressZoom, pants, pantsZoom, tee, teeZoom, top, topZoom } from "./garments-a.mjs";
import {
  bag,
  bagZoom,
  belt,
  beltZoom,
  jacket,
  jacketZoom,
  silkScarf,
  silkScarfFolded,
  sweater,
  sweaterZoom,
  woolScarf,
  woolScarfZoom,
} from "./garments-b.mjs";
import { bgFor, decor, hash, makeCtx, svgDoc } from "./kit.mjs";

export const REGISTRY = {
  dress: { draw: dress, zoom: dressZoom, shift: -40, scale: 1.06 },
  top: { draw: top, zoom: topZoom, shift: 0, scale: [1.2, 1.1] },
  tee: { draw: tee, zoom: teeZoom, shift: 20, scale: [1.2, 1.15] },
  pants: { draw: pants, zoom: pantsZoom, shift: -10, scale: [1.14, 1.04] },
  coat: { draw: coat, zoom: coatZoom, shift: -45, scale: 1.06 },
  jacket: { draw: jacket, zoom: jacketZoom, shift: 20, scale: [1.14, 1.1] },
  sweater: { draw: sweater, zoom: sweaterZoom, shift: 30, scale: [1.2, 1.15] },
  bag: { draw: bag, zoom: bagZoom, shift: -10, scale: 1.1 },
  silkScarf: { draw: silkScarf, draw2: silkScarfFolded, shift: 0 },
  belt: { draw: belt, zoom: beltZoom, shift: 0 },
  woolScarf: { draw: woolScarf, zoom: woolScarfZoom, shift: 0 },
};

/**
 * @param {{hex:string, kind:keyof typeof REGISTRY, opts?:object, view:1|2, key:string, label:string}} a
 */
export function productSvg({ hex, kind, opts = {}, view, key, label }) {
  const spec = REGISTRY[kind];
  const bg = bgFor(hex);
  const c = makeCtx(hex, "g");
  const variant = hash(key) % 3;
  let content = decor(bg, view === 1 ? variant : variant + 1);

  const o = { ...opts, view };
  if (view === 2 && spec.draw2) {
    content += `<g filter="url(#ds)">${spec.draw2(c, o)}</g>`;
  } else if (view === 2) {
    const z = spec.zoom(o);
    content += `<g filter="url(#ds-s)" transform="translate(600 ${z.py}) rotate(${z.rot ?? 0}) scale(${z.s}) translate(${-z.fx} ${-z.fy})">${spec.draw(c, o)}</g>`;
  } else {
    content += `<g filter="url(#ds)" transform="translate(0 ${spec.shift ?? 0}) translate(600 750) scale(${[].concat(spec.scale ?? 1).join(" ")}) translate(-600 -750)">${spec.draw(c, o)}</g>`;
  }
  return svgDoc({ w: 1200, h: 1500, bg, defs: c.defs.join(""), content, label });
}

/**
 * Place une pièce dans une scène composée (catégories, hero, promo...). Le centre du dessin
 * (600, 750) est ramené en (x, y), puis mis à l'échelle `s` et pivoté de `rot` degrés.
 * Retourne { svg, defs }.
 */
export function place({ kind, hex, opts = {}, x, y, s = 1, rot = 0, pfx, shadow = "ds-s", view = 1 }) {
  const spec = REGISTRY[kind];
  const c = makeCtx(hex, pfx);
  const [sx, sy] = [].concat(spec.scale ?? 1).concat(spec.scale ?? 1).slice(0, 2);
  const svg =
    `<g filter="url(#${shadow})" transform="translate(${x} ${y}) rotate(${rot}) scale(${(sx * s).toFixed(3)} ${(sy * s).toFixed(3)}) translate(-600 -750)">` +
    spec.draw(c, { ...opts, view }) +
    `</g>`;
  return { svg, defs: c.defs.join("") };
}
