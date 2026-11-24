import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Interface en mode API : la variable doit être posée AVANT l'import des services.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_DATA_SOURCE = "api";
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { ResetPasswordDialog } from "@/components/admin/customers/reset-password-dialog";
import { apiError, bodyOf, json, stubFetch } from "./web-api-helpers";

afterEach(() => vi.unstubAllGlobals());

function open() {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ResetPasswordDialog customerId="c1" customerName="Amina Benali" open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return onOpenChange;
}

const submit = () => screen.getByRole("button", { name: /^réinitialiser$/i });
const field = () => screen.getByLabelText(/votre mot de passe administrateur/i);

describe("administration : réinitialisation du mot de passe d'une cliente", () => {
  it("exige le mot de passe de l'administrateur : vide ⇒ erreur, aucun appel réseau", async () => {
    const { fn } = stubFetch(() => json({}));
    const user = userEvent.setup();
    open();
    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(/mot de passe est obligatoire/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("succès : POST avec le mot de passe admin ; le provisoire s'affiche UNE fois avec l'avertissement ; la fermeture est proposée", async () => {
    const { calls } = stubFetch(() => json({ customerId: "c1", temporaryPassword: "Prov-Abc123xyz9", mustChangePassword: true }));
    const user = userEvent.setup();
    const onOpenChange = open();
    await user.type(field(), "mot-de-passe-admin");
    await user.click(submit());
    expect(await screen.findByTestId("temporary-password")).toHaveTextContent("Prov-Abc123xyz9");
    expect(calls[0]?.url).toBe("/api/admin/customers/c1/reset-password");
    expect(bodyOf(calls[0]!)).toEqual({ adminPassword: "mot-de-passe-admin" });
    expect(screen.getByRole("note")).toHaveTextContent(/ne sera plus affiché/i);
    await user.click(screen.getByRole("button", { name: /j'ai noté/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("mot de passe administrateur erroné (403) : message du serveur, champ vidé, aucun mot de passe provisoire affiché", async () => {
    stubFetch(() => apiError(403, "FORBIDDEN", "Mot de passe incorrect."));
    const user = userEvent.setup();
    open();
    await user.type(field(), "faux");
    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Mot de passe incorrect.");
    await waitFor(() => expect(field()).toHaveValue(""));
    expect(screen.queryByTestId("temporary-password")).not.toBeInTheDocument();
  });
});
