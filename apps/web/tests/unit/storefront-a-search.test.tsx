import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const searchProducts = vi.fn();
vi.mock("@/services", () => ({ productService: { searchProducts: (...args: unknown[]) => searchProducts(...args) } }));

import { SearchPanel } from "@/components/layout/search-dialog";

const product = (id: string, name: string, price: number) => ({ id, name, slug: id, price, images: [{ id: "i", url: `/${id}.svg`, alt: name, position: 0 }] });

function renderPanel(onNavigate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SearchPanel onNavigate={onNavigate} />
    </QueryClientProvider>,
  );
  return onNavigate;
}

describe("SearchPanel", () => {
  beforeEach(() => {
    push.mockReset();
    searchProducts.mockReset();
  });

  it("invite à saisir au moins 2 caractères et n'appelle pas le service", async () => {
    renderPanel();
    expect(screen.getByText(/au moins 2 caractères/i)).toBeInTheDocument();
    await userEvent.setup().type(screen.getByRole("combobox"), "r");
    expect(searchProducts).not.toHaveBeenCalled();
  });

  it("affiche au plus 6 résultats, navigue au clavier et ouvre la fiche avec Entrée", async () => {
    searchProducts.mockResolvedValue({
      items: [product("robe-lin", "Robe en lin", 8900), product("robe-soie", "Robe en soie", 12900)],
      total: 2,
      page: 1,
      pageSize: 6,
      totalPages: 1,
    });
    const user = userEvent.setup();
    const onNavigate = renderPanel();

    await user.type(screen.getByRole("combobox"), "robe");
    expect(await screen.findByText("Robe en lin")).toBeInTheDocument();
    expect(searchProducts).toHaveBeenCalledWith({ search: "robe" }, 1, 6);
    expect(screen.getByRole("link", { name: /Voir tous les résultats/ })).toHaveAttribute("href", "/shop?search=robe");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/product/robe-soie");
    expect(onNavigate).toHaveBeenCalled();
  });

  it("Entrée sans sélection lance la recherche complète", async () => {
    searchProducts.mockResolvedValue({ items: [product("a", "Robe", 100)], total: 1, page: 1, pageSize: 6, totalPages: 1 });
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByRole("combobox"), "robe d été");
    await screen.findByText("Robe");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/shop?search=robe%20d%20%C3%A9t%C3%A9");
  });

  it("affiche un état vide quand rien ne correspond", async () => {
    searchProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 6, totalPages: 0 });
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByRole("combobox"), "zzzz");
    expect(await screen.findByText(/Aucun résultat pour « zzzz »/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir la boutique" })).toHaveAttribute("href", "/shop");
  });
});
