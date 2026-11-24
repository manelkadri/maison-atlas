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
import { AccountShell } from "@/components/store/account/account-shell";
import { OrdersList } from "@/components/store/account/orders-list";
import { PublicTracking } from "@/components/store/account/public-tracking";
import { TrackOrderForm } from "@/components/store/account/track-order-form";
import { OrderConfirmationView } from "@/components/store/checkout/order-confirmation-view";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { orderService as mockOrders } from "@/services/orders.service";
import { useAdminSessionStore } from "@/stores/admin-session.store";
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

/** Commande telle que la renvoie l'API à sa propriétaire : sans prix de revient ni notes internes. */
function customerView(o: Order) {
  return {
    ...o,
    items: o.items.map(({ unitCost: _cost, ...rest }) => rest),
    statusHistory: o.statusHistory.map(({ note: _note, ...rest }) => rest),
  };
}

const ACCOUNT = {
  id: "c1",
  firstName: "Amina",
  lastName: "Benali",
  phone: "0555123456",
  wilayaCode: "16",
  commune: "Bab Ezzouar",
  address: "",
  mustChangePassword: false,
};

/** Simulacre du serveur : route → réponse. Toute route non prévue fait échouer le test (jamais d'appel inattendu). */
function server(routes: Record<string, () => Response>) {
  return stubFetch((call) => {
    const path = new URL(call.url, "http://x").pathname;
    const handler = routes[`${call.init.method ?? "GET"} ${path}`];
    if (!handler) throw new Error(`appel inattendu : ${call.init.method ?? "GET"} ${path}`);
    return handler();
  });
}

