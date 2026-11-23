/* eslint-disable @typescript-eslint/no-unused-vars -- signatures homogènes (c, o) entre les dessins */
/**
 * Vêtements (1/2) : robe, hauts à manches longues (chemise/blouse/chemisier), t-shirt/polo,
 * pantalons, manteau. Chaque fonction dessine dans un repère 1200 x 1500, axe de symétrie x = 600.
 */
import { BRASS, BRASS_DK, PEARL, both, mix, poly, sym } from "./kit.mjs";

/* ================================================================== ROBE */

export function dress(c, o = {}) {
  const { p } = c;
  const satin = o.kind !== "linen";
  const hemR = "M936 1330C840 1372 720 1392 600 1392C480 1392 360 1372 264 1330";

  let s = "";
  let d;
  if (satin) {
    d = sym(
      [600, 440],
      [
        ["Q", 646, 330, 672, 238],
        ["L", 800, 268],
        ["C", 852, 292, 892, 340, 906, 402],
        ["L", 818, 456],
        ["C", 806, 520, 792, 570, 780, 628],
        ["C", 804, 850, 862, 1100, 936, 1330],
        ["C", 840, 1372, 720, 1392, 600, 1392],
      ],
    );
    // dos de l'encolure vu par l'ouverture en V
    s += `<path d="M528 240C560 216 640 216 672 240L600 440Z" fill="${p.inn}"/>`;
    s += c.piece(d, {
      inner:
        // volume du buste et pinces
        c.band("M470 470C480 520 500 560 540 610", 22, 0.18) +
        c.band("M730 470C720 520 700 560 660 610", 22, 0.18) +
        c.glow("M545 380C545 450 560 520 585 600", 30, 0.2) +
        // taille
        c.crease("M418 614Q600 646 782 614", { w: 16, op: 0.2, dx: 0 }) +
        c.stitch("M418 628Q600 660 782 628", { op: 0.4 }) +
        // plis du satin qui tombent de la taille
        c.crease("M556 650C540 860 500 1100 438 1360", { w: 26, op: 0.22, dx: 22 }) +
        c.crease("M648 650C664 870 704 1100 770 1370", { w: 26, op: 0.2, dx: 22 }) +
        c.crease("M490 640C455 880 395 1110 330 1330", { w: 22, op: 0.18, dx: 18 }) +
        c.crease("M712 640C752 870 806 1110 872 1340", { w: 22, op: 0.18, dx: 18 }) +
        c.glow("M600 700C606 900 626 1120 650 1370", 34, 0.22) +
        c.glow("M520 760C500 950 450 1150 400 1340", 30, 0.16) +
        // manches
        c.seam("M800 268C822 340 818 400 818 456", 2, 0.4) +
        c.band("M812 300C836 360 838 420 828 460", 16, 0.2) +
        // pied de robe : surpiqûre
        `<g transform="translate(0 -26)">${c.stitch(hemR, { op: 0.45 })}</g>` +
        c.band("M300 1330C400 1368 500 1384 600 1384C700 1384 800 1368 900 1330", 22, 0.22),
    });
    // finition de l'encolure
    s += `<path d="M600 440Q646 330 672 238M600 440Q554 330 528 238" fill="none" stroke="${p.dk2}" stroke-width="13" stroke-linecap="round" stroke-opacity=".75"/>`;
    s += c.seam("M600 440Q640 335 664 246M600 440Q560 335 536 246", 1.6, 0.35);
  } else {
    d = sym(
      [600, 330],
      [
        ["C", 640, 330, 680, 300, 684, 240],
        ["L", 806, 268],
        ["C", 856, 292, 896, 342, 908, 404],
        ["L", 822, 460],
        ["C", 810, 520, 796, 572, 784, 630],
        ["C", 808, 860, 872, 1110, 936, 1330],
        ["C", 840, 1372, 720, 1392, 600, 1392],
      ],
    );
    s += `<path d="M516 240C540 222 660 222 684 240C680 300 640 330 600 330C560 330 520 300 516 240Z" fill="${p.dk2}"/>`;
    const buttons = [];
    for (let y = 380, i = 0; y < 1250; y += 88, i++) buttons.push(c.button(600, y, 11, PEARL));
    s += c.piece(d, {
      texture: "linen",
      inner:
        c.band("M470 470C480 520 500 570 530 628", 20, 0.14) +
        c.crease("M524 660C510 860 470 1100 410 1340", { w: 24, op: 0.16, dx: 20 }) +
        c.crease("M690 660C706 870 750 1100 810 1350", { w: 24, op: 0.16, dx: 20 }) +
        c.crease("M452 640C430 880 380 1110 320 1320", { w: 20, op: 0.14, dx: 16 }) +
        c.crease("M760 640C788 880 830 1110 892 1330", { w: 20, op: 0.14, dx: 16 }) +
        // sous-patte
        `<path d="M574 328H626V1392H574Z" fill="${p.dk1}" fill-opacity=".35"/>` +
        c.seam("M574 330V1392M626 330V1392", 1.6, 0.4) +
        c.stitch("M583 336V1392M617 336V1392", { op: 0.4, dash: "6 6" }) +
        buttons.join("") +
        // manches
        c.seam("M806 268C826 340 822 410 822 460", 2, 0.4) +
        `<g transform="translate(0 -26)">${c.stitch(hemR, { op: 0.4 })}</g>` +
        c.band("M300 1330C400 1368 500 1384 600 1384C700 1384 800 1368 900 1330", 22, 0.2),
    });
    // ceinture à nouer
    const belt = "M418 600Q600 618 786 600L792 654Q600 676 410 654Z";
    s += c.piece(belt, { fill: p.dk1, shade: "v", texture: "linen", sw: 2 });
    s += c.stitch("M424 612Q600 630 780 612M420 642Q600 664 786 642", { op: 0.4, dash: "6 5" });
    s += c.piece("M612 626C676 584 744 596 728 640C714 672 650 654 612 632Z", { fill: p.dk1, sw: 2 });
    s += c.piece("M588 626C530 590 470 604 480 644C490 672 552 654 588 634Z", { fill: p.dk1, sw: 2 });
    s += c.piece("M594 640C586 720 566 800 538 884L584 896C606 808 618 726 612 646Z", { fill: p.dk1, sw: 2 });
    s += c.piece("M606 640C632 720 666 790 698 856L740 836C706 756 664 700 626 640Z", { fill: p.dk1, sw: 2 });
    s += c.piece("M584 622H620V652H584Z", { fill: p.dk2, sw: 1.8, shade: "v" });
    s += c.seam("M604 626V650", 1.4, 0.4);
    // liseré d'encolure
    s += `<path d="M516 240C520 300 560 330 600 330C640 330 680 300 684 240" fill="none" stroke="${p.dk1}" stroke-width="12" stroke-linecap="round"/>`;
    s += c.seam("M520 246C526 296 562 322 600 322C638 322 674 296 680 246", 1.4, 0.35);
  }
  return s;
}
export const dressZoom = (o) => (o.kind === "linen" ? { fx: 600, fy: 440, s: 2.15, py: 700 } : { fx: 640, fy: 470, s: 2.1, py: 700 });

