/* eslint-disable @next/next/no-img-element */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutForm } from "@/components/store/checkout/checkout-form";
import { getCheckoutDefaults } from "@/features/checkout/defaults";
import { buildCartItem } from "@/features/products/variant-selection";
import { makeQueryClient } from "@/lib/query-client";
import { orderService, productService } from "@/services";
import { resetDb } from "@/services/mock/db";
import { useCartStore } from "@/stores/cart.store";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));

// Les tests d'interface (userEvent + Radix) peuvent dépasser 5 s sur une machine chargée.
vi.setConfig({ testTimeout: 20_000 });

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/checkout",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => <img {...props} alt={props.alt ?? ""} />,
}));

beforeAll(() => {
  // Radix (RadioGroup, Select) observe la taille de ses éléments.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

async function seedCart(quantity = 2) {
  const products = await productService.getProducts({ onlyPublic: true });
  const product = products.find((p) => p.variants.some((v) => v.stock >= 3))!;
  const variant = product.variants.find((v) => v.stock >= 3)!;
  useCartStore.getState().addItem(buildCartItem(product, variant), quantity);
  return { product, variant };
}

function renderForm(onPlaced = vi.fn()) {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <CheckoutForm initialValues={getCheckoutDefaults(null, { wilayaCode: "16", method: "home" })} onPlaced={onPlaced} />
    </QueryClientProvider>,
  );
  const form = screen.getByRole("form", { name: "Informations de commande" });
  return { form, onPlaced };
}

const submitButton = async (form: HTMLElement) => {
  const button = within(form).getByRole("button", { name: /Confirmer la commande/ });
  // Désactivé tant que les tarifs de livraison ne sont pas chargés.
  await waitFor(() => expect(button).toBeEnabled());
  return button;
};

async function fillIdentity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Nom/), "Benali");
  await user.type(screen.getByLabelText(/^Prénom/), "Amine");
  await user.type(screen.getByLabelText(/^Téléphone/), "0555123456");
  await user.type(screen.getByLabelText(/^Commune/), "Bab Ezzouar");
}

