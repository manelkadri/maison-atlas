/* eslint-disable @next/next/no-img-element */
import { formatDZD } from "@fashion/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderConfirmationView } from "@/components/store/checkout/order-confirmation-view";
import { buildCreateOrderInput } from "@/features/checkout/place-order";
import { makeQueryClient } from "@/lib/query-client";
import { orderService, productService } from "@/services";
import { resetDb } from "@/services/mock/db";
import { useCustomerSessionStore } from "@/stores/customer-session.store";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => <img {...props} alt={props.alt ?? ""} />,
}));

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={makeQueryClient()}>{ui}</QueryClientProvider>);

describe("confirmation de commande", () => {
  beforeEach(() => {
    resetDb();
    // La confirmation n'est montrée qu'à la cliente connectée (ici, session simulée du mode mock).
    useCustomerSessionStore.setState({ profile: { firstName: "Sara", lastName: "Haddad", phone: "0661234567", email: "" } });
  });

  it("affiche numéro, récapitulatif, livraison en bureau, statut et prochaines étapes", async () => {
    const products = await productService.getProducts({ onlyPublic: true });
    const variant = products.flatMap((p) => p.variants).find((v) => v.stock >= 2)!;
    const order = await orderService.createOrder(
      buildCreateOrderInput({
        values: {
          lastName: "Haddad",
          firstName: "Sara",
          phone: "0661234567",
          wilayaCode: "31",
          commune: "Es Senia",
          address: "",
          deliveryMethod: "pickup_point",
          pickupPointId: "31-centre",
          note: "Appeler avant",
        },
        items: [{ variantId: variant.id, quantity: 2 }],
      }),
    );

    wrap(<OrderConfirmationView orderNumber={order.orderNumber} />);

    expect(await screen.findByTestId("order-number")).toHaveTextContent(order.orderNumber);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Merci Sara");
    expect(screen.getByText("En attente de confirmation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copier le numéro de commande" })).toBeInTheDocument();

    // Totaux : la livraison est séparée, le total est « à payer à la livraison ».
    expect(screen.getByText("Total à payer à la livraison")).toBeInTheDocument();
    expect(screen.getByText("Total à payer à la livraison").nextSibling?.textContent).toBe(formatDZD(order.total));
    expect(order.total).toBe(order.subtotal - order.discountTotal + order.shippingFee);

    expect(screen.getByText("Livraison en bureau")).toBeInTheDocument();
    expect(screen.getByText("Bureau Oran Centre")).toBeInTheDocument();
    expect(screen.getByText(/Appeler avant/)).toBeInTheDocument();

    expect(screen.getByText("Appel de confirmation")).toBeInTheDocument();
    expect(screen.getByText("Paiement à la réception")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Suivre ma commande" })).toHaveAttribute("href", `/account/orders/${order.orderNumber}`);
    expect(screen.getByRole("link", { name: "Continuer les achats" })).toHaveAttribute("href", "/shop");
    expect(within(screen.getByRole("list", { name: "Articles" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("numéro inconnu : état d'erreur propre avec actions", async () => {
    wrap(<OrderConfirmationView orderNumber="CMD-0000-000000" />);
    expect(await screen.findByText("Commande introuvable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuer les achats" })).toHaveAttribute("href", "/shop");
  });

  it("numéro absent : message dédié, sans requête", async () => {
    wrap(<OrderConfirmationView />);
    expect(screen.getByText("Aucun numéro de commande")).toBeInTheDocument();
  });
});