/* ================================================================== HAUTS À MANCHES LONGUES */

/**
 * kind : "oxford" | "linen" | "silk" | "tie"
 */
export function top(c, o = {}) {
  const { p } = c;
  const kind = o.kind ?? "oxford";
  const silk = kind === "silk";
  const tie = kind === "tie";
  const soft = silk || tie;
  const tex = kind === "linen" ? "linen" : kind === "oxford" ? "twill" : null;

  // géométrie
  const hemY = soft ? 1205 : 1255;
  const sideX = soft ? 832 : 822;
  const body = sym(
    [600, 290],
    [
      ["L", 690, 262],
      ["L", 842, 302],
      ["C", 818, 362, 806, 424, 803, 484],
      ["C", 808, 700, soft ? 820 : 812, 1000, sideX, hemY - 70],
      ["Q", sideX - 4, hemY, 730, hemY + 4],
      ["Q", 660, hemY + (soft ? 12 : 6), 600, hemY + (soft ? 12 : 6)],
    ],
  );
  const sleeve = tie
    ? "M842 302C910 440 972 760 1004 1000L890 1030C880 850 832 640 803 484Z"
    : "M842 302C902 430 960 760 988 1010L886 1040C880 860 830 640 803 484Z";
  const cuffPts = tie
    ? [[1004, 1000], [890, 1030], [896, 1100], [1000, 1072]]
    : [[988, 1010], [886, 1040], [894, 1114], [994, 1086]];

  let s = "";
  // dos du col visible
  s += `<path d="M520 262C550 230 650 230 680 262L676 292C640 272 560 272 524 292Z" fill="${p.base}" stroke="${p.edge}" stroke-width="2"/><path d="M540 268C570 248 630 248 660 268L650 286C620 274 580 274 550 286Z" fill="${p.inn}"/>`;

  // manches (derrière le corps)
  const sl = (flip) =>
    c.piece(sleeve, {
      texture: tex,
      inner:
        c.crease("M930 520C950 680 960 840 968 990", { w: 20, op: 0.16, dx: 14 }) +
        c.crease("M890 760C906 860 914 940 918 1030", { w: 16, op: 0.14, dx: 12 }) +
        c.glow("M900 420C930 560 950 760 962 960", 30, 0.14) +
        (kind === "linen" ? c.crease("M850 560C880 600 900 640 930 640", { w: 12, op: 0.1 }) : "") +
        // surpiqûre de couture d'épaule
        c.seam("M842 302C838 380 822 440 803 484", 2, 0.35),
    });
  s += both(sl());

  // poignets
  const cuff = poly(cuffPts);
  s += both(
    c.piece(cuff, {
      texture: tex,
      sw: 2.2,
      inner: c.stitch(`M${cuffPts[0][0] - 6} ${cuffPts[0][1] + 8}L${cuffPts[1][0] + 8} ${cuffPts[1][1] + 10}`, { op: 0.5, dash: "5 5" }) + c.band(`M${cuffPts[0][0]} ${cuffPts[0][1]}L${cuffPts[1][0]} ${cuffPts[1][1]}`, 12, 0.3),
    }) +
      c.button((cuffPts[0][0] + cuffPts[3][0]) / 2 - 22, (cuffPts[0][1] + cuffPts[3][1]) / 2 + 2, 8.5, kind === "silk" || tie ? undefined : undefined),
  );

  // corps
  const buttons = [];
  const nBtn = soft ? 6 : 8;
  for (let i = 0; i < nBtn; i++) {
    const y = (soft ? 420 : 392) + i * (soft ? 150 : 108);
    if (soft && silk && i > 0) continue;
    buttons.push(c.button(600, y, 10.5));
  }
  const hemCurve = `M${sideX} ${hemY - 70}Q${sideX - 4} ${hemY} 730 ${hemY + 4}Q660 ${hemY + (soft ? 12 : 6)} 600 ${hemY + (soft ? 12 : 6)}Q540 ${hemY + (soft ? 12 : 6)} 470 ${hemY + 4}Q${1200 - sideX + 4} ${hemY} ${1200 - sideX} ${hemY - 70}`;
  s += c.piece(body, {
    texture: tex,
    inner:
      // volume : plis sous le col, côtés, taille
      c.band("M420 520C430 700 440 900 440 1200", 24, 0.14) +
      c.band("M780 520C770 700 760 900 760 1200", 24, 0.14) +
      c.crease("M520 520C520 700 524 900 526 1260", { w: 22, op: 0.1, dx: 16 }) +
      c.crease("M690 520C690 700 686 900 690 1260", { w: 22, op: 0.1, dx: 16 }) +
      (soft
        ? c.glow("M470 420C500 600 520 800 500 1100", 40, 0.14) +
          c.glow("M740 420C710 600 690 800 710 1100", 40, 0.12)
        : c.crease("M470 900C500 960 540 1000 580 1010", { w: 14, op: 0.08, dx: 0 })) +
      // patte de boutonnage
      `<path d="M578 300H622V${hemY + 20}H578Z" fill="${p.dk1}" fill-opacity="${silk ? 0.18 : 0.28}"/>` +
      c.seam(`M578 300V${hemY + 20}M622 300V${hemY + 20}`, 1.6, silk ? 0.25 : 0.35) +
      c.stitch(`M586 300V${hemY + 20}M614 300V${hemY + 20}`, { op: silk ? 0.2 : 0.38, dash: "6 6" }) +
      buttons.join("") +
      // empiècement dos / emmanchures
      c.seam("M700 270C780 300 820 310 842 302", 1.4, 0.2) +
      c.stitch(hemCurve.replace(/(\d+\.?\d*) (\d+\.?\d*)/g, (m, x, y) => `${x} ${(+y - 22).toFixed(1)}`), { op: 0.35, dash: "6 6" }) +
      (kind === "oxford"
        ? // poche poitrine
          `<g><path d="M442 480H540L540 590Q491 604 442 590Z" fill="${p.base}" stroke="${p.edge}" stroke-width="2" stroke-opacity=".7"/>` +
          c.stitch("M449 488H533V580Q491 592 449 580Z", { op: 0.5, dash: "5 5" }) +
          `<path d="M442 480H540L540 590Q491 604 442 590Z" fill="url(#sh-v)"/></g>`
        : ""),
  });

  // col
  if (silk || tie) {
    // col lavallière / col à nouer : noeud + deux pans
    const bowCol = p.dk1;
    s += `<path d="M508 262C540 226 660 226 692 262L694 290C650 266 550 266 506 290Z" fill="${p.dk1}" stroke="${p.edge}" stroke-width="2"/>`;
    s += c.piece("M614 306C690 252 770 276 734 336C712 372 650 350 614 316Z", { fill: bowCol, sw: 2, inner: c.band("M640 306C690 290 722 310 724 336", 12, 0.25) + c.glow("M650 300C690 280 720 292 728 312", 10, 0.2) });
    s += c.piece("M586 306C510 252 430 276 466 336C488 372 550 350 586 316Z", { fill: bowCol, sw: 2, inner: c.band("M560 306C510 290 478 310 476 336", 12, 0.25) + c.glow("M550 300C510 280 480 292 472 312", 10, 0.2) });
    s += c.piece("M596 326C584 410 560 480 530 566L578 580C604 490 616 410 612 332Z", { fill: bowCol, sw: 2, inner: c.crease("M590 380C580 450 566 520 548 570", { w: 10, op: 0.2, dx: 8 }) });
    s += c.piece("M604 326C628 410 664 480 700 546L744 524C706 450 664 390 626 326Z", { fill: bowCol, sw: 2, inner: c.crease("M626 380C654 440 684 490 712 530", { w: 10, op: 0.2, dx: -8 }) });
    s += c.piece("M580 308H624V344Q602 354 580 344Z", { fill: p.dk2, sw: 2, shade: "r" });
  } else {
    const italian = kind === "linen";
    const leaf = italian
      ? "M603 302L694 234C738 262 770 308 782 366C706 364 644 340 603 302Z"
      : "M603 300L694 234C732 264 756 306 764 360C700 362 640 338 603 300Z";
    s += both(
      c.piece(leaf, {
        fill: p.base,
        texture: tex,
        shade: "v",
        sw: 2.2,
        inner:
          c.band(italian ? "M610 312C660 336 720 346 764 350" : "M610 308C660 330 710 340 744 342", 12, 0.26) +
          c.stitch(italian ? "M616 304C650 326 710 340 756 342" : "M616 302C650 322 700 334 738 336", { op: 0.4, dash: "5 5" }),
      }) +
        (kind === "oxford" ? c.button(752, 350, 6.5) : ""),
    );

  }
  return s;
}
export const topZoom = (o) => (o.kind === "silk" || o.kind === "tie" ? { fx: 600, fy: 340, s: 2.4, py: 640 } : { fx: 610, fy: 340, s: 2.5, py: 650 });

