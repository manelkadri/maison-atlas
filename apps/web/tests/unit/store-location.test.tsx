import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { StoreLocation } from "@/components/store/store-location";
import { buildMapsDirectionsUrl, buildMapsEmbedUrl, buildMapsSearchUrl, getMapsQuery } from "@/lib/maps";
import { settingsMock } from "@/mocks/settings.mock";
import { settingsFormSchemaWithLinks } from "@/features/settings/logic";
import { settingsToFormValues } from "@/features/settings/logic";

describe("coordonnées réelles de la boutique", () => {
  it("reprend l'adresse, le téléphone et le Plus Code de la fiche Google Maps", () => {
    expect(settingsMock.address).toBe("mizan, Rue, Aïn Témouchent 46000");
    expect(settingsMock.phone).toBe("0552 82 60 75");
    expect(settingsMock.plusCode).toBe("8V36+H8 Aïn Témouchent");
  });

  it("le formulaire d'administration accepte ces coordonnées", () => {
    const r = settingsFormSchemaWithLinks.safeParse(settingsToFormValues(settingsMock));
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });
});

describe("URL Google Maps", () => {
  it("préfère le Plus Code, sinon l'adresse", () => {
    expect(getMapsQuery({ plusCode: "8V36+H8 Aïn Témouchent", address: "x" })).toBe("8V36+H8 Aïn Témouchent");
    expect(getMapsQuery({ plusCode: " ", address: "mizan, Rue,  Aïn Témouchent 46000" })).toBe("mizan, Rue, Aïn Témouchent 46000");
  });

  it("encode correctement le « + » du Plus Code et les accents", () => {
    const q = "8V36+H8 Aïn Témouchent";
    expect(buildMapsEmbedUrl(q)).toContain("q=8V36%2BH8%20A%C3%AFn%20T%C3%A9mouchent");
    expect(buildMapsEmbedUrl(q)).toContain("output=embed");
    expect(buildMapsSearchUrl(q)).toContain("query=8V36%2BH8");
    expect(buildMapsDirectionsUrl(q)).toContain("destination=8V36%2BH8");
  });
});

describe("<StoreLocation />", () => {
  it("affiche adresse, horaires, téléphone cliquable et la carte intégrée", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <StoreLocation initialSettings={settingsMock} />
      </QueryClientProvider>,
    );
    expect(screen.getByText("mizan, Rue, Aïn Témouchent 46000")).toBeInTheDocument();
    expect(screen.getByText(/sauf le vendredi · de 9h00 à 19h00/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0552 82 60 75" })).toHaveAttribute("href", "tel:0552826075");
    const map = screen.getByTitle(/Carte : emplacement/);
    expect(map).toHaveAttribute("src", expect.stringContaining("google.com/maps"));
    // L'itinéraire et « Ouvrir dans Maps » sont fournis par la carte intégrée : pas de boutons en double.
    expect(screen.queryByRole("link", { name: /Itinéraire|Ouvrir dans Google Maps/ })).not.toBeInTheDocument();
  });
});
