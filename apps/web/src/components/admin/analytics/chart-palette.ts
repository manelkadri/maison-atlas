const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;

/** Couleur de série n° i (variables du thème, cyclique). */
export const chartColor = (i: number): string => PALETTE[i % PALETTE.length] ?? PALETTE[0];
