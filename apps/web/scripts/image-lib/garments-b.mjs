/* eslint-disable @typescript-eslint/no-unused-vars -- signatures homogènes (c, o) entre les dessins */
/**
 * Vêtements et accessoires (2/2) : vestes (bomber, cuir, jean), pull, sac cabas, foulard en soie,
 * ceinture, écharpe en laine. Repère 1200 x 1500, axe x = 600.
 */
import { BRASS, BRASS_DK, both, mix, poly, sym } from "./kit.mjs";

/* ================================================================== VESTES */

/** kind : "bomber" | "leather" | "denim" */
export function jacket(c, o = {}) {
  const { p } = c;
  const kind = o.kind ?? "bomber";
  const G = {
    bomber: { hem: 1010, side: 826, tex: "twill", y0: 300 },
    leather: { hem: 1110, side: 822, tex: "leather", y0: 300 },
    denim: { hem: 1090, side: 824, tex: "denim", y0: 296 },
  }[kind];
  const orange = "#c88d4d";
  const st = kind === "denim" ? { col: orange, op: 0.95, dash: "6 5", w: 2.2 } : { op: 0.42, dash: "6 5" };
  const bodyD = sym(
    [600, G.y0],
    [
      ["L", 676, 264],
      ["L", 842, 316],
      ["C", 818, 380, 808, 450, 806, 520],
      ["C", 810, 700, 820, 880, G.side, G.hem],
      ["L", 600, G.hem],
    ],
  );
  const cuffH = kind === "bomber" ? 74 : kind === "denim" ? 70 : 56;
  const sleeveD = "M842 316C925 490 980 780 1002 1060L892 1090C886 880 842 680 806 520Z";
  const cuff = poly([[1002, 1060], [892, 1090], [892 + 8, 1090 + cuffH], [1002 + 8, 1060 + cuffH]]);

  let s = "";
  // intérieur du col
  s += `<path d="M512 262C548 228 652 228 688 262L676 312C640 296 560 296 524 312Z" fill="${p.inn}"/>`;

  // manches
  s += both(
    c.piece(sleeveD, {
      texture: G.tex,
      inner:
        c.crease("M940 520C958 700 968 880 976 1040", { w: 24, op: 0.18, dx: 16 }) +
        c.crease("M892 760C906 860 916 960 920 1060", { w: 18, op: 0.15, dx: 12 }) +
        c.glow("M900 420C936 560 958 760 968 980", 34, kind === "leather" ? 0.4 : 0.16) +
        (kind === "leather"
          ? c.crease("M900 760C925 780 950 785 975 770", { w: 10, op: 0.18, dx: 0 }) + c.crease("M890 820C915 840 940 845 960 830", { w: 8, op: 0.14, dx: 0 })
          : "") +
        c.seam("M842 316C838 390 822 450 806 520", 2, 0.4) +
        (kind !== "bomber" ? c.stitch("M848 330C844 400 830 460 814 524", { ...st }) : ""),
    }),
  );
  // poignets
  s += both(
    c.piece(cuff, {
      fill: kind === "bomber" ? p.dk1 : p.base,
      texture: kind === "bomber" ? "rib" : G.tex,
      sw: 2.2,
      inner:
        (kind === "bomber" ? "" : c.stitch(`M${1002 + 6} ${1060 + 10}L${892 + 8} ${1090 + 10}`, { ...st }) + c.band("M1002 1060L892 1090", 12, 0.3)) +
        (kind === "bomber" ? c.band("M1002 1060L892 1090", 10, 0.25) : ""),
    }) + (kind === "denim" ? c.metalRing(932, 1136, 8) : kind === "leather" ? c.metalRing(938, 1120, 7) : ""),
  );
  // poche zippée sur la manche (bomber, côté gauche)
  if (kind === "bomber") {
    s += `<path d="M262 560L292 548L304 700L274 708Z" fill="${p.dk1}" stroke="${p.edge}" stroke-width="2"/><path d="M268 566L296 555" stroke="#c9c3b6" stroke-width="5" stroke-dasharray="2 2.4" />`;
  }

  // corps
  let bodyInner =
    c.band("M426 520C432 700 440 880 448 1000", 26, 0.15) +
    c.band("M774 520C768 700 760 880 752 1000", 26, 0.15) +
    c.crease("M520 520C522 700 524 880 526 1100", { w: 22, op: 0.1, dx: 16 }) +
    c.crease("M690 520C690 700 688 880 690 1100", { w: 22, op: 0.1, dx: 16 }) +
    c.glow("M470 380C480 560 490 780 490 980", 44, kind === "leather" ? 0.4 : 0.16) +
    c.glow("M730 380C722 560 712 780 712 980", 44, kind === "leather" ? 0.34 : 0.12) +
    c.seam("M676 264C720 290 790 305 842 316", 1.6, 0.25) +
    c.seam("M524 264C480 290 410 305 358 316", 1.6, 0.25);

  if (kind === "bomber") {
    bodyInner +=
      // tape de fermeture
      `<path d="M578 320H622V${G.hem}H578Z" fill="${p.dk1}" fill-opacity=".45"/>` +
      c.seam(`M578 320V${G.hem}M622 320V${G.hem}`, 1.6, 0.3) +
      // poches passepoilées
      `<path d="M700 700L722 860" stroke="${p.dk2}" stroke-width="10" stroke-linecap="round"/><path d="M700 700L722 860" stroke="#c9c3b6" stroke-width="3.5" stroke-dasharray="2 2.4" opacity=".8"/>` +
      `<path d="M500 700L478 860" stroke="${p.dk2}" stroke-width="10" stroke-linecap="round"/><path d="M500 700L478 860" stroke="#c9c3b6" stroke-width="3.5" stroke-dasharray="2 2.4" opacity=".8"/>` +
      c.band("M706 704L726 862", 8, 0.2);
  } else if (kind === "leather") {
    bodyInner +=
      `<path d="M578 320H622V${G.hem}H578Z" fill="${p.dk1}" fill-opacity=".4"/>` +
      c.seam(`M578 320V${G.hem}M622 320V${G.hem}`, 1.6, 0.3) +
      // empiècements d'épaule + coutures poitrine
      c.seam("M452 520C500 540 560 546 600 546", 1.6, 0.3) + c.seam("M748 520C700 540 640 546 600 546", 1.6, 0.3) +
      c.stitch("M458 530C504 550 562 556 600 556", { op: 0.34, dash: "5 5" }) +
      c.stitch("M742 530C696 550 638 556 600 556", { op: 0.34, dash: "5 5" }) +
      // poches zippées en biais
      `<path d="M690 760L740 900" stroke="${p.dk2}" stroke-width="11" stroke-linecap="round"/><path d="M690 760L740 900" stroke="${BRASS}" stroke-width="4" stroke-dasharray="2 2.4"/>` +
      `<path d="M510 760L460 900" stroke="${p.dk2}" stroke-width="11" stroke-linecap="round"/><path d="M510 760L460 900" stroke="${BRASS}" stroke-width="4" stroke-dasharray="2 2.4"/>` +
      // ceinture basse
      `<path d="M394 ${G.hem - 60}H806V${G.hem}H394Z" fill="${p.base}" fill-opacity=".001"/>` +
      c.seam(`M380 ${G.hem - 62}Q600 ${G.hem - 44} 820 ${G.hem - 62}`, 2, 0.45) +
      c.stitch(`M386 ${G.hem - 52}Q600 ${G.hem - 34} 814 ${G.hem - 52}`, { ...st }) +
      c.crease("M440 900C470 920 510 930 540 920", { w: 10, op: 0.1, dx: 0 });
  } else {
    bodyInner +=
      `<path d="M578 320H622V${G.hem}H578Z" fill="${p.dk1}" fill-opacity=".3"/>` +
      c.seam(`M578 320V${G.hem}M622 320V${G.hem}`, 1.6, 0.4) +
      c.stitch(`M570 320V${G.hem}M630 320V${G.hem}`, { ...st }) +
      // piqûres de plastron
      c.seam("M470 470C520 500 570 510 600 510", 1.8, 0.4) + c.seam("M730 470C680 500 630 510 600 510", 1.8, 0.4) +
      c.stitch("M472 480C520 510 570 520 600 520", { ...st }) +
      c.stitch("M728 480C680 510 630 520 600 520", { ...st }) +
      // poches poitrine à rabat
      [[432, 520], [670, 520]]
        .map(
          ([x, y]) =>
            `<path d="M${x} ${y}H${x + 100}V${y + 96}Q${x + 50} ${y + 116} ${x} ${y + 96}Z" fill="${p.base}" stroke="${p.edge}" stroke-width="2"/><path d="M${x} ${y}H${x + 100}V${y + 96}Q${x + 50} ${y + 116} ${x} ${y + 96}Z" fill="url(#sh-v)"/>` +
            `<path d="M${x + 6} ${y + 6}H${x + 94}V${y + 90}Q${x + 50} ${y + 108} ${x + 6} ${y + 90}Z" fill="none" stroke="${orange}" stroke-opacity=".9" stroke-width="2" stroke-dasharray="6 5"/>` +
            c.band(`M${x} ${y + 100}Q${x + 50} ${y + 120} ${x + 100} ${y + 100}`, 8, 0.2) +
            c.metalRing(x + 50, y + 70, 6.5),
        )
        .join("") +
      // ceinture
      c.seam(`M378 ${G.hem - 76}Q600 ${G.hem - 58} 822 ${G.hem - 76}`, 2, 0.5) +
      c.stitch(`M384 ${G.hem - 66}Q600 ${G.hem - 48} 816 ${G.hem - 66}`, { ...st }) +
      c.stitch(`M386 ${G.hem - 12}Q600 ${G.hem + 4} 814 ${G.hem - 12}`, { ...st }) +
      c.metalRing(404, G.hem - 38, 8) + c.metalRing(796, G.hem - 38, 8);
  }
  s += c.piece(bodyD, { texture: G.tex, inner: bodyInner });

  // bande côtelée du bas (bomber)
  if (kind === "bomber") {
    const rib = sym([600, G.hem - 6], [["L", 826, G.hem - 6], ["L", 812, G.hem + 84], ["L", 600, G.hem + 84]]);
    s += c.piece(rib, { fill: p.dk1, texture: "rib", shade: "v", sw: 2.2, inner: c.band(`M370 ${G.hem - 4}H830`, 10, 0.3) });
  }

  // fermeture à glissière
  if (kind !== "denim") {
    const end = G.hem + (kind === "bomber" ? 84 : 0);
    s += `<path d="M600 330V${end}" stroke="#7d7568" stroke-width="10" />`;
    s += `<path d="M600 330V${end}" stroke="${kind === "leather" ? BRASS : "#d4cec2"}" stroke-width="7" stroke-dasharray="2.6 2.6"/>`;
    s += `<rect x="591" y="${end - 14}" width="18" height="22" rx="3" fill="${BRASS_DK}" opacity=".9"/>`;
    s += `<path d="M600 322V366" stroke="${BRASS_DK}" stroke-width="2"/><rect x="590" y="322" width="20" height="42" rx="9" fill="${kind === "leather" ? BRASS : "#cfc8ba"}" stroke="${BRASS_DK}" stroke-width="1.8"/><rect x="595" y="336" width="10" height="18" rx="4" fill="${p.inn}" />`;
  } else {
    const ys = [340, 440, 540, 640, 740, 840, 940, 1030];
    s += ys.map((y) => c.metalRing(600, y, 11)).join("");
  }

  // col
  if (kind === "bomber") {
    s += c.piece("M500 322C494 262 524 222 600 218C676 222 706 262 700 322L626 340L600 336L574 340Z", {
      fill: p.dk1,
      texture: "rib",
      shade: "v",
      sw: 2.2,
      inner: c.band("M510 316C560 330 640 330 690 316", 12, 0.28),
    });
    s += `<path d="M534 292C532 262 560 246 600 244C640 246 668 262 666 292C640 282 560 282 534 292Z" fill="${p.inn}"/>`;
  } else if (kind === "leather") {
    s += c.piece("M504 316C500 262 526 226 600 222C674 226 700 262 696 316L630 340L600 336L570 340Z", {
      texture: "leather",
      shade: "v",
      sw: 2.2,
      inner: c.band("M510 318C560 332 640 332 690 318", 12, 0.3) + c.glow("M520 262C560 240 640 240 680 262", 14, 0.3) + c.stitch("M516 300C560 316 640 316 684 300", { ...st }),
    });
    s += `<path d="M534 288C532 262 560 246 600 244C640 246 668 262 666 288C640 280 560 280 534 288Z" fill="${p.inn}"/>`;
    s += c.metalRing(600, 322, 7);
  } else {
    // col chemise en jean
    s += both(
      c.piece("M603 306L688 246C730 276 758 312 768 362C700 362 640 340 603 306Z", {
        texture: "denim",
        shade: "v",
        sw: 2.2,
        inner: c.band("M610 320C660 344 720 356 764 358", 12, 0.28) + c.stitch("M616 312C656 336 710 350 756 352", { ...st }),
      }),
    );
    s += `<path d="M560 262C580 248 620 248 640 262" fill="none" stroke="${p.dk1}" stroke-width="9" stroke-linecap="round" stroke-opacity=".6"/>`;
  }
  return s;
}
export const jacketZoom = (o) => ({ fx: 600, fy: 420, s: 2.0, py: 700 });

