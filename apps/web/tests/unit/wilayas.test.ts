import { describe, expect, it } from "vitest";
import { PICKUP_POINTS, WILAYAS, getPickupPointsForWilaya, getShippingFee, getWilaya } from "@fashion/shared";
import { settingsMock } from "@/mocks/settings.mock";

describe("wilayas d'Algérie (69)", () => {
  it("contient exactement les 69 wilayas, codes 01 à 69 uniques et continus", () => {
    expect(WILAYAS).toHaveLength(69);
    expect(WILAYAS.map((w) => w.code)).toEqual(Array.from({ length: 69 }, (_, i) => String(i + 1).padStart(2, "0")));
    expect(new Set(WILAYAS.map((w) => w.name)).size).toBe(69);
  });

  it("inclut les 11 nouvelles wilayas (59 à 69)", () => {
    const names = ["Aflou", "El Abiodh Sidi Cheikh", "El Aricha", "El Kantara", "Barika", "Bou Saâda", "Bir El Ater", "Ksar El Boukhari", "Ksar Chellala", "Aïn Oussara", "Messaâd"];
    expect(WILAYAS.slice(58).map((w) => w.name)).toEqual(names);
  });

  it("chaque wilaya a une zone tarifaire valide et des bureaux de livraison", () => {
    for (const w of WILAYAS) {
      expect(["1", "2", "3"]).toContain(w.zone);
      expect(getPickupPointsForWilaya(w.code).length).toBeGreaterThan(0);
    }
    expect(PICKUP_POINTS).toHaveLength(69 * 2);
  });

  it("une nouvelle wilaya est facturée selon la zone de sa wilaya d'origine", () => {
    expect(getWilaya("66")?.zone).toBe("1"); // Ksar El Boukhari (Médéa)
    expect(getShippingFee(settingsMock, "66", "home", 10000)).toBe(450);
    expect(getShippingFee(settingsMock, "69", "home", 10000)).toBe(1200); // Messaâd (Djelfa)
  });
});
