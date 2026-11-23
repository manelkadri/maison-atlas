/* eslint-disable @next/next/no-img-element */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useSyncExternalStore, type ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogView } from "@/components/store/catalog/catalog-view";
import { makeQueryClient } from "@/lib/query-client";
import { resetDb } from "@/services/mock/db";

// `useSearchParams` lit l'URL réelle (jsdom) et se réabonne quand pushState/replaceState est appelé,
// comme le fait Next.js avec l'API History.
// Les tests d'interface (userEvent + Radix) peuvent dépasser 5 s sur une machine chargée.
vi.setConfig({ testTimeout: 20_000 });

vi.mock("next/navigation", () => {
  const subscribe = (cb: () => void) => {
    window.addEventListener("locationchange", cb);
    window.addEventListener("popstate", cb);
    return () => {
      window.removeEventListener("locationchange", cb);
      window.removeEventListener("popstate", cb);
    };
  };
  return {
    useSearchParams: () => {
      const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/shop",
  };
});

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => <img {...props} alt={props.alt ?? ""} />,
}));

beforeAll(() => {
  // Radix Slider observe la taille de ses poignées.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  window.history.pushState = (...args) => {
    push(...args);
    act(() => {
      window.dispatchEvent(new Event("locationchange"));
    });
  };
  window.history.replaceState = (...args) => {
    replace(...args);
    act(() => {
      window.dispatchEvent(new Event("locationchange"));
    });
  };
});

const renderCatalog = (url = "/shop") => {
  window.history.replaceState(null, "", url);
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <CatalogView />
    </QueryClientProvider>,
  );
};

const resultCount = async () => {
  const status = await screen.findByText(/^\d+ produits?$/);
  return Number(/\d+/.exec(status.textContent ?? "")![0]);
};

describe("catalogue /shop : filtres pilotés par l'URL", () => {
  beforeEach(() => {
    resetDb();
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("lit les filtres depuis l'URL : puces actives, titre et résultats filtrés", async () => {
    renderCatalog("/shop?collection=sale&inStock=1");
    expect(screen.getByRole("heading", { level: 1, name: "Promotions" })).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Filtres actifs" });
    expect(within(group).getByRole("button", { name: /Retirer le filtre : Promotions/ })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /Retirer le filtre : En stock/ })).toBeInTheDocument();

    const filtered = await resultCount();
    expect(filtered).toBeGreaterThan(0);
    // Toutes les cartes affichées sont des produits en promotion (pastille de réduction « -NN% »).
    const cards = await screen.findAllByRole("article");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(within(card).getByText(/^-\d+%$/)).toBeInTheDocument();
  });

  it("un clic sur une taille met à jour l'URL, ajoute la puce et réduit les résultats", async () => {
    const user = userEvent.setup();
    renderCatalog("/shop");
    const total = await resultCount();

    await user.click(screen.getByRole("button", { name: "XS" }));
    expect(window.location.search).toBe("?sizes=XS");
    expect(screen.getByRole("button", { name: "Retirer le filtre : Taille XS" })).toBeInTheDocument();
    await waitFor(async () => expect(await resultCount()).toBeLessThan(total));

    // Retirer la puce restaure l'URL et le total.
    await user.click(screen.getByRole("button", { name: "Retirer le filtre : Taille XS" }));
    expect(window.location.search).toBe("");
    await waitFor(async () => expect(await resultCount()).toBe(total));
  });

  it("« Tout réinitialiser » efface tous les filtres de l'URL", async () => {
    const user = userEvent.setup();
    renderCatalog("/shop?category=femme&sizes=M&colors=Noir&inStock=1&sort=price_asc");
    await resultCount();
    await user.click(screen.getByRole("button", { name: "Tout réinitialiser" }));
    // Le tri choisi est conservé, les filtres disparaissent.
    expect(window.location.search).toBe("?sort=price_asc");
    expect(screen.queryByRole("group", { name: "Filtres actifs" })).not.toBeInTheDocument();
  });

  it("la recherche est anti-rebondie, filtre les produits et met le terme dans l'URL", async () => {
    const user = userEvent.setup();
    renderCatalog("/shop");
    const total = await resultCount();

    await user.type(screen.getByRole("searchbox", { name: "Rechercher un produit" }), "robe");
    // Pas encore dans l'URL avant le délai de 300 ms.
    expect(window.location.search).toBe("");
    await waitFor(() => expect(window.location.search).toBe("?search=robe"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Résultats pour « robe »");
    await waitFor(async () => expect(await resultCount()).toBeLessThan(total));
  });

  it("affiche un état vide avec un bouton pour réinitialiser quand rien ne correspond", async () => {
    const user = userEvent.setup();
    renderCatalog("/shop?search=zzzzintrouvable");
    expect(await screen.findByText("Aucun produit ne correspond")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }));
    expect(window.location.search).toBe("");
    await waitFor(async () => expect(await resultCount()).toBeGreaterThan(0));
  });

  it("pagine avec des liens accessibles et met la page dans l'URL", async () => {
    const user = userEvent.setup();
    window.scrollTo = vi.fn();
    renderCatalog("/shop");
    await resultCount();
    const nav = await screen.findByRole("navigation", { name: "Pagination du catalogue" });
    await user.click(within(nav).getByRole("link", { name: "Page 2" }));
    expect(window.location.search).toBe("?page=2");
    expect(window.scrollTo).toHaveBeenCalled();
    await waitFor(() => expect(within(screen.getByRole("navigation", { name: "Pagination du catalogue" })).getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page"));
  });
});
