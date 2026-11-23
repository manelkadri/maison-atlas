import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ce fichier teste l'interface en mode API : la variable doit être posée AVANT l'import des services.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_DATA_SOURCE = "api";
});

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/admin/dashboard",
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn(), warning: vi.fn() } }));

import { SessionGuard } from "@/components/admin/shell/session-guard";
import { AdminLoginForm } from "@/components/admin/shell/login-form";
import { TrackOrderForm } from "@/components/store/account/track-order-form";
import { OrdersList } from "@/components/store/account/orders-list";
import { OrderConfirmationView } from "@/components/store/checkout/order-confirmation-view";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { orderService as mockOrders } from "@/services/orders.service";
import { useAdminSessionStore } from "@/stores/admin-session.store";
import { usePlacedOrdersStore } from "@/stores/placed-orders.store";
import type { Order } from "@/types/order.types";
import { apiError, json, noContent, stubFetch } from "./web-api-helpers";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

let order: Order;

beforeEach(async () => {
  replace.mockClear();
  push.mockClear();
  toastSuccess.mockClear();
  useAdminSessionStore.setState({ isAuthenticated: false, email: null });
  usePlacedOrdersStore.setState({ orders: [] });
  const [first] = await mockOrders.getOrders();
  order = first!;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mode API : garde de session admin", () => {
  it("session valide (me → 200) : affiche le contenu et mémorise l'e-mail pour l'affichage", async () => {
    const { calls } = stubFetch(() => json({ email: "owner@example.com" }));
    render(
      <SessionGuard>
        <p>Contenu admin</p>
      </SessionGuard>,
      { wrapper: wrapper() },
    );
    expect(await screen.findByText("Contenu admin")).toBeInTheDocument();
    expect(calls[0]?.url).toBe("/api/auth/me");
    expect(replace).not.toHaveBeenCalled();
    expect(useAdminSessionStore.getState().email).toBe("owner@example.com");
  });

  it("le drapeau local seul ne suffit PAS : sans session côté serveur (401), redirection et session locale vidée", async () => {
    useAdminSessionStore.setState({ isAuthenticated: true, email: "faux@example.com" });
    stubFetch(() => apiError(401, "UNAUTHENTICATED", "Non connecté."));
    render(
      <SessionGuard>
        <p>Contenu admin</p>
      </SessionGuard>,
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByText("Contenu admin")).not.toBeInTheDocument();
    expect(useAdminSessionStore.getState().isAuthenticated).toBe(false);
  });

  it("serveur injoignable : message d'erreur et bouton Réessayer, sans redirection ni contenu", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    render(
      <SessionGuard>
        <p>Contenu admin</p>
      </SessionGuard>,
      { wrapper: wrapper() },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/injoignable/i);
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
    expect(screen.queryByText("Contenu admin")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("mode API : connexion admin", () => {
  it("n'affiche pas le bandeau « connexion simulée »", () => {
    render(<AdminLoginForm />, { wrapper: wrapper() });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.queryByText(/simulée/i)).not.toBeInTheDocument();
  });

  it("échec : affiche le message unique de l'API (sans détail) et ne crée pas de session", async () => {
    const user = userEvent.setup();
    stubFetch(() => apiError(401, "UNAUTHENTICATED", "Identifiants incorrects."));
    render(<AdminLoginForm />, { wrapper: wrapper() });
    await user.type(screen.getByLabelText(/adresse e-mail/i), "owner@example.com");
    await user.type(screen.getByLabelText(/^mot de passe/i), "mauvais");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Identifiants incorrects.");
    expect(useAdminSessionStore.getState().isAuthenticated).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("succès : appelle POST /auth/login, ouvre la session locale et redirige vers le dashboard", async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch(() => json({ email: "owner@example.com" }));
    render(<AdminLoginForm />, { wrapper: wrapper() });
    await user.type(screen.getByLabelText(/adresse e-mail/i), "owner@example.com");
    await user.type(screen.getByLabelText(/^mot de passe/i), "un-mot-de-passe-solide");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/dashboard"));
    expect(calls[0]?.url).toBe("/api/auth/login");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ email: "owner@example.com", password: "un-mot-de-passe-solide" });
    expect(useAdminSessionStore.getState()).toMatchObject({ isAuthenticated: true, email: "owner@example.com" });
  });
});

describe("store des commandes mémorisées", () => {
  it("mémorise le couple, remplace un doublon (le plus récent en tête) et plafonne la liste", () => {
    const { remember } = usePlacedOrdersStore.getState();
    remember({ orderNumber: "CMD-1", phone: "0555000001", createdAt: "2026-01-01T10:00:00.000Z" });
    remember({ orderNumber: "CMD-2", phone: "0555000002", createdAt: "2026-01-02T10:00:00.000Z" });
    remember({ orderNumber: "CMD-1", phone: "0555000009", createdAt: "2026-01-01T10:00:00.000Z" });
    expect(usePlacedOrdersStore.getState().orders.map((o) => `${o.orderNumber}:${o.phone}`)).toEqual(["CMD-1:0555000009", "CMD-2:0555000002"]);

    usePlacedOrdersStore.getState().clear();
    for (let i = 0; i < 60; i++) remember({ orderNumber: `CMD-${i}`, phone: "0555000000", createdAt: "2026-01-01T00:00:00.000Z" });
    const stored = usePlacedOrdersStore.getState().orders;
    expect(stored).toHaveLength(50);
    expect(stored[0]?.orderNumber).toBe("CMD-59");
  });

  it("est persisté dans le localStorage (numéro, téléphone, date seulement)", () => {
    usePlacedOrdersStore.getState().remember({ orderNumber: "CMD-7", phone: "0555123456", createdAt: "2026-01-01T00:00:00.000Z" });
    const raw = JSON.parse(window.localStorage.getItem("fashion-placed-orders") ?? "{}") as { state: { orders: unknown[] } };
    expect(raw.state.orders).toEqual([{ orderNumber: "CMD-7", phone: "0555123456", createdAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("forget retire une commande", () => {
    const { remember, forget } = usePlacedOrdersStore.getState();
    remember({ orderNumber: "CMD-1", phone: "0555000001", createdAt: "x" });
    forget("CMD-1");
    expect(usePlacedOrdersStore.getState().orders).toEqual([]);
  });
});

describe("mode API : « Mes commandes » (jamais de liste par téléphone seul)", () => {
  it("relit chaque commande mémorisée avec son couple numéro + téléphone, uniquement via la route publique de suivi", async () => {
    usePlacedOrdersStore.setState({ orders: [{ orderNumber: order.orderNumber, phone: order.customer.phone, createdAt: order.createdAt }] });
    const { calls } = stubFetch(() => json(order));
    render(<OrdersList />, { wrapper: wrapper() });
    expect(await screen.findByText(order.orderNumber)).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url, "http://x");
    expect(url.pathname).toBe("/api/orders/track");
    expect(url.searchParams.get("number")).toBe(order.orderNumber);
    expect(url.searchParams.get("phone")).toBe(order.customer.phone);
    expect(calls.some((c) => c.url.includes("/admin/"))).toBe(false);
  });

  it("aucune commande mémorisée : aucun appel réseau, état vide et formulaire de suivi", async () => {
    const { fn } = stubFetch(() => json(order));
    render(<OrdersList />, { wrapper: wrapper() });
    expect(await screen.findByText(/pas encore de commande/i)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /suivre une commande/i })).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it("une commande introuvable (404) est ignorée sans casser la liste", async () => {
    usePlacedOrdersStore.setState({
      orders: [
        { orderNumber: "CMD-0000-000000", phone: "0555000000", createdAt: "2026-01-01T00:00:00.000Z" },
        { orderNumber: order.orderNumber, phone: order.customer.phone, createdAt: order.createdAt },
      ],
    });
    stubFetch((call) => (call.url.includes("CMD-0000-000000") ? apiError(404, "NOT_FOUND", "Introuvable.") : json(order)));
    render(<OrdersList />, { wrapper: wrapper() });
    expect(await screen.findByText(order.orderNumber)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("mode API : suivre une commande", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, number: string, phone: string) {
    await user.clear(screen.getByLabelText(/numéro de commande/i));
    await user.type(screen.getByLabelText(/numéro de commande/i), number);
    await user.type(screen.getByLabelText(/téléphone utilisé/i), phone);
    await user.click(screen.getByRole("button", { name: /suivre ma commande/i }));
  }

  it("couple valide : interroge /orders/track, mémorise le couple et prévient", async () => {
    const user = userEvent.setup();
    const onFound = vi.fn();
    const { calls } = stubFetch(() => json(order));
    render(<TrackOrderForm onFound={onFound} />, { wrapper: wrapper() });
    await fill(user, order.orderNumber.toLowerCase(), "0555 12 34 56");
    await waitFor(() => expect(onFound).toHaveBeenCalled());
    const url = new URL(calls[0]!.url, "http://x");
    expect(url.pathname).toBe("/api/orders/track");
    expect(url.searchParams.get("number")).toBe(order.orderNumber); // normalisé en majuscules
    expect(url.searchParams.get("phone")).toBe("0555 12 34 56");
    expect(usePlacedOrdersStore.getState().orders[0]).toMatchObject({ orderNumber: order.orderNumber, phone: "0555 12 34 56" });
  });

  it("couple inconnu : message unique, rien n'est mémorisé", async () => {
    const user = userEvent.setup();
    stubFetch(() => apiError(404, "NOT_FOUND", "Commande introuvable."));
    render(<TrackOrderForm />, { wrapper: wrapper() });
    await fill(user, "CMD-2026-999999", "0555123456");
    expect(await screen.findByRole("alert")).toHaveTextContent(/aucune commande ne correspond/i);
    expect(usePlacedOrdersStore.getState().orders).toEqual([]);
  });

  it("téléphone invalide : erreur locale, aucun appel réseau", async () => {
    const user = userEvent.setup();
    const { fn } = stubFetch(() => json(order));
    render(<TrackOrderForm />, { wrapper: wrapper() });
    await fill(user, "CMD-2026-000001", "123");
    expect(await screen.findByRole("alert")).toHaveTextContent(/numéro invalide/i);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("mode API : page de confirmation", () => {
  it("utilise le téléphone mémorisé pour lire la commande (route publique de suivi)", async () => {
    usePlacedOrdersStore.setState({ orders: [{ orderNumber: order.orderNumber, phone: order.customer.phone, createdAt: order.createdAt }] });
    const { calls } = stubFetch(() => json(order));
    render(<OrderConfirmationView orderNumber={order.orderNumber} />, { wrapper: wrapper() });
    expect(await screen.findByTestId("order-number")).toHaveTextContent(order.orderNumber);
    const url = new URL(calls[0]!.url, "http://x");
    expect(url.pathname).toBe("/api/orders/track");
    expect(url.searchParams.get("phone")).toBe(order.customer.phone);
  });

  it("téléphone non mémorisé : demande le téléphone, n'appelle JAMAIS la route admin", async () => {
    const { fn } = stubFetch(() => json(order));
    render(<OrderConfirmationView orderNumber={order.orderNumber} />, { wrapper: wrapper() });
    expect(await screen.findByText(/retrouvez votre commande/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/téléphone utilisé/i)).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("mode API : newsletter", () => {
  it("POST /newsletter puis message de succès", async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch(() => noContent());
    render(<NewsletterForm />);
    await user.type(screen.getByLabelText("Adresse e-mail"), "client@example.com");
    await user.click(screen.getByRole("button", { name: /inscrire/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Merci, vous êtes inscrit"));
    expect(calls[0]?.url).toBe("/api/newsletter");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ email: "client@example.com" });
    expect(window.localStorage.getItem("fashion-newsletter-demo")).toBeNull();
  });

  it("erreur du serveur : message affiché sous le champ, pas de faux succès", async () => {
    const user = userEvent.setup();
    stubFetch(() => apiError(429, "RATE_LIMITED", "Trop de tentatives, réessayez plus tard."));
    render(<NewsletterForm />);
    await user.type(screen.getByLabelText("Adresse e-mail"), "client@example.com");
    await user.click(screen.getByRole("button", { name: /inscrire/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Trop de tentatives, réessayez plus tard.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
