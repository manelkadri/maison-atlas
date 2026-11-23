import { expect, test } from "./fixtures";
import { loginAsAdmin } from "./helpers";

test.describe("admin — parcours propriétaire", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("la connexion simulée est signalée comme non sécurisée et /admin/dashboard exige une session", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText(/non sécurisée/i).first()).toBeVisible();
    await ctx.close();
  });

  test("9-10. création d'un produit : 2 couleurs × 3 tailles génèrent 6 variantes avec stock initial", async ({ page }) => {
    await page.goto("/admin/dashboard/products/new");

    await page.getByRole("textbox", { name: "Nom du produit" }).fill("Gilet test E2E");
    await expect(page.getByRole("textbox", { name: /^Slug/ })).toHaveValue("gilet-test-e2e");
    await page.getByRole("textbox", { name: "Référence" }).fill("TST-E2E-001");
    await page.getByRole("textbox", { name: "Description" }).fill("Gilet de test créé par le parcours E2E automatisé.");
    await page.getByRole("combobox", { name: "Catégorie" }).click();
    await page.getByRole("option", { name: "Hauts & blouses" }).click();

    await page.getByRole("spinbutton", { name: "Prix de vente" }).fill("5000");
    await page.getByRole("spinbutton", { name: "Prix d'achat (coût)" }).fill("2000");
    // Marge brute estimée affichée en direct (5000 - 2000 = 3 000 DA)
    await expect(page.getByText(/3\s?000\s?DA/).first()).toBeVisible();

    await page.getByRole("textbox", { name: /Ou ajouter par URL/ }).fill("/images/products/blouse-en-soie-fluide/noir-1.svg");
    await page.getByRole("region", { name: "Images" }).getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText(/1 \/ 8 images/)).toBeVisible();

    await page.getByRole("list", { name: "Couleurs disponibles" }).getByRole("button", { name: "Noir" }).click();
    await page.getByRole("list", { name: "Couleurs disponibles" }).getByRole("button", { name: "Blanc" }).click();
    for (const size of ["S", "M", "L"]) {
      await page.getByRole("list", { name: "Tailles disponibles" }).getByRole("button", { name: size, exact: true }).click();
    }

    // 6 variantes générées, chacune avec un SKU unique
    const skuInputs = page.getByRole("textbox", { name: /^SKU/ });
    await expect(skuInputs).toHaveCount(6);
    const skus = await skuInputs.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(new Set(skus).size).toBe(6);

    // Stock initial de chaque variante
    const stocks = page.getByRole("spinbutton", { name: /^Stock/ });
    await expect(stocks).toHaveCount(6);
    for (let i = 0; i < 6; i++) await stocks.nth(i).fill(String(10 + i));

    await page.getByRole("button", { name: /enregistrer|créer le produit/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/products$/);
    await expect(page.getByText("Gilet test E2E").first()).toBeVisible();
  });

  test("11. ajustement de stock : le mouvement est historisé et le stock mis à jour", async ({ page }) => {
    await page.goto("/admin/dashboard/inventory?status=out_of_stock");
    const firstRow = page.locator("tbody tr").first();
    const label = (await firstRow.getByRole("button", { name: /^Ajouter des quantités/ }).getAttribute("aria-label"))!;
    const variant = label.split("—")[1]!.trim();

    await firstRow.getByRole("button", { name: /^Ajouter des quantités/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("spinbutton", { name: /quantité/i }).fill("12");
    await dialog.getByRole("textbox", { name: /motif/i }).fill("Réception fournisseur E2E");
    await dialog.getByRole("button", { name: /enregistrer/i }).click();
    await expect(dialog).toBeHidden();

    // Le stock de cette variante n'est plus en rupture : elle quitte le filtre « Rupture »
    await expect(page.getByRole("button", { name: new RegExp(`Ajouter des quantités — ${variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).toHaveCount(0);

    // Historique
    await page.getByRole("tab", { name: /mouvements/i }).click();
    await expect(page.getByText("Réception fournisseur E2E").first()).toBeVisible();
  });

  test("12. changement de statut d'une commande avec confirmation, et paiement COD encaissé à la livraison", async ({ page }) => {
    await page.goto("/admin/dashboard/orders?status=pending");
    await page.getByRole("link", { name: /^CMD-/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/orders\/ord_/);
    await expect(page.getByText(/En attente/).first()).toBeVisible();
    await expect(page.getByText(/à encaisser/i).first()).toBeVisible();

    // pending → confirmed (transition autorisée)
    await page.getByRole("combobox", { name: /statut/i }).click();
    await page.getByRole("option", { name: "Confirmée" }).click();
    await page.getByRole("button", { name: /mettre à jour|appliquer|enregistrer/i }).first().click();
    const confirm = page.getByRole("alertdialog");
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole("button", { name: /confirmer/i }).click();
    await expect(page.getByText("Confirmée").first()).toBeVisible();

    // Le sélecteur ne propose que les transitions autorisées : « Livrée » est impossible depuis « Confirmée »
    await page.getByRole("combobox", { name: /statut/i }).click();
    await expect(page.getByRole("option", { name: "Livrée" })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "En préparation" })).toBeVisible();
  });

  test("13. statistiques : indicateurs, filtres de période et définitions CA / bénéfice brut", async ({ page }) => {
    await page.goto("/admin/dashboard/analytics");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/statistiques/i);
    await expect(page.getByText(/chiffre d'affaires/i).first()).toBeVisible();
    await expect(page.getByText(/bénéfice brut/i).first()).toBeVisible();
    await expect(page.getByText(/taux d'annulation/i).first()).toBeVisible();

    await page.getByRole("tab", { name: /7 j/i }).click();
    await expect(page).toHaveURL(/period=7d/);
    await page.getByRole("tab", { name: /90 j/i }).click();
    await expect(page).toHaveURL(/period=90d/);

    // Le bénéfice net n'est jamais présenté comme un chiffre calculé (explication dans l'accordéon)
    await page.getByRole("button", { name: /comment lire ces chiffres/i }).click();
    await expect(page.getByText(/bénéfice net/i).first()).toBeVisible(); // uniquement dans l'explication
    await expect(page.getByText(/non calculable|n'est pas calculable|pas calculé/i).first()).toBeVisible();
  });
});
