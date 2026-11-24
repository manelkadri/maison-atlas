/* eslint-disable @next/next/no-img-element */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutView } from "@/components/store/checkout/checkout-view";
import { buildCartItem } from "@/features/products/variant-selection";
import { productService } from "@/services";
import { resetDb } from "@/services/mock/db";
import { useCartStore } from "@/stores/cart.store";
import { useCustomerSessionStore } from "@/stores/customer-session.store";

vi.setConfig({ testTimeout: 20_000 });

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/checkout", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => <img {...props} alt={props.alt ?? ""} />,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

async function seedCart() {
  const products = await productService.getProducts({ onlyPublic: true });
  const product = products.find((p) => p.variants.some((v) => v.stock >= 3))!;
  useCartStore.getState().addItem(buildCartItem(product, product.variants.find((v) => v.stock >= 3)!), 1);
}

describe("paiement : connexion obligatoire, panier conservé", () => {
  beforeEach(async () => {
    resetDb();
    useCustomerSessionStore.setState({ profile: null });
    useCartStore.setState({ items: [], promoCode: null, shipping: { wilayaCode: "16", method: "home" } });
    await seedCart();
  });

  it("visiteuse non connectée : la connexion est proposée à la place du formulaire, et le panier reste intact", async () => {
    wrap(<CheckoutView />);
    expect(await screen.findByRole("heading", { name: /connectez-vous pour commander/i })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Informations de commande" })).not.toBeInTheDocument();
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("cliente connectée : le formulaire s'affiche, pré-rempli avec son compte", async () => {
    useCustomerSessionStore.setState({ profile: { firstName: "Sara", lastName: "Haddad", phone: "0661234567", email: "", wilayaCode: "16", commune: "Bab Ezzouar", address: "5 rue X" } });
    wrap(<CheckoutView />);
    expect(await screen.findByRole("form", { name: "Informations de commande" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Prénom/)).toHaveValue("Sara");
    expect(screen.getByLabelText(/^Commune/)).toHaveValue("Bab Ezzouar");
  });
});
