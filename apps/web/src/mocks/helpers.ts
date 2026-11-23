/**
 * Utilitaires pour fabriquer des données de DÉMONSTRATION déterministes.
 * Aucune donnée réelle : tout ce qui se trouve dans /mocks est fictif.
 */

const DAY = 24 * 3600 * 1000;

/** Début de la journée courante (UTC) : stable pendant la journée, évite les écarts SSR/CSR. */
const TODAY = (() => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
})();

/** Date ISO située `days` jours avant aujourd'hui, à l'heure `hour` (UTC). */
export function daysAgo(days: number, hour = 10, minute = 0): string {
  return new Date(TODAY - days * DAY + hour * 3600 * 1000 + minute * 60 * 1000).toISOString();
}

export function daysFromNow(days: number, hour = 10): string {
  return daysAgo(-days, hour);
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)] as T,
    chance: (p: number) => next() < p,
  };
}

export function pad(n: number, len = 3): string {
  return String(n).padStart(len, "0");
}
