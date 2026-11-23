/* eslint-disable @next/next/no-img-element */
import { formatDZD } from "@fashion/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CartView } from "@/components/store/cart/cart-view";
import { FavoritesView } from "@/components/store/catalog/favorites-view";
import { buildCartItem } from "@/features/products/variant-selection";
import { makeQueryClient } from "@/lib/query-client";
import { productService } from "@/services";
import { getDb, resetDb } from "@/services/mock/db";
import { useCartStore } from "@/stores/cart.store";
import { useFavoritesStore } from "@/stores/favorites.store";

// Les tests d'interface (userEvent + Radix) peuvent dépasser 5 s sur une machine chargée.
vi.setConfig({ testTimeout: 20_000 });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/cart",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => <img {...props} alt={props.alt ?? ""} />,
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={makeQueryClient()}>{ui}</QueryClientProvider>);

async function pickVariants() {
  const products = await productService.getProducts({ onlyPublic: true });
  const withStock = products.find((p) => p.variants.filter((v) => v.stock >= 3).length >= 2)!;
  const [a, b] = withStock.variants.filter((v) => v.stock >= 3) as [(typeof withStock.variants)[number], (typeof withStock.variants)[number]];
  return { product: withStock, a, b };
}

describe("panier /cart", () => {
  beforeEach(() => {
    resetDb();
    useCartStore.setState({ items: [], promoCode: null, shipping: { wilayaCode: "16", method: "home" } });
    useFavoritesStore.setState({ productIds: [] });
  });

  it("panier vide : état vide avec lien vers la boutique", async () => {
    wrap(<CartView />);
    expect(await screen.findByText("Votre panier est vide")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Découvrir la boutique" })).toHaveAttribute("href", "/shop");
  });

  it("affiche une ligne par variante, les frais séparés du sous-total, et un lien vers le checkout", async () => {
    const { product, a, b } = await pickVariants();
    useCartStore.getState().addItem(buildCartItem(product, a), 2);
    useCartStore.getState().addItem(buildCartItem(product, b), 1);
    wrap(<CartView />);

    const lines = await screen.findAllByRole("listitem");
    expect(lines.filter((li) => li.querySelector("h3"))).toHaveLength(2);
    expect(screen.getByRole("button", { name: new RegExp(`Supprimer ${product.name} \\(${a.color}, taille ${a.size}\\)`) })).toBeInTheDocument();

    const subtotal = a.price * 2 + b.price;
    const summary = screen.getByRole("complementary");
    expect(within(summary).getByText("Sous-total").nextSibling?.textContent).toBe(formatDZD(subtotal));
    await waitFor(() => expect(within(summary).getByText("Livraison").closest("div")).not.toHaveTextContent("—"));
    expect(within(summary).getByText(/Paiement à la livraison \(espèces\)/)).toBeInTheDocument();
    expect(within(summary).getByRole("link", { name: "Passer la commande" })).toHaveAttribute("href", "/checkout");
    expect(within(summary).getByRole("link", { name: "Continuer les achats" })).toHaveAttribute("href", "/shop");
  });

  it("supprimer une ligne la retire du panier", async () => {
    const user = userEvent.setup();
    const { product, a, b } = await pickVariants();
    useCartStore.getState().addItem(buildCartItem(product, a), 1);
    useCartStore.getState().addItem(buildCartItem(product, b), 1);
    wrap(<CartView />);
    await user.click(await screen.findByRole("button", { name: new RegExp(`Supprimer .*${a.color}, taille ${a.size}`) }));
    expect(useCartStore.getState().items.map((i) => i.variantId)).toEqual([b.id]);
  });

  it("la quantité ne dépasse jamais le stock de la variante", async () => {
    const user = userEvent.setup();
    const { product, a } = await pickVariants();
    useCartStore.getState().addItem(buildCartItem(product, a), a.stock - 1);
    wrap(<CartView />);
    const plus = await screen.findByRole("button", { name: "Augmenter la quantité" });
    await user.click(plus);
    expect(plus).toBeDisabled();
    expect(useCartStore.getState().items[0]?.quantity).toBe(a.stock);
    expect(screen.getByText("Stock maximum atteint")).toBeInTheDocument();
  });

  it("réconciliation : une variante devenue indisponible bloque la commande et peut être retirée", async () => {
    const user = userEvent.setup();
    const { product, a, b } = await pickVariants();
    useCartStore.getState().addItem(buildCartItem(product, a), 1);
    useCartStore.getState().addItem(buildCartItem(product, b), 1);
    // Entre-temps, la variante `a` est épuisée dans le catalogue.
    getDb().products.find((p) => p.id === product.id)!.variants.find((v) => v.id === a.id)!.stock = 0;

    wrap(<CartView />);
    expect(await screen.findByText(/n'est plus disponible/)).toBeInTheDocument();
    expect(screen.getByText(/est en rupture de stock/)).toBeInTheDocument();
    const summary = screen.getByRole("complementary");
    expect(within(summary).getByRole("button", { name: "Passer la commande" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Retirer cet article/ }));
    expect(useCartStore.getState().items.map((i) => i.variantId)).toEqual([b.id]);
    await waitFor(() => expect(within(screen.getByRole("complementary")).getByRole("link", { name: "Passer la commande" })).toBeInTheDocument());
  });

  it("réconciliation : le prix du catalogue remplace l'instantané du panier", async () => {
    const { product, a } = await pickVariants();
    useCartStore.getState().addItem(buildCartItem(product, a), 1);
    getDb().products.find((p) => p.id === product.id)!.variants.find((v) => v.id === a.id)!.price = a.price + 500;
    wrap(<CartView />);
    await waitFor(() => expect(useCartStore.getState().items[0]?.unitPrice).toBe(a.price + 500));
  });

  it("code promo : applique la remise, affiche l'erreur du service pour un code invalide, permet de le retirer", async () => {
    const user = userEvent.setup();
    const { product, a } = await pickVariants();
    useCartStore.getState().addItem(buildCartItem(product, a), 2); // sous-total >= 5000
    wrap(<CartView />);

    const input = await screen.findByLabelText("Code promotionnel");
    await user.type(input, "NIMPORTEQUOI");
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(await screen.findByText("Ce code promotionnel n'existe pas.")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "bienvenue10");
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(await screen.findByText(/Remise \(BIENVENUE10\)/)).toBeInTheDocument();
    expect(useCartStore.getState().promoCode).toBe("BIENVENUE10");

    await user.click(screen.getByRole("button", { name: /Retirer le code promotionnel BIENVENUE10/ }));
    expect(useCartStore.getState().promoCode).toBeNull();
    await waitFor(() => expect(screen.queryByText(/Remise \(/)).not.toBeInTheDocument());
  });
});

describe("favoris /favorites", () => {
  beforeEach(() => {
    resetDb();
    useFavoritesStore.setState({ productIds: [] });
  });

  it("état vide quand il n'y a aucun favori", async () => {
    wrap(<FavoritesView />);
    expect(await screen.findByText("Vous n'avez pas encore de favoris")).toBeInTheDocument();
  });

  it("liste les produits favoris, ignore ceux qui n'existent plus, et peut tout effacer avec confirmation", async () => {
    const user = userEvent.setup();
    const products = await productService.getProducts({ onlyPublic: true });
    useFavoritesStore.setState({ productIds: [products[0]!.id, "prod_supprime", products[1]!.id] });
    wrap(<FavoritesView />);

    expect(await screen.findAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("2 articles")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tout effacer" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(useFavoritesStore.getState().productIds).toHaveLength(3); // pas encore confirmé
    await user.click(within(dialog).getByRole("button", { name: "Tout effacer" }));
    expect(useFavoritesStore.getState().productIds).toEqual([]);
    expect(await screen.findByText("Vous n'avez pas encore de favoris")).toBeInTheDocument();
  });
});