describe("mode API : espace cliente (identité = session côté serveur)", () => {
  it("« Mes commandes » : une seule requête GET /customers/me/orders, sans téléphone ni numéro, jamais de route admin ni de suivi public", async () => {
    const { calls } = server({
      "GET /api/customers/me": () => json(ACCOUNT),
      "GET /api/customers/me/orders": () => json([customerView(order)]),
    });
    render(<OrdersList />, { wrapper: wrapper() });
    expect(await screen.findByText(order.orderNumber)).toBeInTheDocument();
    const orderCalls = calls.filter((c) => c.url.includes("/orders"));
    expect(orderCalls).toHaveLength(1);
    expect(new URL(orderCalls[0]!.url, "http://x").search).toBe("");
    expect(calls.some((c) => c.url.includes("/admin/") || c.url.includes("/orders/track"))).toBe(false);
  });

  it("aucune commande : état vide, pas de formulaire de suivi mémorisant quoi que ce soit", async () => {
    server({ "GET /api/customers/me": () => json(ACCOUNT), "GET /api/customers/me/orders": () => json([]) });
    render(<OrdersList />, { wrapper: wrapper() });
    expect(await screen.findByText(/pas encore de commande/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("fashion-placed-orders")).toBeNull();
  });

  it("visiteuse non connectée (401) : l'espace propose la connexion, aucune commande n'est demandée", async () => {
    const { calls } = server({ "GET /api/customers/me": () => apiError(401, "UNAUTHENTICATED", "Veuillez vous connecter.") });
    render(
      <AccountShell>
        <p>contenu protégé</p>
      </AccountShell>,
      { wrapper: wrapper() },
    );
    expect(await screen.findByRole("form", { name: "Connexion" })).toBeInTheDocument();
    expect(screen.queryByText("contenu protégé")).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes("/orders"))).toBe(false);
  });

  it("mot de passe provisoire : seul le formulaire de changement est proposé, pas le contenu", async () => {
    server({ "GET /api/customers/me": () => json({ ...ACCOUNT, mustChangePassword: true }) });
    render(
      <AccountShell>
        <p>contenu protégé</p>
      </AccountShell>,
      { wrapper: wrapper() },
    );
    expect(await screen.findByRole("form", { name: /choisir un nouveau mot de passe/i })).toBeInTheDocument();
    expect(screen.queryByText("contenu protégé")).not.toBeInTheDocument();
  });

  it("connexion : POST /customers/login avec téléphone + mot de passe, puis le compte est connu", async () => {
    const user = userEvent.setup();
    const { calls } = server({
      "GET /api/customers/me": () => apiError(401, "UNAUTHENTICATED", "Veuillez vous connecter."),
      "POST /api/customers/login": () => json(ACCOUNT),
    });
    render(
      <AccountShell>
        <p>contenu protégé</p>
      </AccountShell>,
      { wrapper: wrapper() },
    );
    await user.type(await screen.findByLabelText(/numéro de téléphone/i), "0555 12 34 56");
    await user.type(screen.getByLabelText(/^mot de passe/i), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /me connecter/i }));
    expect(await screen.findByText("contenu protégé")).toBeInTheDocument();
    const login = calls.find((c) => c.url === "/api/customers/login")!;
    expect(JSON.parse(String(login.init.body))).toEqual({ phone: "0555 12 34 56", password: "correct-horse-battery" });
  });

  it("connexion refusée : message du serveur affiché, mot de passe jamais conservé dans l'interface", async () => {
    const user = userEvent.setup();
    server({
      "GET /api/customers/me": () => apiError(401, "UNAUTHENTICATED", "Veuillez vous connecter."),
      "POST /api/customers/login": () => apiError(401, "UNAUTHENTICATED", "Numéro ou mot de passe incorrect."),
    });
    render(<AccountShell>x</AccountShell>, { wrapper: wrapper() });
    await user.type(await screen.findByLabelText(/numéro de téléphone/i), "0555123456");
    await user.type(screen.getByLabelText(/^mot de passe/i), "mauvais-mot-de-passe");
    await user.click(screen.getByRole("button", { name: /me connecter/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Numéro ou mot de passe incorrect.");
    expect(window.localStorage.length === 0 || !JSON.stringify({ ...window.localStorage }).includes("mauvais-mot-de-passe")).toBe(true);
  });
});

describe("mode API : suivre une commande sans compte", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, number: string, phone: string) {
    await user.clear(screen.getByLabelText(/numéro de commande/i));
    await user.type(screen.getByLabelText(/numéro de commande/i), number);
    await user.type(screen.getByLabelText(/téléphone utilisé/i), phone);
    await user.click(screen.getByRole("button", { name: /suivre ma commande/i }));
  }

  const publicView = {
    orderNumber: "CMD-2026-000001",
    status: "confirmed",
    statusHistory: [{ status: "pending", at: "2026-01-01T10:00:00.000Z" }, { status: "confirmed", at: "2026-01-01T11:00:00.000Z" }],
    paymentMethod: "cash_on_delivery",
    paymentStatus: "pending",
    customer: { firstName: "Amina" },
    shippingAddress: { wilayaName: "Oran", commune: "Es Senia", deliveryMethod: "home" },
    items: [{ productName: "Robe", productSlug: "robe", color: "Noir", colorCode: "#000", size: "M", imageUrl: "/x.jpg", unitPrice: 10000, quantity: 1, lineTotal: 10000 }],
    subtotal: 10000,
    discountTotal: 0,
    shippingFee: 600,
    total: 10600,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T11:00:00.000Z",
  };

  it("couple valide : interroge /orders/track (numéro en majuscules) ; rien n'est mémorisé sur l'appareil", async () => {
    const user = userEvent.setup();
    const onFound = vi.fn();
    const { calls } = stubFetch(() => json(publicView));
    const before = JSON.stringify({ ...window.localStorage });
    render(<TrackOrderForm onFound={onFound} />, { wrapper: wrapper() });
    await fill(user, "cmd-2026-000001", "0555 12 34 56");
    await waitFor(() => expect(onFound).toHaveBeenCalledWith(publicView));
    const url = new URL(calls[0]!.url, "http://x");
    expect(url.pathname).toBe("/api/orders/track");
    expect(url.searchParams.get("number")).toBe("CMD-2026-000001");
    expect(url.searchParams.get("phone")).toBe("0555 12 34 56");
    expect(JSON.stringify({ ...window.localStorage })).toBe(before); // ni numéro ni téléphone conservés
  });

  it("couple inconnu : message unique (ne distingue pas numéro inconnu et mauvais téléphone)", async () => {
    const user = userEvent.setup();
    const onFound = vi.fn();
    stubFetch(() => apiError(404, "NOT_FOUND", "Commande introuvable."));
    render(<TrackOrderForm onFound={onFound} />, { wrapper: wrapper() });
    await fill(user, "CMD-2026-999999", "0555123456");
    expect(await screen.findByRole("alert")).toHaveTextContent(/aucune commande ne correspond/i);
    expect(onFound).not.toHaveBeenCalled();
  });

  it("téléphone invalide : erreur locale, aucun appel réseau", async () => {
    const user = userEvent.setup();
    const { fn } = stubFetch(() => json(publicView));
    render(<TrackOrderForm onFound={vi.fn()} />, { wrapper: wrapper() });
    await fill(user, "CMD-2026-000001", "123");
    expect(await screen.findByRole("alert")).toHaveTextContent(/numéro invalide/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("la page affiche le suivi minimal : prénom absent du DOM de livraison, ni téléphone, ni adresse, ni note", async () => {
    const user = userEvent.setup();
    stubFetch(() => json(publicView));
    render(<PublicTracking />, { wrapper: wrapper() });
    await fill(user, "CMD-2026-000001", "0555123456");
    const view = await screen.findByTestId("public-tracking");
    expect(view).toHaveTextContent("CMD-2026-000001");
    expect(view).toHaveTextContent("Es Senia, Oran");
    expect(view).not.toHaveTextContent(/0555|@|rue|remarque/i);
  });
});

describe("mode API : page de confirmation", () => {
  it("connectée : lit la commande via GET /customers/me/orders/:numéro (jamais la route publique de suivi ni admin)", async () => {
    const { calls } = server({
      "GET /api/customers/me": () => json(ACCOUNT),
      [`GET /api/customers/me/orders/${order.orderNumber}`]: () => json(customerView(order)),
    });
    render(<OrderConfirmationView orderNumber={order.orderNumber} />, { wrapper: wrapper() });
    expect(await screen.findByTestId("order-number")).toHaveTextContent(order.orderNumber);
    expect(calls.some((c) => c.url.includes("/orders/track") || c.url.includes("/admin/"))).toBe(false);
  });

  it("non connectée : invite à se connecter ou à suivre sans compte, ne demande aucune commande", async () => {
    const { calls } = server({ "GET /api/customers/me": () => apiError(401, "UNAUTHENTICATED", "Veuillez vous connecter.") });
    render(<OrderConfirmationView orderNumber={order.orderNumber} />, { wrapper: wrapper() });
    expect(await screen.findByText(/connectez-vous pour voir votre commande/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /suivre sans compte/i })).toHaveAttribute("href", "/track");
    expect(calls.some((c) => c.url.includes("/orders"))).toBe(false);
  });

  it("commande d'une autre cliente (404) : « introuvable », sans rien révéler", async () => {
    server({
      "GET /api/customers/me": () => json(ACCOUNT),
      [`GET /api/customers/me/orders/${order.orderNumber}`]: () => apiError(404, "NOT_FOUND", "Commande introuvable."),
    });
    render(<OrderConfirmationView orderNumber={order.orderNumber} />, { wrapper: wrapper() });
    expect(await screen.findByText("Commande introuvable")).toBeInTheDocument();
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
