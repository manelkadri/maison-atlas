import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnnouncementBar } from "@/components/layout/announcement-bar";

const MESSAGES = ["Paiement à la livraison", "Livraison dans les 69 wilayas", "Échange et retour facilités", "Prix en DZD – Sans surprise"];

describe("AnnouncementBar", () => {
  it("annonce les 4 messages une seule fois aux lecteurs d'écran (les copies du défilement sont masquées)", () => {
    render(<AnnouncementBar />);
    const group = screen.getByRole("group", { name: "Informations de la boutique" });
    const items = within(group).getAllByRole("listitem");
    expect(items.map((li) => li.textContent?.replace("·", "").trim())).toEqual(MESSAGES);
  });

  it("défile en continu (animation CSS) avec deux groupes identiques pour une boucle sans coupure", () => {
    const { container } = render(<AnnouncementBar />);
    const track = container.querySelector(".animate-marquee");
    expect(track).not.toBeNull();
    expect(track?.children).toHaveLength(2);
    // Le second groupe est entièrement masqué (lecteurs d'écran et mouvement réduit).
    expect(track?.children[1]?.getAttribute("aria-hidden")).toBe("true");
    expect(track?.children[0]?.textContent).toBe(track?.children[1]?.textContent);
  });

  it("répète les messages assez de fois pour dépasser la largeur d'un grand écran", () => {
    const { container } = render(<AnnouncementBar />);
    const firstGroup = container.querySelector(".animate-marquee")?.children[0];
    expect(firstGroup?.querySelectorAll("ul").length).toBeGreaterThanOrEqual(4);
  });
});