/* ================================================================== T-SHIRT / POLO */

export function tee(c, o = {}) {
  const { p } = c;
  const polo = !!o.polo;
  const tex = polo ? "knit" : null;
  const startY = polo ? 300 : 365;
  const first = polo
    ? [["L", 692, 256]]
    : [["C", 645, 365, 688, 330, 692, 256]];
  const body = sym(
    [600, startY],
    [
      ...first,
      ["L", 846, 304],
      ["L", 1004, 466],
      ["L", 906, 566],
      ["L", 810, 508],
      ["C", 812, 720, 814, 900, 818, 1090],
      ["Q", 720, 1112, 600, 1112],
    ],
  );
  let s = "";
  if (!polo) {
    s += `<path d="M532 252C538 310 568 340 600 340C632 340 662 310 668 252C640 238 560 238 532 252Z" fill="${p.inn}"/>`;
  }
  s += c.piece(body, {
    texture: tex,
    inner:
      c.band("M420 520C430 700 436 900 436 1080", 26, 0.14) +
      c.band("M780 520C770 700 764 900 764 1080", 26, 0.14) +
      c.crease("M520 640C520 800 524 940 526 1090", { w: 24, op: 0.1, dx: 16 }) +
      c.crease("M690 640C690 800 686 940 690 1090", { w: 24, op: 0.1, dx: 16 }) +
      c.glow("M600 520C602 700 604 900 604 1080", 60, 0.1) +
      // couture d'épaule et d'emmanchure
      c.seam("M846 304C842 400 830 470 810 508", 2, 0.35) +
      c.seam("M354 304C358 400 370 470 390 508", 2, 0.35) +
      // ourlets de manche
      c.stitch("M996 484L901 578M1000 500L906 592", { op: 0.4, dash: "5 5" }) +
      c.stitch("M204 484L299 578M200 500L294 592", { op: 0.4, dash: "5 5" }) +
      c.stitch("M386 1068Q600 1086 814 1068", { op: 0.4 }) +
      // sleeve cuff shadow
      c.band("M1002 468L908 564", 14, 0.28) +
      c.band("M198 468L292 564", 14, 0.28),
  });

  if (!polo) {
    const neck = "M508 256C512 330 555 365 600 365C645 365 688 330 692 256";
    s += `<path d="${neck}" fill="none" stroke="${p.dk1}" stroke-width="26" stroke-linecap="butt"/>`;
    s += `<path d="${neck}" fill="none" stroke="url(#sh-r)" stroke-width="26"/>`;
    s += `<path d="${neck}" fill="none" stroke="${p.edge}" stroke-width="1.8" stroke-opacity=".6" transform="translate(0 -12)"/>`;
    s += `<path d="M508 256C512 330 555 365 600 365C645 365 688 330 692 256" fill="none" stroke="${p.stitch}" stroke-opacity=".22" stroke-width="1.6" stroke-dasharray="5 5" transform="translate(0 10)"/>`;
    s += `<path d="M532 252C560 236 640 236 668 252" fill="none" stroke="${p.dk1}" stroke-width="13"/>`;
  } else {
    // col polo
    s += `<path d="M512 262C546 226 654 226 688 262L684 292C650 268 550 268 516 292Z" fill="${p.dk1}" stroke="${p.edge}" stroke-width="2"/><path d="M540 268C570 248 630 248 660 268L650 284C620 272 580 272 550 284Z" fill="${p.inn}"/>`;
    s += both(
      c.piece("M603 304C640 270 668 242 696 234L764 336C706 350 650 338 603 310Z", {
        texture: tex,
        shade: "v",
        sw: 2.2,
        inner: c.band("M612 318C660 338 716 344 760 338", 12, 0.3) + c.stitch("M618 308C656 328 706 336 752 330", { op: 0.4, dash: "5 5" }),
      }),
    );
    // patte de boutonnage
    s += c.piece("M574 296H626V496H574Z", {
      texture: tex,
      shade: "v",
      sw: 2.2,
      inner:
        c.seam("M586 300V496M614 300V496", 1.4, 0.3) +
        c.button(600, 356, 10.5) +
        c.button(600, 420, 10.5) +
        c.button(600, 478, 10.5) +
        c.band("M574 296H626", 12, 0.3),
    });

  }
  return s;
}
export const teeZoom = (o) => (o.polo ? { fx: 610, fy: 360, s: 2.35, py: 680 } : { fx: 600, fy: 340, s: 2.35, py: 660 });

