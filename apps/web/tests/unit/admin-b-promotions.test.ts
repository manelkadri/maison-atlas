import { formatDZD } from "@fashion/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
  endDateToIso,
  filterPromotions,
  formatPromotionValue,
  getPromotionStatus,
  isoToDateInput,
  startDateToIso,
} from "@/features/promotions/logic";
import { promotionService } from "@/services";
import { resetDb } from "@/services/mock/db";
import type { Promotion } from "@/types/promotion.types";

beforeEach(() => {
  resetDb();
});

const NOW = new Date("2026-06-15T12:00:00.000Z");

const promo = (over: Partial<Promotion>): Promotion => ({
  id: "p",
  code: "TEST10",
  label: "Test",
  type: "percentage",
  value: 10,
  startsAt: "2026-06-01T00:00:00.000Z",
  endsAt: "2026-06-30T23:59:59.000Z",
  minOrderAmount: 0,
  isActive: true,
  usageCount: 0,
  createdAt: "2026-05-01T00:00:00.000Z",
  ...over,
});

describe("statut calculé d'une promotion", () => {
  it("Active : activée et dans sa période", () => {
    expect(getPromotionStatus(promo({}), NOW)).toBe("active");
  });
  it("Programmée : activée mais pas encore commencée", () => {
    expect(getPromotionStatus(promo({ startsAt: "2026-07-01T00:00:00.000Z", endsAt: "2026-07-31T00:00:00.000Z" }), NOW)).toBe("scheduled");
  });
  it("Expirée : activée mais terminée", () => {
    expect(getPromotionStatus(promo({ startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-02-01T00:00:00.000Z" }), NOW)).toBe("expired");
  });
  it("Inactive : désactivée à la main, quelle que soit la période", () => {
    expect(getPromotionStatus(promo({ isActive: false }), NOW)).toBe("inactive");
    expect(getPromotionStatus(promo({ isActive: false, endsAt: "2026-02-01T00:00:00.000Z" }), NOW)).toBe("inactive");
  });
  it("les bornes de période sont incluses", () => {
    expect(getPromotionStatus(promo({ startsAt: NOW.toISOString() }), NOW)).toBe("active");
    expect(getPromotionStatus(promo({ endsAt: NOW.toISOString() }), NOW)).toBe("active");
  });
  it("est cohérent avec les données de démonstration", async () => {
    const all = await promotionService.getPromotions();
    const byCode = Object.fromEntries(all.map((p) => [p.code, getPromotionStatus(p)]));
    expect(byCode["BIENVENUE10"]).toBe("active");
    expect(byCode["SOLDES20"]).toBe("inactive");
    expect(byCode["RENTREE15"]).toBe("scheduled");
  });
});

describe("présentation et filtres", () => {
  it("formate la réduction", () => {
    expect(formatPromotionValue({ type: "percentage", value: 10 })).toBe("10 %");
    expect(formatPromotionValue({ type: "fixed", value: 1500 })).toBe(formatDZD(1500));
  });

  it("filtre par statut et par recherche", () => {
    const list = [
      promo({ id: "1", code: "AAA" }),
      promo({ id: "2", code: "BBB", isActive: false }),
      promo({ id: "3", code: "CCC", endsAt: "2026-01-01T00:00:00.000Z", startsAt: "2025-12-01T00:00:00.000Z" }),
    ];
    expect(filterPromotions(list, { status: "active" }, NOW).map((p) => p.id)).toEqual(["1"]);
    expect(filterPromotions(list, { status: "inactive" }, NOW).map((p) => p.id)).toEqual(["2"]);
    expect(filterPromotions(list, { status: "expired" }, NOW).map((p) => p.id)).toEqual(["3"]);
    expect(filterPromotions(list, { search: "bb" }, NOW).map((p) => p.id)).toEqual(["2"]);
    expect(filterPromotions(list, {}, NOW)).toHaveLength(3);
  });

  it("la date de fin choisie reste valable toute la journée", () => {
    const start = new Date(startDateToIso("2026-06-10"));
    const end = new Date(endDateToIso("2026-06-10"));
    expect(end.getTime() - start.getTime()).toBe((24 * 3600 - 1) * 1000);
    expect(isoToDateInput(startDateToIso("2026-06-10"))).toBe("2026-06-10");
    expect(isoToDateInput(endDateToIso("2026-06-10"))).toBe("2026-06-10");
  });
});

describe("simulateur de code (même validation que la boutique)", () => {
  it("code valide : remise en pourcentage", async () => {
    const r = await promotionService.validateCode("bienvenue10", 10000);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.discount).toBe(1000);
  });

  it("code valide : remise fixe plafonnée au sous-total", async () => {
    const r = await promotionService.validateCode("FIXE1500", 15000);
    expect(r.valid && r.discount).toBe(1500);
  });

  it("refuse sous le montant minimum, avec la raison", async () => {
    const r = await promotionService.validateCode("BIENVENUE10", 1000);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/Montant minimum/);
  });

  it("refuse un code inconnu, inactif ou programmé", async () => {
    const unknown = await promotionService.validateCode("NOPE", 20000);
    expect(unknown).toMatchObject({ valid: false, reason: "Ce code promotionnel n'existe pas." });
    const inactive = await promotionService.validateCode("SOLDES20", 20000);
    expect(inactive).toMatchObject({ valid: false, reason: "Ce code promotionnel n'est plus actif." });
    const scheduled = await promotionService.validateCode("RENTREE15", 20000);
    expect(scheduled).toMatchObject({ valid: false, reason: "Ce code n'est pas encore valable." });
  });

  it("refuse un code désactivé à la main, accepte une fois réactivé", async () => {
    const all = await promotionService.getPromotions();
    const p = all.find((x) => x.code === "BIENVENUE10")!;
    await promotionService.updatePromotion(p.id, { isActive: false });
    expect((await promotionService.validateCode("BIENVENUE10", 10000)).valid).toBe(false);
    await promotionService.updatePromotion(p.id, { isActive: true });
    expect((await promotionService.validateCode("BIENVENUE10", 10000)).valid).toBe(true);
  });

  it("refuse un code en doublon (CONFLICT) et met le code en majuscules à la création", async () => {
    const base = {
      label: "Nouveau",
      type: "percentage" as const,
      value: 5,
      startsAt: new Date(Date.now() - 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      minOrderAmount: 0,
      isActive: true,
    };
    const created = await promotionService.createPromotion({ ...base, code: "nouveau5" });
    expect(created.code).toBe("NOUVEAU5");
    await expect(promotionService.createPromotion({ ...base, code: "NOUVEAU5" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(promotionService.createPromotion({ ...base, code: "bienvenue10" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
