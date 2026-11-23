import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { buildWhatsAppUrl, toWhatsAppNumber } from "@/lib/whatsapp";
import { settingsMock } from "@/mocks/settings.mock";

const wrap = (ui: React.ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

describe("numéro WhatsApp", () => {
  it("convertit le format national et international au format wa.me", () => {
    expect(toWhatsAppNumber("0552 82 60 75")).toBe("213552826075");
    expect(toWhatsAppNumber("+213 552 82 60 75")).toBe("213552826075");
    expect(toWhatsAppNumber("00213552826075")).toBe("213552826075");
  });

  it("refuse les numéros invalides ou vides", () => {
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber(undefined)).toBeNull();
    expect(toWhatsAppNumber("0123")).toBeNull();
    expect(buildWhatsAppUrl("abc")).toBeNull();
  });

  it("construit le lien avec un message pré-rempli encodé", () => {
    expect(buildWhatsAppUrl("0552 82 60 75", "Bonjour & merci")).toBe("https://wa.me/213552826075?text=Bonjour%20%26%20merci");
    expect(buildWhatsAppUrl("0552 82 60 75")).toBe("https://wa.me/213552826075");
  });
});

describe("<WhatsAppButton />", () => {
  it("renvoie vers la conversation WhatsApp du numéro de la boutique, dans un nouvel onglet", () => {
    render(wrap(<WhatsAppButton initialSettings={settingsMock} />));
    const link = screen.getByRole("link", { name: /WhatsApp/ });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/213552826075\?text=/));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("est masqué quand aucun numéro n'est renseigné", () => {
    render(wrap(<WhatsAppButton initialSettings={{ ...settingsMock, whatsapp: "" }} />));
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
  });
});

describe("réseaux sociaux du pied de page", () => {
  it("affiche Instagram et TikTok (liens réels), sans Facebook ni doublon WhatsApp (le bouton flottant suffit)", () => {
    render(wrap(<SiteFooter initialSettings={settingsMock} />));
    expect(screen.getByRole("link", { name: /sur Instagram/ })).toHaveAttribute("href", "https://www.instagram.com/ali_prestige46");
    expect(screen.getByRole("link", { name: /sur TikTok/ })).toHaveAttribute("href", "https://www.tiktok.com/@boutique.ali.pres");
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Facebook/i })).not.toBeInTheDocument();
  });
});
