import { Prisma } from "@prisma/client";
import { normalizePhone } from "@fashion/shared";
import { describe, expect, it } from "vitest";
import { normalizedPhoneSql } from "../src/modules/orders/service";
import { prisma } from "./helpers";

/** Générateur pseudo-aléatoire déterministe. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Exécute l'expression SQL RÉELLE de la recherche par téléphone sur une liste de chaînes. */
async function sqlKeys(inputs: string[]): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ i: number; k: string }>>(
    Prisma.sql`SELECT t.i::int AS i, ${normalizedPhoneSql(Prisma.sql`t.v`)} AS k FROM unnest(${inputs}::text[]) WITH ORDINALITY AS t(v, i) ORDER BY t.i`,
  );
  return rows.map((r) => r.k);
}

describe("normalisation du téléphone : TypeScript (@fashion/shared) et SQL (recherche admin des commandes)", () => {
  it("donnent exactement la même clé pour les formats algériens courants", async () => {
    const forms: string[] = [];
    for (const prefix of ["0", "+213", "00213", "213"]) {
      for (const sep of ["", " ", ".", "-"]) {
        forms.push(`${prefix} 5${sep}5${sep}5${sep}1${sep}2${sep}3${sep}4${sep}5${sep}6`, `${prefix}6${sep}61${sep}00${sep}00${sep}01`, `${prefix}${sep}770${sep}999${sep}999`);
      }
    }
    expect(await sqlKeys(forms)).toEqual(forms.map(normalizePhone));
  });

  it("donnent exactement la même clé sur 20 000 chaînes quelconques (chiffres, séparateurs, lettres, chiffres arabes-indiens)", async () => {
    const rand = rng(4242);
    const alphabet = "0123456789 +.-()abc/٠١٢٣٤٥٦٧٨٩\t";
    const inputs = Array.from({ length: 20_000 }, () => {
      const len = Math.floor(rand() * 20);
      return Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
    });
    // Cas limites explicites : préfixes imbriqués, chaîne vide, uniquement des séparateurs.
    inputs.push("", "   ", "213", "00213", "2130213555123456", "00213 0213 555", "+213+213", "213213555123456");
    const sql = await sqlKeys(inputs);
    expect(sql).toHaveLength(inputs.length);
    for (let i = 0; i < inputs.length; i += 1) {
      if (sql[i] !== normalizePhone(inputs[i]!)) expect.fail(`divergence sur ${JSON.stringify(inputs[i])} : SQL=${JSON.stringify(sql[i])} TS=${JSON.stringify(normalizePhone(inputs[i]!))}`);
    }
  });
});
