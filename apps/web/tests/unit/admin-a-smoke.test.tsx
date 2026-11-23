import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryList } from "@/components/admin/categories/category-list";
import { DashboardView } from "@/components/admin/dashboard/dashboard-view";
import { ProductForm } from "@/components/admin/products/product-form";
import { ProductList } from "@/components/admin/products/product-list";
import { TooltipProvider } from "@/components/ui/tooltip";
import { makeQueryClient } from "@/lib/query-client";

// jsdom n'implémente pas ResizeObserver (utilisé par Radix : Switch, Select, Popover…).
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

Element.prototype.scrollIntoView = vi.fn();

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/admin/dashboard/products",
}));
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="charts-placeholder" /> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

function renderWithProviders(ui: ReactNode) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
});

describe("pages admin — rendu avec les services mock", () => {
  it("liste des produits : affiche des lignes, 10 par page, et la pagination", async () => {
    renderWithProviders(<ProductList />);
    expect(await screen.findByRole("table", {}, { timeout: 4000 })).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.length - 1).toBeLessThanOrEqual(10);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ajouter un produit/i })).toHaveAttribute("href", "/admin/dashboard/products/new");
  });

  it("liste des produits : la recherche filtre la liste", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductList />);
    await screen.findByRole("table", {}, { timeout: 4000 });
    await user.type(screen.getByRole("searchbox", { name: /rechercher un produit/i }), "zzzz-introuvable");
    expect(await screen.findByText("Aucun résultat", {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it("catégories : liste hiérarchique avec collections verrouillées", async () => {
    renderWithProviders(<CategoryList />);
    expect(await screen.findByRole("table", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getAllByText(/collection/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /nouvelle catégorie/i })).toBeInTheDocument();
  });

  it("dashboard : affiche les 6 indicateurs calculés", async () => {
    renderWithProviders(<DashboardView />);
    expect(await screen.findByText("Chiffre d'affaires", {}, { timeout: 4000 })).toBeInTheDocument();
    for (const label of ["Commandes", "En attente", "Livrées", "Produits actifs", "Variantes en rupture"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/données de démonstration/i)).toBeInTheDocument();
  });

  it("formulaire produit : 2 couleurs × 3 tailles génèrent 6 variantes éditables avec stock", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductForm mode="create" />);

    await user.click(screen.getByRole("button", { name: "Noir", pressed: false }));
    await user.click(screen.getByRole("button", { name: "Beige", pressed: false }));
    await user.click(screen.getByRole("button", { name: "S", pressed: false }));
    await user.click(screen.getByRole("button", { name: "M", pressed: false }));
    await user.click(screen.getByRole("button", { name: "L", pressed: false }));

    const group = screen.getByRole("group", { name: /tableau des variantes/i });
    expect(within(group).getAllByRole("listitem")).toHaveLength(6);

    const stock = within(group).getByLabelText("Stock — Noir / S");
    await user.clear(stock);
    await user.type(stock, "12");
    expect(stock).toHaveValue(12);

    // Ajouter une taille conserve le stock saisi.
    await user.click(screen.getByRole("button", { name: "XL", pressed: false }));
    expect(within(group).getAllByRole("listitem")).toHaveLength(8);
    expect(within(group).getByLabelText("Stock — Noir / S")).toHaveValue(12);
  });

  it("formulaire produit : valider un formulaire vide affiche les erreurs sans enregistrer", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductForm mode="create" />);
    await user.click(screen.getByRole("button", { name: /enregistrer le produit/i }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(screen.getByText("Ajoutez au moins une image.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("formulaire produit : le slug se génère depuis le nom tant qu'il n'est pas modifié à la main", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductForm mode="create" />);
    await user.type(screen.getByLabelText(/nom du produit/i), "Robe Été Lin");
    expect(screen.getByLabelText(/^slug/i)).toHaveValue("robe-ete-lin");
    await user.clear(screen.getByLabelText(/^slug/i));
    await user.type(screen.getByLabelText(/^slug/i), "mon-slug");
    await user.type(screen.getByLabelText(/nom du produit/i), " Bleue");
    expect(screen.getByLabelText(/^slug/i)).toHaveValue("mon-slug");
  });
});