/* ================================================================== PULL */

export function sweater(c, o = {}) {
  const { p } = c;
  const body = sym(
    [600, 380],
    [
      ["C", 645, 380, 688, 340, 692, 258],
      ["L", 838, 318],
      ["C", 822, 380, 812, 440, 810, 500],
      ["C", 816, 700, 820, 860, 822, 1056],
      ["L", 600, 1056],
    ],
  );
  const sleeve = "M838 318C908 450 968 770 992 1034L890 1062C882 860 832 650 810 500Z";
  const cuff = poly([[992, 1034], [890, 1062], [898, 1136], [1000, 1108]]);
  let s = `<path d="M532 252C538 316 568 346 600 346C632 346 662 316 668 252C640 238 560 238 532 252Z" fill="${p.inn}"/>`;
  s += both(
    c.piece(sleeve, {
      texture: "knit",
      inner:
        c.crease("M930 540C950 700 962 860 970 1010", { w: 24, op: 0.16, dx: 16 }) +
        c.crease("M888 760C904 860 912 950 916 1040", { w: 18, op: 0.12, dx: 12 }) +
        c.glow("M900 440C930 580 952 780 962 980", 34, 0.16) +
        c.seam("M838 318C834 390 820 450 810 500", 2, 0.3),
    }) + c.piece(cuff, { fill: p.dk1, texture: "rib", shade: "v", sw: 2.2, inner: c.band("M992 1034L890 1062", 12, 0.3) }),
  );
  s += c.piece(body, {
    texture: "knit",
    inner:
      c.band("M426 520C432 700 440 860 446 1040", 28, 0.15) +
      c.band("M774 520C768 700 760 860 754 1040", 28, 0.15) +
      c.crease("M522 640C522 800 524 940 526 1040", { w: 24, op: 0.1, dx: 16 }) +
      c.crease("M690 640C690 800 688 940 690 1040", { w: 24, op: 0.1, dx: 16 }) +
      c.glow("M600 480C602 700 604 860 604 1040", 70, 0.1) +
      c.seam("M838 318C834 390 820 450 810 500", 2, 0.3) +
      c.seam("M362 318C366 390 380 450 390 500", 2, 0.3),
  });
  // côtes de bas
  const rib = sym([600, 1050], [["L", 826, 1050], ["L", 822, 1138], ["L", 600, 1138]]);
  s += c.piece(rib, { fill: p.dk1, texture: "rib", shade: "v", sw: 2.2, inner: c.band("M370 1052H830", 10, 0.3) });
  // encolure côtelée
  const neck = "M508 258C512 340 560 382 600 382C640 382 688 340 692 258";
  s += `<path d="${neck}" fill="none" stroke="${p.dk1}" stroke-width="34"/>`;
  s += `<path d="${neck}" fill="none" stroke="url(#sh-r)" stroke-width="34"/>`;
  s += `<path d="${neck}" fill="none" stroke="${p.stitch}" stroke-opacity=".28" stroke-width="2.4" stroke-dasharray="1 8" stroke-linecap="round" transform="translate(0 -5)"/>`;
  s += `<path d="${neck}" fill="none" stroke="${p.edge}" stroke-opacity=".45" stroke-width="1.6" transform="translate(0 16)"/>`;
  s += `<path d="M532 252C560 236 640 236 668 252" fill="none" stroke="${p.dk1}" stroke-width="14"/>`;
  return s;
}
export const sweaterZoom = () => ({ fx: 600, fy: 340, s: 2.35, py: 680 });

