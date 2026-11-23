/* eslint-disable @next/next/no-img-element */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductDetail } from "@/components/store/product/product-detail";
import { makeQueryClient } from "@/lib/query-client";
import { productService } from "@/services";
import { resetDb } from "@/services/mock/db";
import { useCartStore } from "@/stores/cart.store";
import type { Product } from "@/types/product.types";
import { testProduct } from "./storefront-b-fixtures";

// Les tests d'interface (userEvent + Radix) peuvent dépasser 5 s sur une machine chargée.
vi.setConfig({ testTimeout: 20_000 });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/product/robe-de-test",
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

/** Insère le produit de test dans la base mock (les ids de variantes sont générés par le service). */
async function createTestProduct(): Promise<Product> {
  const { id: _id, createdAt: _c, updatedAt: _u, soldCount: _s, isArchived: _a, variants, ...rest } = testProduct;
  return productService.createProduct({
    ...rest,
    variants: variants.map(({ id: _vid, productId: _pid, ...variant }) => variant),
  });
}

const renderDetail = (product: Product | null, slug = "robe-de-test") =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <ProductDetail slug={slug} initialProduct={product} initialRelated={[]} />
    </QueryClientProvider>,
  );

const sizeGroup = () => screen.getByRole("group", { name: /Taille/ });
const sizeButton = (name: RegExp) => within(sizeGroup()).getByRole("button", { name });
const addButton = () => screen.getByRole("button", { name: /^Ajouter au panier$/ });
const availability = () => screen.getAllByRole("status").find((el) => /stock|taille/i.test(el.textContent ?? ""));

describe("fiche produit : sélection de variante", () => {
  beforeEach(() => {
    resetDb();
    useCartStore.setState({ items: [], promoCode: null, shipping: { wilayaCode: "16", method: "home" } });
  });

  it("tant qu'aucune taille n'est choisie : message explicite et ajout au panier désactivé", async () => {
    const product = await createTestProduct();
    renderDetail(product);
    expect(screen.getByRole("heading", { level: 1, name: "Robe de test" })).toBeInTheDocument();
    expect(availability()).toHaveTextContent("Choisissez une taille");
    expect(addButton()).toBeDisabled();
    expect(screen.getByText(/Sélectionnez une taille pour pouvoir ajouter/)).toBeInTheDocument();
  });

  it("une taille épuisée pour la couleur est désactivée (libellé « épuisée ») même si le produit a du stock", async () => {
    const product = await createTestProduct();
    renderDetail(product);
    // Couleur par défaut : Noir (S = 0, M = 5, L = 2).
    expect(sizeButton(/Taille S, épuisée/)).toBeDisabled();
    expect(sizeButton(/^Taille M$/)).toBeEnabled();
    expect(sizeButton(/^Taille L$/)).toBeEnabled();
  });

  it("affiche « En stock » / « Plus que N en stock » selon la variante, et plafonne la quantité", async () => {
    const user = userEvent.setup();
    const product = await createTestProduct();
    renderDetail(product);

    await user.click(sizeButton(/^Taille M$/));
    expect(availability()).toHaveTextContent("En stock");
    expect(addButton()).toBeEnabled();

    // Quantité maximale = stock de la variante (5).
    const plus = screen.getByRole("button", { name: "Augmenter la quantité" });
    for (let i = 0; i < 8; i++) await user.click(plus);
    const stepper = screen.getByRole("group", { name: "Quantité" });
    expect(within(stepper).getByText("5")).toBeInTheDocument();
    expect(plus).toBeDisabled();

    // Variante L (stock 2) : message de stock faible et quantité ramenée dans les bornes.
    await user.click(sizeButton(/^Taille L$/));
    expect(availability()).toHaveTextContent("Plus que 2 en stock");
    expect(within(screen.getByRole("group", { name: "Quantité" })).getByText("2")).toBeInTheDocument();
  });

  it("ajoute la bonne variante au panier avec prix, stock et image de la couleur", async () => {
    const user = userEvent.setup();
    const product = await createTestProduct();
    renderDetail(product);
    await user.click(sizeButton(/^Taille M$/));
    await user.click(screen.getByRole("button", { name: "Augmenter la quantité" }));
    await user.click(addButton());

    const [line] = useCartStore.getState().items;
    expect(useCartStore.getState().items).toHaveLength(1);
    const variant = product.variants.find((v) => v.color === "Noir" && v.size === "M")!;
    expect(line).toMatchObject({
      variantId: variant.id,
      productId: product.id,
      color: "Noir",
      size: "M",
      unitPrice: 10000,
      maxStock: 5,
      quantity: 2,
      imageUrl: "/images/products/test/noir-1.svg",
    });
  });

  it("changement de couleur : la taille est désélectionnée si la combinaison n'existe pas", async () => {
    const user = userEvent.setup();
    const product = await createTestProduct();
    renderDetail(product);
    await user.click(sizeButton(/^Taille M$/));
    expect(addButton()).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Beige" }));
    // Beige M n'existe pas : taille désélectionnée, bouton désactivé, taille M non sélectionnable.
    expect(availability()).toHaveTextContent("Choisissez une taille");
    expect(addButton()).toBeDisabled();
    expect(sizeButton(/Taille M, non proposée dans cette couleur/)).toBeDisabled();
    expect(sizeButton(/Taille L, épuisée/)).toBeDisabled();
    expect(sizeButton(/^Taille S$/)).toBeEnabled();
  });

  it("changement de couleur : une taille épuisée dans la nouvelle couleur est désélectionnée", async () => {
    const user = userEvent.setup();
    const product = await createTestProduct();
    renderDetail(product);
    await user.click(screen.getByRole("button", { name: "Beige" }));
    await user.click(sizeButton(/^Taille S$/)); // Beige S : 4 en stock
    expect(availability()).toHaveTextContent("En stock");
    expect(addButton()).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Noir" })); // Noir S : épuisée
    expect(availability()).toHaveTextContent("Choisissez une taille");
    expect(addButton()).toBeDisabled();
  });

  it("produit inconnu du serveur ET du navigateur : état « Produit introuvable » après chargement", async () => {
    renderDetail(null, "produit-qui-n-existe-pas");
    expect(await screen.findByRole("heading", { name: "Produit introuvable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir la boutique" })).toHaveAttribute("href", "/shop");
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"][content="noindex"]') ?? document.querySelector('meta[name="robots"]')).not.toBeNull());
  });

  it("produit inconnu du serveur mais présent dans le navigateur (créé dans l'admin) : la fiche s'affiche", async () => {
    await createTestProduct();
    renderDetail(null);
    expect(await screen.findByRole("heading", { level: 1, name: "Robe de test" })).toBeInTheDocument();
  });
});
