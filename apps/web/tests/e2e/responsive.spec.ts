import { expect, test } from "./fixtures";
import { expectNoHorizontalOverflow, loginAsAdmin } from "./helpers";

const WIDTHS = [360, 390, 768, 1024, 1440] as const;

// Chaque test parcourt une vingtaine de pages à une largeur donnée : marge de temps confortable.
test.describe.configure({ timeout: 120_000 });

const STORE_PAGES = [
  "/",
  "/shop",
  "/shop?category=femme&collection=sale",
  "/product/robe-midi-satinee",
  "/categories",
  "/contact",
  "/cart",
  "/checkout",
  "/favorites",
  "/account",
  "/account/orders",
  "/account/profile",
  "/info/livraison",
  "/info/retours",
  "/info/guide-des-tailles",
  "/info/mentions-legales",
];
const ADMIN_PAGES = [
  "/admin/dashboard",
  "/admin/dashboard/products",
  "/admin/dashboard/inventory",
  "/admin/dashboard/orders",
  "/admin/dashboard/customers",
  "/admin/dashboard/analytics",
  "/admin/dashboard/settings",
  "/admin/dashboard/products/new",
  "/admin/dashboard/categories",
  "/admin/dashboard/promotions",
  "/admin/dashboard/orders/ord_0001",
  "/admin/dashboard/orders/ord_0072",
  "/admin/dashboard/customers/cust_001",
  "/admin/dashboard/products/prod_001/edit",
];

test.describe("14. responsive — boutique", () => {
  for (const width of WIDTHS) {
    test(`aucun débordement horizontal à ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of STORE_PAGES) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expectNoHorizontalOverflow(page);
      }
    });
  }

  test("mobile : le menu hamburger ouvre la navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /menu/i }).first().click();
    const nav = page.getByRole("dialog");
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Femme" }).first().click();
    await expect(page).toHaveURL(/category=femme/);
  });

  test("mobile : les filtres s'ouvrent dans un tiroir", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shop");
    await page.getByRole("button", { name: /filtres/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("14. responsive — dashboard", () => {
  for (const width of WIDTHS) {
    test(`aucun débordement horizontal à ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAsAdmin(page);
      for (const path of ADMIN_PAGES) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expectNoHorizontalOverflow(page);
      }
    });
  }

  test("mobile : le tiroir de navigation admin s'ouvre", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);
    await page.getByRole("button", { name: /menu|navigation/i }).first().click();
    await expect(page.getByRole("dialog").getByRole("link", { name: /commandes/i }).first()).toBeVisible();
  });
});