/* ================================================================== SAC CABAS */

export function bag(c, o = {}) {
  const { p } = c;
  let s = "";
  // anse arrière
  const backHandle = "M440 600C424 300 776 300 760 600";
  s += `<path d="${backHandle}" fill="none" stroke="${p.edge}" stroke-width="40" stroke-linecap="round"/><path d="${backHandle}" fill="none" stroke="${p.dk2}" stroke-width="34" stroke-linecap="round"/>`;
  // intérieur
  s += `<path d="M284 604C390 560 810 560 916 604L934 640L266 640Z" fill="${p.inn}"/>`;
  s += `<path d="M300 604C400 570 800 570 900 604" fill="none" stroke="${p.dk2}" stroke-width="10"/>`;
  // corps
  const body = "M262 612C440 628 760 628 938 612L972 1236Q974 1284 930 1284H270Q226 1284 228 1236Z";
  s += c.piece(body, {
    texture: "leather",
    shade: "h",
    inner:
      c.band("M270 640L248 1240", 30, 0.22) +
      c.band("M930 640L952 1240", 30, 0.22) +
      c.glow("M400 660C410 840 420 1020 430 1230", 70, 0.18) +
      c.glow("M780 650C784 800 790 1000 796 1200", 40, 0.1) +
      c.crease("M330 700C380 740 440 750 480 735", { w: 12, op: 0.12, dx: 0 }) +
      c.crease("M870 700C820 740 760 750 720 735", { w: 12, op: 0.12, dx: 0 }) +
      c.crease("M600 650C602 700 600 740 598 770", { w: 14, op: 0.1, dx: 10 }) +
      // base
      c.seam("M232 1214Q600 1244 968 1214", 2, 0.4) +
      c.stitch("M240 1196Q600 1226 960 1196", { op: 0.4 }) +
      c.band("M232 1230Q600 1262 968 1230", 24, 0.22) +
      // couture de bord
      c.stitch("M270 650C440 662 760 662 930 650", { op: 0.45 }) +
      // languette de fermeture aimantée
      `<path d="M566 628H634V690Q600 706 566 690Z" fill="${p.dk1}" stroke="${p.edge}" stroke-width="2"/>` +
      c.metalRing(600, 668, 8),
  });
  // bord supérieur (ourlet roulé)
  s += `<path d="M262 612C440 628 760 628 938 612" fill="none" stroke="${p.dk1}" stroke-width="16" stroke-linecap="round"/>`;
  s += `<path d="M262 608C440 624 760 624 938 608" fill="none" stroke="${p.lt1}" stroke-opacity=".5" stroke-width="3"/>`;
  // anse avant
  const handle = "M364 664C336 304 864 304 836 664";
  s += `<path d="${handle}" fill="none" stroke="${p.edge}" stroke-width="46" stroke-linecap="round"/><path d="${handle}" fill="none" stroke="${p.base}" stroke-width="40" stroke-linecap="round"/><path d="${handle}" fill="none" stroke="url(#sh-v)" stroke-width="40"/>`;
  s += `<path d="${handle}" fill="none" stroke="${p.lt1}" stroke-opacity="${p.dark ? 0.35 : 0.5}" stroke-width="8" stroke-linecap="round" transform="translate(-4 -6)"/>`;
  s += `<path d="${handle}" fill="none" stroke="${p.stitch}" stroke-opacity=".6" stroke-width="2" stroke-dasharray="8 6" transform="translate(0 2)"/>`;
  // plaques d'ancrage des anses
  for (const x of [364, 836]) {
    s += c.piece(`M${x - 44} 620H${x + 44}V716Q${x} 728 ${x - 44} 716Z`, {
      fill: p.dk1,
      shade: "v",
      sw: 2.2,
      inner: c.stitch(`M${x - 34} 632H${x + 34}V704Q${x} 714 ${x - 34} 704Z`, { op: 0.55 }) + c.stitch(`M${x - 34} 632L${x + 34} 704M${x + 34} 632L${x - 34} 704`, { op: 0.4, dash: "5 5" }),
    });
    s += c.metalRing(x - 24, 646, 6) + c.metalRing(x + 24, 646, 6);
  }
  return s;
}
export const bagZoom = () => ({ fx: 600, fy: 560, s: 1.85, py: 720 });

