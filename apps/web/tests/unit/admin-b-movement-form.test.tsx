import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { MovementDialog } from "@/components/admin/inventory/movement-dialog";
import { makeQueryClient } from "@/lib/query-client";
import { inventoryService } from "@/services";
import type { InventoryItem, StockMovement } from "@/types/inventory.types";

beforeAll(() => {
  // Radix (RadioGroup dans un formulaire) observe la taille des contrôles.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
});

const ITEMS: InventoryItem[] = [
  {
    variantId: "v1",
    productId: "p1",
    productName: "Robe midi satinée",
    productSlug: "robe-midi-satinee",
    imageUrl: "/x.svg",
    sku: "ROBE-NOI-M",
    color: "Noir",
    colorCode: "#1a1a1a",
    size: "M",
    stock: 10,
    alertThreshold: 3,
    status: "available",
  },
  {
    variantId: "v2",
    productId: "p1",
    productName: "Robe midi satinée",
    productSlug: "robe-midi-satinee",
    imageUrl: "/x.svg",
    sku: "ROBE-NOI-L",
    color: "Noir",
    colorCode: "#1a1a1a",
    size: "L",
    stock: 2,
    alertThreshold: 3,
    status: "low",
  },
];

const fakeMovement = (over: Partial<StockMovement> = {}): StockMovement => ({
  id: "mv1",
  variantId: "v1",
  productId: "p1",
  productName: "Robe midi satinée",
  sku: "ROBE-NOI-M",
  color: "Noir",
  size: "M",
  type: "in",
  quantityDelta: 5,
  quantityBefore: 10,
  quantityAfter: 15,
  reason: "Réception fournisseur",
  createdAt: new Date().toISOString(),
  ...over,
});

function setup(props: { variantId?: string; onOpenChange?: (o: boolean) => void } = {}) {
  const onOpenChange = props.onOpenChange ?? vi.fn();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MovementDialog open onOpenChange={onOpenChange} items={ITEMS} variantId={props.variantId} />
    </QueryClientProvider>,
  );
  return { user, onOpenChange };
}

const quantityInput = () => screen.getByRole("spinbutton");
const reasonInput = () => screen.getByRole("textbox", { name: /^Motif/ });
const submitButton = () => screen.getByRole("button", { name: "Enregistrer le mouvement" });

let record: MockInstance<typeof inventoryService.recordMovement>;

beforeEach(() => {
  record = vi.spyOn(inventoryService, "recordMovement").mockResolvedValue(fakeMovement());
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("formulaire de mouvement de stock", () => {
  it("affiche en direct « stock actuel → nouveau stock »", async () => {
    const { user } = setup({ variantId: "v1" });
    expect(screen.getByText("Robe midi satinée")).toBeInTheDocument();
    await user.type(quantityInput(), "5");
    const preview = screen.getByText("Stock actuel").parentElement!;
    expect(within(preview).getByText("10")).toBeInTheDocument();
    expect(within(preview).getByText("15")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Sortie" }));
    expect(within(screen.getByText("Stock actuel").parentElement!).getByText("5")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Ajustement" }));
    expect(within(screen.getByText("Stock actuel").parentElement!).getByText("5")).toBeInTheDocument(); // nouvelle valeur absolue = 5
  });

  it("exige une variante, une quantité et un motif", async () => {
    const { user } = setup();
    await user.click(submitButton());
    expect(await screen.findByText("Choisissez une variante.")).toBeInTheDocument();
    expect(screen.getByText("Quantité invalide.")).toBeInTheDocument();
    expect(screen.getByText(/Le motif est obligatoire/)).toBeInTheDocument();
    expect(record).not.toHaveBeenCalled();
  });

  it("refuse une quantité nulle pour une entrée", async () => {
    const { user } = setup({ variantId: "v1" });
    await user.type(quantityInput(), "0");
    await user.type(reasonInput(), "Réception fournisseur");
    await user.click(submitButton());
    expect(await screen.findByText("La quantité doit être d'au moins 1.")).toBeInTheDocument();
    expect(record).not.toHaveBeenCalled();
  });

  it("refuse une sortie supérieure au stock courant avec un message clair", async () => {
    const { user } = setup({ variantId: "v1" });
    await user.click(screen.getByRole("radio", { name: "Sortie" }));
    await user.type(quantityInput(), "11");
    await user.type(reasonInput(), "Casse");
    await user.click(submitButton());
    expect(await screen.findByText("Impossible de retirer 11 pièce(s) : le stock actuel est de 10.")).toBeInTheDocument();
    expect(record).not.toHaveBeenCalled();
  });

  it("refuse un ajustement identique au stock actuel", async () => {
    const { user } = setup({ variantId: "v1" });
    await user.click(screen.getByRole("radio", { name: "Ajustement" }));
    await user.type(quantityInput(), "10");
    await user.type(reasonInput(), "Inventaire");
    await user.click(submitButton());
    expect(await screen.findByText("Le nouveau stock est identique au stock actuel.")).toBeInTheDocument();
  });

  it("propose des motifs rapides cliquables", async () => {
    const { user } = setup({ variantId: "v1" });
    await user.click(screen.getByRole("button", { name: "Réception fournisseur" }));
    expect(reasonInput()).toHaveValue("Réception fournisseur");
  });

  it("enregistre une entrée valide puis ferme le dialogue", async () => {
    const { user, onOpenChange } = setup({ variantId: "v1" });
    await user.type(quantityInput(), "5");
    await user.click(screen.getByRole("button", { name: "Réception fournisseur" }));
    await user.click(submitButton());

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ variantId: "v1", type: "in", quantity: 5, reason: "Réception fournisseur" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("demande confirmation quand un retrait dépasse la moitié du stock", async () => {
    const { user } = setup({ variantId: "v1" });
    await user.click(screen.getByRole("radio", { name: "Sortie" }));
    await user.type(quantityInput(), "8");
    await user.click(screen.getByRole("button", { name: "Casse" }));
    await user.click(submitButton());

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/réduit le stock de plus de la moitié/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Stock : 10 → 2/)).toBeInTheDocument();
    expect(record).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(record).toHaveBeenCalledWith(expect.objectContaining({ type: "out", quantity: 8 })));
  });

  it("n'enregistre rien si la confirmation est annulée", async () => {
    const { user } = setup({ variantId: "v1" });
    await user.click(screen.getByRole("radio", { name: "Ajustement" }));
    await user.type(quantityInput(), "0");
    await user.click(screen.getByRole("button", { name: "Inventaire" }));
    await user.click(submitButton());

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/met le stock de la variante à 0/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(record).not.toHaveBeenCalled();
  });
});
