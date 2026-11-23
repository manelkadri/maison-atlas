import { expect, type Page } from "@playwright/test";

/** Connexion admin SIMULÉE (n'importe quel e-mail valide + mot de passe non vide). */
export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.locator("#admin-email, input[type='email']").first().fill("owner@example.com");
  await page.locator("#admin-password").fill("demo");
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL("**/admin/dashboard");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

/** Aucun débordement horizontal (tolérance 1 px). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "débordement horizontal").toBeLessThanOrEqual(1);
}