/* ================================================================== FOULARD EN SOIE */

function silkMotif(c, id) {
  const { p } = c;
  const a = p.dark ? "#fff" : p.shc;
  const o1 = p.dark ? 0.12 : 0.16;
  c.defs.push(
    `<pattern id="${id}" width="70" height="70" patternUnits="userSpaceOnUse"><circle cx="35" cy="35" r="5" fill="${a}" fill-opacity="${o1}"/><path d="M35 8L45 35L35 62L25 35Z" fill="none" stroke="${a}" stroke-opacity="${o1}" stroke-width="1.8"/><circle cx="0" cy="0" r="4" fill="${a}" fill-opacity="${o1 * 0.8}"/><circle cx="70" cy="0" r="4" fill="${a}" fill-opacity="${o1 * 0.8}"/><circle cx="0" cy="70" r="4" fill="${a}" fill-opacity="${o1 * 0.8}"/><circle cx="70" cy="70" r="4" fill="${a}" fill-opacity="${o1 * 0.8}"/></pattern>`,
  );
}

export function silkScarf(c) {
  const { p } = c;
  const id = c.uid() + "-motif";
  silkMotif(c, id);
  const sq = (r, b) => `M${-r} ${-r}Q20 ${-r - b * 1.2} ${r} ${-r}Q${r + b * 0.5} 30 ${r} ${r}Q-30 ${r + b * 1.1} ${-r} ${r}Q${-r - b * 0.7} -20 ${-r} ${-r}Z`;
  const outer = sq(372, 14);
  const border = sq(318, 10);
  const inner = sq(296, 8);
  const mid = sq(190, 6);
  let s = `<g transform="translate(600 750) rotate(33)">`;
  s += c.piece(outer, {
    fill: p.base,
    shade: "h",
    sw: 2.4,
    inner:
      `<path d="${outer}" fill="url(#${id})"/>` +
      // bord roulotté
      `<path d="${sq(362, 13)}" fill="none" stroke="${p.shc}" stroke-opacity="${0.28 * p.ksh}" stroke-width="3"/>` +
      `<path d="${border}" fill="none" stroke="${p.shc}" stroke-opacity="${0.45 * p.ksh}" stroke-width="3"/>` +
      `<path d="${inner}" fill="none" stroke="${p.shc}" stroke-opacity="${0.35 * p.ksh}" stroke-width="1.6"/>` +
      `<path d="${sq(332, 11)}" fill="none" stroke="${p.lt2}" stroke-opacity=".6" stroke-width="2"/>` +
      `<path d="${mid}" fill="none" stroke="${p.shc}" stroke-opacity="${0.3 * p.ksh}" stroke-width="2"/>` +
      `<circle r="104" fill="none" stroke="${p.shc}" stroke-opacity="${0.3 * p.ksh}" stroke-width="2"/>` +
      `<circle r="70" fill="${p.shc}" fill-opacity="${0.1 * p.ksh}"/>` +
      Array.from({ length: 8 }, (_, i) => `<path d="M0 -150Q26 -126 0 -100Q-26 -126 0 -150Z" fill="${p.shc}" fill-opacity="${0.18 * p.ksh}" transform="rotate(${i * 45})"/>`).join("") +
      // plis et reflets de la soie
      c.crease("M-360 -150C-220 -60 60 -190 360 -70", { w: 34, op: 0.13, dx: 0 }) +
      c.crease("M-360 160C-170 80 150 210 360 120", { w: 30, op: 0.12, dx: 0 }) +
      c.glow("M-330 -250C-120 -120 80 60 330 250", 90, 0.09) +
      c.band("M300 -372L372 -300", 40, 0.3) +
      c.band("M-372 300L-300 372", 40, 0.3),
  });
  s += `</g>`;
  return s;
}

