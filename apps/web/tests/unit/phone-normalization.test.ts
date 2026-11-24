import { normalizePhone } from "@fashion/shared";
import { algerianPhoneRegex } from "@fashion/validators";
import { describe, expect, it } from "vitest";

/* ── Anciennes implémentations, recopiées telles quelles pour prouver la compatibilité (phase 0) ── */
/** Copie de l'API (`apps/api/src/utils/phone.ts`) et du service de démonstration : a écrit tous les `phoneKey` existants. */
const legacyApi = (phone: string): string => phone.replace(/\D/g, "").replace(/^213/, "0").replace(/^00213/, "0");
/** Copie de l'interface (`order-utils.ts`). */
const legacyWeb = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00213")) return `0${digits.slice(5)}`;
  if (digits.startsWith("213")) return `0${digits.slice(3)}`;
  return digits;
};

/** Générateur pseudo-aléatoire déterministe (le test doit être reproductible). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const PREFIXES = ["0", "+213", "00213"] as const;
const SEPARATORS = ["", " ", ".", "-"] as const;

/** Toutes les écritures d'un même numéro (« 5 » + 8 chiffres) acceptées par `algerianPhoneRegex`. */
function writtenForms(local9: string): string[] {
  const forms: string[] = [];
  for (const prefix of PREFIXES) {
    for (const afterPrefix of ["", " "]) {
      for (const sep of SEPARATORS) {
        const [first = "", ...rest] = local9.split("");
        forms.push(`${prefix}${afterPrefix}${first}${rest.map((d) => `${sep}${d}`).join("")}`);
      }
    }
  }
  return forms;
}

describe("normalizePhone (implémentation unique, @fashion/shared)", () => {
  it("garde les exemples historiques", () => {
    expect(normalizePhone("+213 555 12 34 56")).toBe("0555123456");
    expect(normalizePhone("00213555123456")).toBe("0555123456");
    expect(normalizePhone("0555 12 34 56")).toBe("0555123456");
    expect(normalizePhone("213555123456")).toBe("0555123456");
  });

  it("donne le même résultat que les deux anciennes copies pour TOUS les formats acceptés", () => {
    const rand = rng(2026);
    let checked = 0;
    for (let i = 0; i < 600; i += 1) {
      const lead = String(5 + Math.floor(rand() * 3)); // 5, 6 ou 7
      const body = Array.from({ length: 8 }, () => Math.floor(rand() * 10)).join("");
      for (const form of writtenForms(lead + body)) {
        expect(algerianPhoneRegex.test(form), `format attendu valide : ${form}`).toBe(true);
        const key = normalizePhone(form);
        expect(key, form).toBe(legacyApi(form));
        expect(key, form).toBe(legacyWeb(form));
        checked += 1;
      }
    }
    expect(checked).toBe(600 * PREFIXES.length * 2 * SEPARATORS.length);
  });

  it("toutes les écritures d'un même numéro donnent la même clé, au format de la future contrainte (0[5-7] + 8 chiffres)", () => {
    for (const local9 of ["555123456", "661000001", "770999999", "512345678"]) {
      const keys = new Set(writtenForms(local9).map(normalizePhone));
      expect(keys).toEqual(new Set([`0${local9}`]));
      expect([...keys][0]).toMatch(/^0[5-7][0-9]{8}$/);
    }
  });

  it("est idempotente : normaliser une clé déjà normalisée ne la change pas", () => {
    for (const form of writtenForms("555123456")) {
      const key = normalizePhone(form);
      expect(normalizePhone(key)).toBe(key);
    }
  });

  it("reste identique à l'implémentation qui a écrit les phoneKey, même sur des chaînes non valides (aucune clé existante ne change)", () => {
    const rand = rng(7);
    const alphabet = "0123456789 +.-()abc/";
    for (let i = 0; i < 20_000; i += 1) {
      const len = Math.floor(rand() * 18);
      const input = Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
      expect(normalizePhone(input), JSON.stringify(input)).toBe(legacyApi(input));
    }
  });

  it("rejette par le validateur les numéros hors format algérien (la normalisation ne les valide jamais)", () => {
    for (const bad of ["0455123456", "055512345", "05551234567", "+33 6 12 34 56 78", "abc", ""]) {
      expect(algerianPhoneRegex.test(bad), bad).toBe(false);
    }
  });
});
