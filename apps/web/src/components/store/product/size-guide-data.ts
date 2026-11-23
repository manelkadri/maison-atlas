/**
 * Tableaux de correspondance des tailles (mesures du corps, en cm).
 * Valeurs indicatives de la maison : à ajuster avec le propriétaire si les coupes diffèrent.
 */

export type SizeGuideRow = {
  /** Taille en lettres. */
  letter: string;
  /** Taille numérique (équivalence FR/EU). */
  numeric: string;
  chest: string;
  waist: string;
  hips: string;
};

export type SizeGuideKind = "women";

export const SIZE_GUIDE: Record<SizeGuideKind, { title: string; rows: SizeGuideRow[] }> = {
  women: {
    title: "Femme",
    rows: [
      { letter: "XS", numeric: "36", chest: "80 – 84", waist: "62 – 66", hips: "88 – 92" },
      { letter: "S", numeric: "38", chest: "84 – 88", waist: "66 – 70", hips: "92 – 96" },
      { letter: "M", numeric: "40", chest: "88 – 92", waist: "70 – 74", hips: "96 – 100" },
      { letter: "L", numeric: "42", chest: "92 – 96", waist: "74 – 78", hips: "100 – 104" },
      { letter: "XL", numeric: "44", chest: "96 – 102", waist: "78 – 84", hips: "104 – 110" },
      { letter: "XXL", numeric: "46", chest: "102 – 108", waist: "84 – 90", hips: "110 – 116" },
    ],
  },
};

export const MEASURING_TIPS: ReadonlyArray<{ label: string; text: string }> = [
  { label: "Tour de poitrine", text: "Mesurez à l'endroit le plus fort de la poitrine, mètre horizontal, sans serrer." },
  { label: "Tour de taille", text: "Mesurez à l'endroit le plus étroit du buste, au-dessus du nombril." },
  { label: "Tour de hanches", text: "Mesurez à l'endroit le plus large des hanches, pieds joints." },
];

/** Vrai si le produit n'a qu'une taille unique (accessoires) : pas de guide à afficher. */
export function isOneSizeOnly(sizes: string[]): boolean {
  return sizes.length > 0 && sizes.every((s) => s.toLowerCase() === "unique");
}