export function silkScarfFolded(c) {
  const { p } = c;
  const id = c.uid() + "-motif";
  silkMotif(c, id);
  let s = "";
  // couches empilées
  s += c.piece("M238 1160H962V1190Q600 1214 238 1190Z", { fill: p.dk2, shade: "v", sw: 2, inner: c.seam("M238 1176Q600 1200 962 1176", 1.4, 0.4) });
  s += c.piece("M240 1130H960V1166Q600 1190 240 1166Z", { fill: p.dk1, shade: "v", sw: 2, inner: c.seam("M240 1148Q600 1172 960 1148", 1.4, 0.4) });
  const top = "M250 470Q600 452 950 470V1136Q600 1156 250 1136Z";
  s += c.piece(top, {
    shade: "h",
    inner:
      `<path d="${top}" fill="url(#${id})"/>` +
      `<path d="M276 498Q600 482 924 498V1112Q600 1130 276 1112Z" fill="none" stroke="${p.shc}" stroke-opacity="${0.4 * p.ksh}" stroke-width="2.4"/>` +
      `<path d="M306 528Q600 514 894 528V1084Q600 1100 306 1084Z" fill="none" stroke="${p.shc}" stroke-opacity="${0.3 * p.ksh}" stroke-width="1.6"/>` +
      `<circle cx="600" cy="800" r="150" fill="none" stroke="${p.shc}" stroke-opacity="${0.3 * p.ksh}" stroke-width="2"/>` +
      `<circle cx="600" cy="800" r="86" fill="${p.shc}" fill-opacity="${0.1 * p.ksh}"/>` +
      Array.from({ length: 8 }, (_, i) => `<path d="M0 -140Q24 -118 0 -92Q-24 -118 0 -140Z" fill="${p.shc}" fill-opacity="${0.18 * p.ksh}" transform="translate(600 800) rotate(${i * 45})"/>`).join("") +
      c.crease("M250 800Q600 780 950 800", { w: 26, op: 0.2, dx: 0 }) +
      c.crease("M420 470C410 700 430 900 420 1140", { w: 24, op: 0.1, dx: 14 }) +
      c.glow("M520 480C560 700 540 900 580 1130", 60, 0.2) +
      c.band("M250 1120Q600 1140 950 1120", 20, 0.25),
  });
  // coin retourné
  s += c.piece("M950 470V690L730 470Z", { fill: p.lt1, shade: "v", sw: 2.2, inner: c.band("M950 690L730 470", 16, 0.4) });
  return s;
}

