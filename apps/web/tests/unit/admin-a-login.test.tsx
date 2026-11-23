import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginForm } from "@/components/admin/shell/login-form";
import { SessionGuard } from "@/components/admin/shell/session-guard";
import { useAdminSessionStore } from "@/stores/admin-session.store";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/admin/dashboard",
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  useAdminSessionStore.setState({ isAuthenticated: false, email: null });
});

describe("connexion administrateur (simulée)", () => {
  it("affiche le bandeau de mode démonstration", () => {
    render(<AdminLoginForm />);
    expect(screen.getByRole("note")).toHaveTextContent(/mode démonstration/i);
    expect(screen.getByRole("note")).toHaveTextContent(/simulée et non sécurisée/i);
  });

  it("formulaire vide : affiche les erreurs et ne crée pas de session", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByText("L'e-mail est obligatoire.")).toBeInTheDocument();
    expect(screen.getByText("Le mot de passe est obligatoire.")).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse e-mail/i)).toHaveAttribute("aria-invalid", "true");
    expect(useAdminSessionStore.getState().isAuthenticated).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("e-mail invalide : message dédié", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);
    await user.type(screen.getByLabelText(/adresse e-mail/i), "pas-un-email");
    await user.type(screen.getByLabelText(/^mot de passe/i), "x");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));
    expect(await screen.findByText("Adresse e-mail invalide.")).toBeInTheDocument();
    expect(useAdminSessionStore.getState().isAuthenticated).toBe(false);
  });

  it("identifiants valides : crée la session et redirige vers le dashboard", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);
    await user.type(screen.getByLabelText(/adresse e-mail/i), "proprio@maison-atlas.dz");
    await user.type(screen.getByLabelText(/^mot de passe/i), "n'importe-quoi");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => expect(useAdminSessionStore.getState().isAuthenticated).toBe(true), { timeout: 3000 });
    expect(useAdminSessionStore.getState().email).toBe("proprio@maison-atlas.dz");
    expect(replace).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("permet d'afficher et de masquer le mot de passe", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);
    const input = screen.getByLabelText(/^mot de passe/i);
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /afficher le mot de passe/i }));
    expect(input).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /masquer le mot de passe/i }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("déjà connecté : redirige vers le dashboard sans afficher le formulaire", async () => {
    useAdminSessionStore.setState({ isAuthenticated: true, email: "a@b.dz" });
    render(<AdminLoginForm />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/dashboard"));
    expect(screen.queryByRole("button", { name: /se connecter/i })).not.toBeInTheDocument();
  });
});

describe("garde de session simulée", () => {
  it("non connecté : redirige vers /admin/login et n'affiche jamais le contenu", async () => {
    render(
      <SessionGuard>
        <p>Contenu confidentiel</p>
      </SessionGuard>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(screen.queryByText("Contenu confidentiel")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("connecté : affiche le contenu sans redirection", () => {
    useAdminSessionStore.setState({ isAuthenticated: true, email: "a@b.dz" });
    render(
      <SessionGuard>
        <p>Contenu confidentiel</p>
      </SessionGuard>,
    );
    expect(screen.getByText("Contenu confidentiel")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
