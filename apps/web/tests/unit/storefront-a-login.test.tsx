import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const login = vi.fn();
const register = vi.fn();
const changePassword = vi.fn();
vi.mock("@/services", () => ({
  customerAccountService: {
    login: (v: unknown) => login(v),
    register: (v: unknown) => register(v),
    changePassword: (v: unknown) => changePassword(v),
  },
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : "Erreur"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AuthPanel, ChangePasswordForm } from "@/components/store/account/auth-forms";

const ACCOUNT = { id: "c1", firstName: "Amina", lastName: "Benali", phone: "0555123456", wilayaCode: "16", commune: "Alger", address: "", mustChangePassword: false };

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("connexion de la cliente (téléphone + mot de passe)", () => {
  beforeEach(() => {
    login.mockReset();
    register.mockReset();
    changePassword.mockReset();
  });

  it("n'affiche aucun bandeau « démonstration » en mode API et un seul titre de niveau 1", () => {
    wrap(<AuthPanel />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("refuse un numéro invalide ou un mot de passe vide sans appeler le service", async () => {
    const user = userEvent.setup();
    wrap(<AuthPanel />);
    await user.type(screen.getByLabelText(/Numéro de téléphone/), "12345");
    await user.click(screen.getByRole("button", { name: "Me connecter" }));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(login).not.toHaveBeenCalled();
  });

  it("envoie téléphone + mot de passe au service", async () => {
    login.mockResolvedValue(ACCOUNT);
    const user = userEvent.setup();
    wrap(<AuthPanel />);
    await user.type(screen.getByLabelText(/Numéro de téléphone/), "0555 12 34 56");
    await user.type(screen.getByLabelText(/^Mot de passe/), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Me connecter" }));
    await waitFor(() => expect(login).toHaveBeenCalledWith({ phone: "0555 12 34 56", password: "correct-horse-battery" }));
  });

  it("affiche le message du serveur en cas d'échec (message unique, y compris trop d'essais)", async () => {
    login.mockRejectedValue(new Error("Trop de tentatives. Réessayez dans 15 minutes."));
    const user = userEvent.setup();
    wrap(<AuthPanel />);
    await user.type(screen.getByLabelText(/Numéro de téléphone/), "0555123456");
    await user.type(screen.getByLabelText(/^Mot de passe/), "x");
    await user.click(screen.getByRole("button", { name: "Me connecter" }));
    expect(await screen.findByText(/Trop de tentatives/)).toBeInTheDocument();
  });

  it("création de compte : champs obligatoires, confirmation du mot de passe, puis appel du service", async () => {
    register.mockResolvedValue(ACCOUNT);
    const user = userEvent.setup();
    wrap(<AuthPanel />);
    await user.click(screen.getByRole("button", { name: "Créer un compte" }));
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(register).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/^Prénom/), "Yacine");
    await user.type(screen.getByLabelText(/^Nom/), "Merabet");
    await user.type(screen.getByLabelText(/Numéro de téléphone/), "0661234567");
    await user.type(screen.getByLabelText(/^Commune/), "Es Senia");
    await user.type(screen.getByLabelText(/^Mot de passe/), "un-mot-de-passe");
    await user.type(screen.getByLabelText(/Confirmer le mot de passe/), "autre-chose");
    // Wilaya : composant Radix ; la validation du schéma bloque tant qu'elle est vide.
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(register).not.toHaveBeenCalled();
  });
});

describe("changement du mot de passe", () => {
  beforeEach(() => changePassword.mockReset());

  it("refuse un nouveau mot de passe trop court, identique à l'actuel ou mal confirmé ; n'appelle pas le service", async () => {
    const user = userEvent.setup();
    wrap(<ChangePasswordForm />);
    await user.type(screen.getByLabelText(/Mot de passe actuel/), "ancien-mot-de-passe");
    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), "court");
    await user.click(screen.getByRole("button", { name: /changer mon mot de passe/i }));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("envoie l'ancien et le nouveau mot de passe quand tout est valide", async () => {
    changePassword.mockResolvedValue(ACCOUNT);
    const user = userEvent.setup();
    wrap(<ChangePasswordForm />);
    await user.type(screen.getByLabelText(/Mot de passe actuel/), "ancien-mot-de-passe");
    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), "nouveau-mot-de-passe");
    await user.type(screen.getByLabelText(/Confirmer le nouveau/), "nouveau-mot-de-passe");
    await user.click(screen.getByRole("button", { name: /changer mon mot de passe/i }));
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith({ currentPassword: "ancien-mot-de-passe", newPassword: "nouveau-mot-de-passe" }));
  });

  it("forcé (mot de passe provisoire) : le formulaire l'explique et nomme le mot de passe provisoire", () => {
    wrap(<ChangePasswordForm forced />);
    expect(screen.getByRole("note")).toHaveTextContent(/mot de passe provisoire/i);
    expect(screen.getByLabelText(/^Mot de passe provisoire/)).toBeInTheDocument();
  });
});