/* ================================================================== CEINTURE */

export function belt(c, o = {}) {
  const { p } = c;
  let s = "";
  const strap = "M176 716H1004V786H176L112 774Q76 751 112 728Z";
  let inner =
    c.band("M110 724H1004", 10, 0.3) +
    c.band("M110 778H1004", 10, 0.3) +
    c.glow("M120 740H1000", 14, 0.4) +
    c.stitch("M150 728H996M150 774H996", { op: 0.6, dash: "9 6" }) +
    c.crease("M410 716Q426 750 410 786", { w: 10, op: 0.14, dx: 0 }) +
    c.crease("M640 716Q624 750 640 786", { w: 10, op: 0.12, dx: 0 });
  const holes = [260, 322, 384, 446, 508].map((x) => `<ellipse cx="${x}" cy="751" rx="9" ry="10" fill="${p.inn}" stroke="${p.edge}" stroke-width="2"/><ellipse cx="${x}" cy="749" rx="6" ry="6.5" fill="#000" fill-opacity=".35"/>`).join("");
  s += c.piece(strap, { texture: "leather", shade: "v", sw: 2.4, inner: inner + holes });
  // passant
  s += c.piece("M894 704H934V798H894Z", { fill: p.dk1, texture: "leather", shade: "h", sw: 2.2, inner: c.stitch("M900 712V790M928 712V790", { op: 0.4, dash: "5 5" }) });
  // boucle
  const frame = "M994 668H1130Q1150 668 1150 688V814Q1150 834 1130 834H994Q974 834 974 814V688Q974 668 994 668ZM1002 694V808H1122V694Z";
  s += `<path d="${frame}" fill="${BRASS}" fill-rule="evenodd" stroke="${BRASS_DK}" stroke-width="2.4"/>`;
  s += `<path d="${frame}" fill="url(#sh-r)" fill-rule="evenodd"/>`;
  s += `<path d="M982 676H1136" stroke="#fff" stroke-opacity=".4" stroke-width="5" stroke-linecap="round"/>`;
  // ardillon
  s += `<path d="M1010 751H1114" stroke="${BRASS_DK}" stroke-width="12" stroke-linecap="round"/><path d="M1010 749H1112" stroke="${BRASS}" stroke-width="7" stroke-linecap="round"/>`;
  s += `<path d="M1002 716V786" stroke="${BRASS_DK}" stroke-width="3"/>`;
  s += `<path d="M1002 714H1004V788H1002Z" fill="${p.dk2}"/>`;
  return o.view === 2 ? s : `<g transform="rotate(-36 600 750)">${s}</g>`;
}
export const beltZoom = () => ({ fx: 1040, fy: 750, s: 2.0, py: 720, rot: -14 });

