import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() } }));

import { NEWSLETTER_STORAGE_KEY, NewsletterForm } from "@/components/store/newsletter-form";

describe("NewsletterForm", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
  });

  it("affiche une erreur accessible pour un e-mail invalide et n'enregistre rien", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.type(screen.getByLabelText("Adresse e-mail"), "pas-un-email");
    await user.click(screen.getByRole("button", { name: /inscrire/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Adresse e-mail invalide.");
    expect(screen.getByLabelText("Adresse e-mail")).toHaveAttribute("aria-invalid", "true");
    expect(window.localStorage.getItem(NEWSLETTER_STORAGE_KEY)).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("signale un champ vide", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);
    await user.click(screen.getByRole("button", { name: /inscrire/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("L'e-mail est obligatoire.");
  });

  it("enregistre un e-mail valide en local (simulation), affiche le succès et le toast", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.type(screen.getByLabelText("Adresse e-mail"), "Client@Example.com");
    await user.click(screen.getByRole("button", { name: /inscrire/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Merci, vous êtes inscrit"));
    expect(toastSuccess).toHaveBeenCalledWith("Merci, vous êtes inscrit");
    expect(JSON.parse(window.localStorage.getItem(NEWSLETTER_STORAGE_KEY) ?? "[]")).toEqual(["client@example.com"]);
  });
});
