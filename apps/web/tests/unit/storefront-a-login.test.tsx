import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findByPhone = vi.fn();
vi.mock("@/services", () => ({
  customerService: { findByPhone: (phone: string) => findByPhone(phone) },
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : "Erreur"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LoginForm } from "@/components/store/account/login-form";
import { useCustomerSessionStore } from "@/stores/customer-session.store";

describe("LoginForm (espace client simulé)", () => {
  beforeEach(() => {
    findByPhone.mockReset();
    useCustomerSessionStore.setState({ profile: null });
  });

  it("affiche le bandeau de mode démonstration non sécurisé", () => {
    render(<LoginForm />);
    expect(screen.getByRole("note")).toHaveTextContent(/mode démonstration/i);
    expect(screen.getByRole("note")).toHaveTextContent(/n'est pas sécurisé/i);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("refuse un numéro invalide sans appeler le service", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Numéro de téléphone/), "12345");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Numéro invalide");
    expect(findByPhone).not.toHaveBeenCalled();
    expect(useCustomerSessionStore.getState().profile).toBeNull();
  });

  it("connecte un client connu", async () => {
    findByPhone.mockResolvedValue({ id: "c1", firstName: "Amina", lastName: "Benali", phone: "0555123456", email: "a@b.dz" });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Numéro de téléphone/), "0555 12 34 56");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(useCustomerSessionStore.getState().profile?.firstName).toBe("Amina"));
  });

  it("demande le nom d'un numéro inconnu puis crée la session locale", async () => {
    findByPhone.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Numéro de téléphone/), "0661234567");
    await user.click(screen.getByRole("button", { name: "Continuer" }));

    const first = await screen.findByLabelText(/Prénom/);
    // Champs obligatoires : erreur si vide.
    await user.click(screen.getByRole("button", { name: "Accéder à mon espace" }));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);

    await user.type(first, "Yacine");
    await user.type(screen.getByLabelText(/^Nom/), "Merabet");
    await user.click(screen.getByRole("button", { name: "Accéder à mon espace" }));
    await waitFor(() =>
      expect(useCustomerSessionStore.getState().profile).toMatchObject({ firstName: "Yacine", lastName: "Merabet", phone: "0661234567" }),
    );
  });
});