/* ================================================================== ÉCHARPE EN LAINE */

export function woolScarf(c, o = {}) {
  const { p } = c;
  let s = "";
  const lenL = 1236;
  const lenR = 1176;
  const stripe = (x0, x1, y, h, op) => `<path d="M${x0} ${y}H${x1}V${y + h}H${x0}Z" fill="${p.dk2}" fill-opacity="${op}"/>`;
  const fringe = (x0, x1, y0) => {
    let d = "";
    for (let x = x0 + 8; x < x1; x += 11) d += `M${x} ${y0 - 6}V${y0 + 96 + ((x * 7) % 13)}`;
    return `<path d="${d}" fill="none" stroke="${p.dk3}" stroke-width="7.6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${p.base}" stroke-width="5.4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${p.lt2}" stroke-opacity=".28" stroke-width="1.4" stroke-linecap="round" transform="translate(-1 0)"/>`;
  };
  s += `<g transform="rotate(-3 600 750)">`;
  s += fringe(332, 598, lenL);
  s += fringe(602, 868, lenR);
  const left = `M332 330Q332 276 392 276H598V${lenL}H332Z`;
  const right = `M602 276H808Q868 276 868 330V${lenR}H602Z`;
  s += c.piece(left, {
    texture: "knit",
    shade: "h",
    inner:
      stripe(320, 600, lenL - 190, 22, 0.35) + stripe(320, 600, lenL - 150, 8, 0.3) +
      c.crease("M420 300C424 600 418 900 426 1200", { w: 22, op: 0.1, dx: 16 }) +
      c.band("M340 300V1230", 22, 0.18) + c.band("M598 300V1230", 18, 0.24) +
      c.crease("M334 300Q460 360 598 330", { w: 16, op: 0.18, dx: 0 }),
  });
  s += c.piece(right, {
    texture: "knit",
    shade: "h",
    inner:
      stripe(602, 880, lenR - 190, 22, 0.35) + stripe(602, 880, lenR - 150, 8, 0.3) +
      c.crease("M740 300C738 600 744 900 736 1160", { w: 22, op: 0.1, dx: 16 }) +
      c.band("M860 300V1170", 22, 0.18) + c.band("M606 300V1170", 18, 0.26) +
      c.crease("M602 330Q740 300 868 340", { w: 16, op: 0.18, dx: 0 }) +
      c.glow("M650 400C660 700 650 900 660 1100", 50, 0.14),
  });
  s += `</g>`;
  return s;
}
export const woolScarfZoom = () => ({ fx: 600, fy: 1160, s: 2.1, py: 760 });

export const _unused = { mix };
