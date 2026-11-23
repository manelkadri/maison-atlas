import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { loginAsAdmin } from "./helpers";

/** Pages visitées à chaque largeur : aucune erreur console, aucune page d'erreur, aucun débordement horizontal. */
const STORE_ROUTES = [
  "/",
  "/shop",
  "/shop?category=femme",
  "/shop?collection=sale",
  "/product/robe-midi-satinee",
  "/categories",
  "/contact",
  "/cart",
  "/checkout",
  "/favorites",
  "/account",
  "/info/livraison",
  "/info/guide-des-tailles",
];

const ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/dashboard/products",
  "/admin/dashboard/products/new",
  "/admin/dashboard/categories",
  "/admin/dashboard/inventory",
  "/admin/dashboard/orders",
  "/admin/dashboard/customers",
  "/admin/dashboard/promotions",
  "/admin/dashboard/analytics",
  "/admin/dashboard/settings",
];

async function collectProblems(page: Page, path: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  const res = await page.goto(path, { waitUntil: "networkidle" });
  expect(res?.status(), `${path} status`).toBeLessThan(400);
  await expect(page.locator("main, [role='main']").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return { errors, overflow };
}

test.describe("boutique — smoke", () => {
  for (const route of STORE_ROUTES) {
    test(`${route}`, async ({ page }) => {
      const { errors, overflow } = await collectProblems(page, route);
      expect(errors, errors.join("\n")).toEqual([]);
      expect(overflow, "débordement horizontal").toBeLessThanOrEqual(1);
    });
  }
});

test.describe("admin — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of ADMIN_ROUTES) {
    test(`${route}`, async ({ page }) => {
      const { errors, overflow } = await collectProblems(page, route);
      expect(errors, errors.join("\n")).toEqual([]);
      expect(overflow, "débordement horizontal").toBeLessThanOrEqual(1);
    });
  }
});