/* ================================================================== PANTALONS */

/**
 * kind : "wide" | "tailor" | "chino" | "jean"
 */
export function pants(c, o = {}) {
  const { p } = c;
  const kind = o.kind ?? "wide";
  const G = {
    wide: { hip: 890, hemO: 970, hemI: 640, hemY: 1345, tex: null, crotch: 680, waist: 830 },
    tailor: { hip: 866, hemO: 868, hemI: 640, hemY: 1340, tex: null, crotch: 670, waist: 822 },
    chino: { hip: 856, hemO: 830, hemI: 652, hemY: 1335, tex: "twill", crotch: 666, waist: 820 },
    jean: { hip: 856, hemO: 838, hemI: 652, hemY: 1335, tex: "denim", crotch: 666, waist: 820 },
  }[kind];
  const body = sym(
    [600, 214],
    [
      ["L", G.waist, 214],
      ["C", G.waist + 14, 330, G.hip - 18, 470, G.hip, 620],
      ["C", G.hip + 16, 820, G.hemO - 14, 1100, G.hemO, G.hemY],
      ["L", G.hemI, G.hemY + 8],
      ["C", G.hemI - 8, 1100, 622, 880, 600, G.crotch],
    ],
  );
  let s = "";
  const hemStitch = `M${G.hemO - 12} ${G.hemY - 42}L${G.hemI + 8} ${G.hemY - 36}`;
  const fly = kind === "jean" || kind === "chino";
  const pleats = kind === "wide" || kind === "tailor";
  s += c.piece(body, {
    texture: G.tex,
    inner:
      // volume des jambes
      c.band("M434 560C430 800 440 1100 460 1330", 28, 0.14) +
      c.band("M766 560C770 800 760 1100 740 1330", 28, 0.14) +
      c.glow("M520 700C524 900 540 1120 548 1320", 50, 0.1) +
      c.glow("M690 700C688 900 680 1120 676 1320", 50, 0.1) +
      // entrejambe
      c.band(`M600 ${G.crotch - 10}C566 ${G.crotch - 60} 540 ${G.crotch - 100} 520 ${G.crotch - 160}`, 14, 0.07) +
      c.band(`M600 ${G.crotch - 10}C634 ${G.crotch - 60} 660 ${G.crotch - 100} 680 ${G.crotch - 160}`, 14, 0.07) +
      (pleats
        ? c.crease("M510 250C500 330 496 420 500 520", { w: 20, op: 0.2, dx: 14 }) +
          c.crease("M690 250C700 330 704 420 700 520", { w: 20, op: 0.2, dx: -14 }) +
          // pli de repassage
          c.seam(`M${kind === "wide" ? 492 : 480} 560L${kind === "wide" ? 438 : 470} ${G.hemY - 10}`, 1.6, 0.18) +
          c.seam(`M${kind === "wide" ? 708 : 720} 560L${kind === "wide" ? 762 : 730} ${G.hemY - 10}`, 1.6, 0.18) +
          c.crease("M470 560C462 800 458 1100 470 1330", { w: 16, op: 0.08, dx: 20 })
        : c.crease("M470 560C462 800 466 1100 476 1330", { w: 16, op: 0.1, dx: 18 }) +
          c.crease("M730 560C738 800 734 1100 724 1330", { w: 16, op: 0.1, dx: -18 })) +
      // braguette
      c.seam(`M600 270V${fly ? 480 : 440}`, 1.8, 0.4) +
      c.stitch(`M622 270V420Q622 468 598 486`, { op: 0.5, dash: "6 5" }) +
      // poches latérales
      (pleats
        ? c.seam("M806 270C786 320 782 380 790 440", 2, 0.45) + c.seam("M394 270C414 320 418 380 410 440", 2, 0.45) + c.band("M806 280C790 330 786 380 792 440", 10, 0.25) + c.band("M394 280C410 330 414 380 408 440", 10, 0.25)
        : kind === "jean"
          ? // poches avant jean en arrondi
            c.seam("M820 270C770 280 700 300 670 360C664 420 700 470 744 490", 2, 0.55) + c.stitch("M814 284C770 294 708 314 684 364C682 410 706 450 740 474", { col: "#c88d4d", op: 0.95, dash: "6 5", w: 2.2 }) + c.seam("M380 270C430 280 500 300 530 360C536 420 500 470 456 490", 2, 0.55) + c.stitch("M386 284C430 294 492 314 516 364C518 410 494 450 460 474", { col: "#c88d4d", op: 0.95, dash: "6 5", w: 2.2 }) + `<rect x="676" y="372" width="76" height="76" rx="6" fill="none" stroke="#c88d4d" stroke-width="2" stroke-dasharray="6 5" stroke-opacity=".9" transform="translate(40 -50)"/>`
            : c.seam("M814 280C770 320 744 380 740 450", 2, 0.5) + c.seam("M386 280C430 320 456 380 460 450", 2, 0.5) + c.band("M806 290C772 328 750 380 746 440", 10, 0.2) + c.band("M394 290C428 328 450 380 454 440", 10, 0.2)) +
      c.stitch(hemStitch, { op: 0.4 }) +
      c.stitch(`M${1200 - G.hemO + 12} ${G.hemY - 42}L${1200 - G.hemI - 8} ${G.hemY - 36}`, { op: 0.4 }) +
      // pli au genou
      c.crease("M430 880C470 900 520 900 560 880", { w: 12, op: 0.1, dx: 0 }) +
      c.crease("M770 880C730 900 680 900 640 880", { w: 12, op: 0.1, dx: 0 }),
  });

  // ceinture
  const wb = `M${1200 - G.waist - 4} 206H${G.waist + 4}V282Q600 296 ${1200 - G.waist - 4} 282Z`;
  s += c.piece(wb, {
    fill: p.dk1,
    shade: "v",
    texture: G.tex,
    sw: 2.2,
    inner: c.stitch(`M${1200 - G.waist} 214H${G.waist}M${1200 - G.waist} 270Q600 284 ${G.waist} 270`, { op: 0.4, dash: "6 5" }),
  });
  // passants
  const loops = [410, 500, 700, 790].map((x) => {
    return `<rect x="${x - 11}" y="198" width="22" height="94" rx="5" fill="${p.dk1}" stroke="${p.edge}" stroke-width="1.6"/><path d="M${x - 6} 206V284M${x + 6} 206V284" stroke="${p.stitch}" stroke-opacity=".4" stroke-width="1.3" fill="none"/>`;
  });
  s += loops.join("");
  // bouton / rivet
  s += kind === "jean" ? c.metalRing(640, 244, 14) : c.button(646, 244, 12);
  if (kind === "jean") {
    s += c.metalRing(372, 296 + 10, 6) + c.metalRing(828, 306, 6);
  }
  return s;
}
export const pantsZoom = (o) => ({ fx: 600, fy: 340, s: 2.2, py: 720 });

