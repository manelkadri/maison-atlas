import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = { pathname: "/", search: "" };
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn() }),
}));

import { HeaderActions } from "@/components/layout/header-actions";
import { MainNav } from "@/components/layout/main-nav";
import { countLabel, formatBadgeCount, isNavItemActive } from "@/components/layout/nav-utils";
import { useCartStore } from "@/stores/cart.store";
import { useFavoritesStore } from "@/stores/favorites.store";

const params = (q: string) => new URLSearchParams(q);

describe("isNavItemActive", () => {
  it("n'active l'accueil que sur /", () => {
    expect(isNavItemActive("/", "/", params(""))).toBe(true);
    expect(isNavItemActive("/", "/shop", params(""))).toBe(false);
  });

  it("distingue Boutique, Femme, Homme, Nouveautés et Promotions", () => {
    const at = (search: string) => ({
      shop: isNavItemActive("/shop", "/shop", params(search)),
      femme: isNavItemActive("/shop?category=femme", "/shop", params(search)),
      homme: isNavItemActive("/shop?category=homme", "/shop", params(search)),
      news: isNavItemActive("/shop?collection=new", "/shop", params(search)),
      sale: isNavItemActive("/shop?collection=sale", "/shop", params(search)),
    });
    expect(at("")).toEqual({ shop: true, femme: false, homme: false, news: false, sale: false });
    expect(at("category=femme")).toEqual({ shop: false, femme: true, homme: false, news: false, sale: false });
    expect(at("category=homme&sort=popular")).toEqual({ shop: false, femme: false, homme: true, news: false, sale: false });
    expect(at("collection=new")).toEqual({ shop: false, femme: false, homme: false, news: true, sale: false });
    expect(at("collection=sale")).toEqual({ shop: false, femme: false, homme: false, news: false, sale: true });
  });

  it("garde Boutique actif avec une simple recherche ou un tri", () => {
    expect(isNavItemActive("/shop", "/shop", params("search=robe"))).toBe(true);
  });

  it("n'active rien hors de /shop pour les liens à paramètres", () => {
    expect(isNavItemActive("/shop?category=femme", "/cart", params("category=femme"))).toBe(false);
  });
});

describe("compteurs", () => {
  it("formate les libellés et le plafond 99+", () => {
    expect(countLabel("Mon panier", 0, "pièce", "pièces")).toBe("Mon panier");
    expect(countLabel("Mon panier", 1, "pièce", "pièces")).toBe("Mon panier, 1 pièce");
    expect(countLabel("Mon panier", 3, "pièce", "pièces")).toBe("Mon panier, 3 pièces");
    expect(formatBadgeCount(120)).toBe("99+");
    expect(formatBadgeCount(5)).toBe("5");
  });
});

describe("MainNav", () => {
  beforeEach(() => {
    nav.pathname = "/shop";
    nav.search = "category=femme";
  });

  it("marque uniquement le lien courant avec aria-current", () => {
    render(<MainNav className="flex" />);
    const current = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Femme");
    expect(screen.getByRole("link", { name: "Boutique" })).not.toHaveAttribute("aria-current");
  });
});

describe("HeaderActions", () => {
  const item = {
    variantId: "v1",
    productId: "p1",
    slug: "robe",
    name: "Robe",
    imageUrl: "/x.svg",
    color: "Noir",
    colorCode: "#000000",
    size: "M",
    sku: "SKU-1",
    unitPrice: 5000,
    maxStock: 10,
  };

  afterEach(() => {
    act(() => {
      useCartStore.getState().clear();
      useFavoritesStore.getState().clear();
    });
  });

  it("affiche le nombre de pièces du panier (et non de lignes) et les favoris", () => {
    act(() => {
      useCartStore.getState().addItem(item, 2);
      useCartStore.getState().addItem({ ...item, variantId: "v2", size: "L", sku: "SKU-2" }, 1);
      useFavoritesStore.getState().toggle("p1");
    });
    render(<HeaderActions />);
    expect(screen.getByRole("link", { name: "Mon panier, 3 pièces" })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("link", { name: "Mes favoris, 1 produit" })).toHaveAttribute("href", "/favorites");
    expect(screen.getByRole("link", { name: "Mon compte" })).toHaveAttribute("href", "/account");
  });

  it("n'affiche aucun badge quand le panier est vide", () => {
    render(<HeaderActions />);
    expect(screen.getByRole("link", { name: "Mon panier" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mes favoris" })).toBeInTheDocument();
  });
});