describe("formulaire de commande", () => {
  beforeEach(() => {
    resetDb();
    router.replace.mockClear();
    useCartStore.setState({ items: [], promoCode: null, shipping: { wilayaCode: "16", method: "home" } });
  });

  it("affiche les erreurs en français sous chaque champ, annonce (alert) et place le focus sur le premier champ en erreur", async () => {
    await seedCart();
    const user = userEvent.setup();
    const { form } = renderForm();
    await user.click(await submitButton(form));

    const lastName = screen.getByLabelText(/^Nom/);
    expect(await screen.findByText("Le nom est obligatoire.")).toBeInTheDocument();
    expect(screen.getByText("Le prénom est obligatoire.")).toBeInTheDocument();
    expect(screen.getByText("Le numéro de téléphone est obligatoire.")).toBeInTheDocument();
    expect(screen.getByText("La commune est obligatoire.")).toBeInTheDocument();
    expect(screen.getByText("L'adresse complète est obligatoire pour la livraison à domicile.")).toBeInTheDocument();

    expect(lastName).toHaveAttribute("aria-invalid", "true");
    expect(lastName).toHaveAttribute("aria-describedby", "checkout-lastName-error");
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(5);
    await waitFor(() => expect(lastName).toHaveFocus());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("refuse un téléphone invalide", async () => {
    await seedCart();
    const user = userEvent.setup();
    const { form } = renderForm();
    await fillIdentity(user);
    const phone = screen.getByLabelText(/^Téléphone/);
    await user.clear(phone);
    await user.type(phone, "123");
    await user.type(screen.getByLabelText(/^Adresse complète/), "12 rue des Oliviers");
    await user.click(await submitButton(form));
    expect(await screen.findByText(/Numéro invalide/)).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("le mode bureau remplace l'adresse par le choix d'un bureau, obligatoire", async () => {
    await seedCart();
    const user = userEvent.setup();
    const { form } = renderForm();
    expect(screen.getByLabelText(/^Adresse complète/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Bureau de livraison/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Livraison en bureau/ }));
    expect(screen.queryByLabelText(/^Adresse complète/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Bureau de livraison/)).toBeInTheDocument();
    // Le tarif de chaque mode est affiché.
    expect(screen.getByRole("radio", { name: /Livraison à domicile/ })).toBeInTheDocument();

    await fillIdentity(user);
    await user.click(await submitButton(form));
    expect(await screen.findByText("Veuillez choisir un bureau de livraison.")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    // Le choix du mode est mémorisé dans le panier (estimation de livraison).
    expect(useCartStore.getState().shipping.method).toBe("pickup_point");
  });

  it("compte les caractères de la remarque", async () => {
    await seedCart();
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/^Remarque/), "Merci !");
    expect(screen.getByText("7 / 300")).toBeInTheDocument();
  });

  it("commande à domicile : crée la commande, vide le panier et redirige vers la confirmation", async () => {
    const { variant, product } = await seedCart(2);
    const before = (await orderService.getOrders()).length;
    const user = userEvent.setup();
    const { form, onPlaced } = renderForm();
    await fillIdentity(user);
    await user.type(screen.getByLabelText(/^Adresse complète/), "12 rue des Oliviers, cité 5 juillet");
    await user.click(await submitButton(form));

    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(router.replace.mock.calls[0]?.[0]).toMatch(/^\/order-confirmation\?number=CMD-\d{4}-\d{6}$/);
    expect(onPlaced).toHaveBeenCalledTimes(1);
    expect(useCartStore.getState().items).toEqual([]);

    expect(await orderService.getOrders()).toHaveLength(before + 1);
    const number = new URLSearchParams(String(router.replace.mock.calls[0]?.[0]).split("?")[1]).get("number")!;
    const order = (await orderService.getOrderByNumber(number))!;
    expect(order).toMatchObject({ status: "pending", paymentMethod: "cash_on_delivery", paymentStatus: "pending", deliveryMethod: "home" });
    expect(order.customer).toMatchObject({ firstName: "Amine", lastName: "Benali", phone: "0555123456" });
    expect(order.items[0]).toMatchObject({ variantId: variant.id, quantity: 2 });
    const after = (await productService.getProductById(product.id))!;
    expect(after.variants.find((v) => v.id === variant.id)?.stock).toBe(variant.stock - 2);
  });

  it("stock insuffisant : message clair, panier réconcilié, saisie conservée, pas de redirection", async () => {
    const { product, variant } = await seedCart(1);
    // Instantané périmé : le panier croit qu'il reste 20 pièces et en contient plus que le stock réel.
    const staleQuantity = variant.stock + 2;
    useCartStore.setState({ items: [{ ...buildCartItem(product, variant), maxStock: 20, quantity: staleQuantity }] });

    const user = userEvent.setup();
    const { form, onPlaced } = renderForm();
    await fillIdentity(user);
    await user.type(screen.getByLabelText(/^Adresse complète/), "12 rue des Oliviers");
    await user.click(await submitButton(form));

    const alert = await screen.findByText(/il ne reste que/i);
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Vos informations sont conservées/)).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    expect(onPlaced).not.toHaveBeenCalled();
    // Les champs saisis sont intacts ; la quantité est ramenée au stock réel.
    expect(screen.getByLabelText(/^Nom/)).toHaveValue("Benali");
    expect(screen.getByLabelText(/^Téléphone/)).toHaveValue("0555123456");
    await waitFor(() => expect(useCartStore.getState().items[0]).toMatchObject({ quantity: variant.stock, maxStock: variant.stock }));
    // Aucune commande créée.
    expect((await productService.getProductById(product.id))!.variants.find((v) => v.id === variant.id)?.stock).toBe(variant.stock);
  });
});