/* ================================================================== MANTEAU LONG */

export function coat(c, o = {}) {
  const { p } = c;
  const body = sym(
    [600, 300],
    [
      ["L", 692, 232],
      ["L", 870, 292],
      ["C", 852, 380, 842, 470, 838, 530],
      ["C", 852, 800, 882, 1100, 906, 1380],
      ["Q", 760, 1396, 600, 1396],
    ],
  );
  const sleeve = "M870 292C952 480 1012 800 1044 1120L930 1152C926 900 880 700 838 530Z";
  const cuff = "M1044 1120L930 1152L938 1214L1052 1182Z";
  let s = "";
  s += `<path d="M510 236C550 212 650 212 690 236L600 520Z" fill="${p.inn}"/>`;
  s += both(
    c.piece(sleeve, {
      texture: "twill",
      inner:
        c.crease("M960 560C985 760 1004 940 1012 1100", { w: 26, op: 0.16, dx: 18 }) +
        c.crease("M906 700C920 840 930 980 934 1130", { w: 20, op: 0.14, dx: 14 }) +
        c.glow("M930 440C960 620 990 860 1004 1060", 34, 0.14) +
        c.seam("M870 292C860 400 850 480 838 530", 2, 0.4) +
        c.stitch("M1040 1090L934 1122", { op: 0.4 }),
    }) +
      c.piece(cuff, { texture: "twill", sw: 2, inner: c.stitch("M1046 1136L934 1168M1048 1198L938 1196", { op: 0.4 }) }) +
      c.button(1000, 1178, 9),
  );
  s += c.piece(body, {
    texture: "twill",
    inner:
      c.band("M440 560C448 800 462 1100 478 1380", 30, 0.14) +
      c.band("M760 560C752 800 738 1100 722 1380", 30, 0.14) +
      c.crease("M500 700C500 900 504 1150 510 1380", { w: 26, op: 0.12, dx: 18 }) +
      c.crease("M700 700C702 900 706 1150 710 1380", { w: 26, op: 0.12, dx: 18 }) +
      c.glow("M610 560C612 800 616 1100 618 1380", 70, 0.1) +
      // chevauchement croisé : bord de la patte
      `<path d="M510 530C508 800 508 1100 508 1396H690V530Z" fill="${p.base}" fill-opacity=".001"/>` +
      c.band("M506 540C502 800 502 1100 504 1390", 14, 0.32) +
      c.seam("M508 540V1396", 2, 0.5) +
      c.stitch("M524 552V1396", { op: 0.4, dash: "7 6" }) +
      // boutons croisés
      [560, 700, 840].map((y) => c.button(574, y, 14) + c.button(716, y, 14)).join("") +
      // poches plaquées
      [
        "M690 920H800L806 1084H690Z",
        "M394 920H504L504 1084H394Z",
      ]
        .map(
          (d) =>
            `<path d="${d}" fill="${p.base}" stroke="${p.edge}" stroke-width="2.2" stroke-opacity=".8"/><path d="${d}" fill="url(#sh-v)"/>` +
            `<path d="${d}" fill="none" stroke="${p.stitch}" stroke-opacity=".5" stroke-width="1.8" stroke-dasharray="6 5" transform="translate(0 0)" />`,
        )
        .join("") +
      c.band("M690 926H802", 10, 0.3) +
      c.band("M394 926H506", 10, 0.3) +
      // épaule, ourlet
      c.seam("M870 292C860 400 850 480 838 530", 2, 0.35) +
      c.stitch("M398 1356Q600 1380 802 1356", { op: 0.4 }),
  });
  // revers
  const lapel = "M690 234L776 324L752 352L802 438L690 548L600 520Z";
  s += both(
    c.piece(lapel, {
      fill: p.base,
      texture: "twill",
      shade: "v",
      sw: 2.4,
      inner:
        c.band("M690 234C680 360 660 440 640 520", 18, 0.26) +
        c.stitch("M700 262L772 330L748 356L792 432", { op: 0.4, dash: "5 5" }) +
        c.glow("M740 340C750 400 740 450 700 520", 24, 0.14),
    }),
  );
  // col montant
  s += `<path d="M512 238C550 214 650 214 688 238" fill="none" stroke="${p.dk2}" stroke-width="22" stroke-linecap="round"/>`;
  return s;
}
export const coatZoom = () => ({ fx: 600, fy: 440, s: 2.0, py: 700 });

export const _unused = { BRASS, BRASS_DK, PEARL, mix };
