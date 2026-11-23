import { expect, test as base, type Browser, type BrowserContext, type Page } from "@playwright/test";

/** Réseau hermétique pour les services tiers (carte Google). */
const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(/^https?:\/\/([^/]+\.)?(google\.com|gstatic\.com|googleapis\.com)\//, (r) => r.abort());
    await provide(page);
  },
});

const ADMIN = { email: "owner@example.com", password: "dev-password-12345" };

async function newPage(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  // Un contexte = un « appareil » distinct : aucun localStorage, aucun cookie partagé.
  const ctx = await browser.newContext({ locale: "fr-FR", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/([^/]+\.)?(google\.com|gstatic\.com|googleapis\.com)\//, (r) => r.abort());
  return { ctx, page };
}

async function adminLogin(page: Page, password = ADMIN.password) {
  await page.goto("/admin/login");
  await page.locator("input[type='email']").first().fill(ADMIN.email);
  await page.locator("#admin-password").fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
}

/** Passe une commande invité (livraison à domicile) et retourne son numéro. */
async function placeGuestOrder(page: Page, who: { last: string; first: string; phone: string }) {
  await page.goto("/product/pantalon-chino");
  await page.getByRole("button", { name: /^Taille [^,]+$/ }).first().click();
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  await page.goto("/checkout");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill(who.last);
  await page.getByRole("textbox", { name: "Prénom" }).fill(who.first);
  await page.getByRole("textbox", { name: "Téléphone" }).fill(who.phone);
  await page.getByRole("textbox", { name: "Commune" }).fill("Aïn Témouchent");
  await page.getByRole("textbox", { name: "Adresse complète" }).fill("12 rue de test, centre-ville");
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(page).toHaveURL(/order-confirmation\?number=CMD-/);
  const number = new URL(page.url()).searchParams.get("number")!;
  expect(number).toMatch(/^CMD-\d{4}-\d{6}$/);
  return number;
}

test.describe("site + API + PostgreSQL", () => {
  test("le catalogue vient de la base et n'expose jamais le prix d'achat", async ({ page, request }) => {
    await page.goto("/shop");
    await expect(page.locator("article").first()).toBeVisible();
    const res = await request.get("/api/products/catalog");
    expect(res.status()).toBe(200);
    const products = (await res.json()) as Array<{ costPrice: number; isPublished: boolean; isArchived: boolean }>;
    expect(products.length).toBeGreaterThan(10);
    expect(products.every((p) => p.costPrice === 0)).toBe(true);
    expect(products.every((p) => p.isPublished && !p.isArchived)).toBe(true);
  });

  test("l'administration exige une vraie session : 401 sans cookie, redirection, mauvais mot de passe refusé", async ({ page, request }) => {
    for (const path of ["/api/admin/orders", "/api/admin/products", "/api/admin/settings"]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login/);

    await adminLogin(page, "mauvais-mot-de-passe");
    await expect(page.getByText(/incorrect/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("connexion admin : cookie httpOnly, accès au tableau de bord, déconnexion qui coupe l'accès", async ({ browser }) => {
    const { ctx, page } = await newPage(browser);
    await adminLogin(page);
    await page.waitForURL("**/admin/dashboard");
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(/tableau de bord/i);

    const cookies = await ctx.cookies();
    const session = cookies.find((c) => c.name === "admin_session");
    expect(session, "cookie de session").toBeDefined();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");
    // Le jeton n'est jamais lisible par le JavaScript de la page.
    expect(await page.evaluate(() => document.cookie)).not.toContain("admin_session");
    // Aucune trace du jeton dans le stockage local.
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).not.toContain(session!.value.slice(0, 20));

    await page.getByRole("button", { name: /déconnexion|se déconnecter/i }).first().click().catch(async () => {
      await page.getByRole("button", { name: /^O|profil|compte/i }).first().click();
      await page.getByRole("menuitem", { name: /déconnexion|se déconnecter/i }).click();
    });
    await expect(page).toHaveURL(/\/admin\/login/);
    const after = await ctx.request.get("/api/admin/orders");
    expect(after.status()).toBe(401);
    await ctx.close();
  });

  test("UNE COMMANDE PASSÉE SUR UN APPAREIL APPARAÎT DANS L'ADMIN D'UN AUTRE, ET LE SUIVI REFLÈTE LE NOUVEAU STATUT", async ({ browser }) => {
    // Appareil du client
    const client = await newPage(browser);
    const phone = "0555 12 34 56";
    const number = await placeGuestOrder(client.page, { last: "Testeur", first: "Phase2", phone });

    // Appareil du propriétaire (contexte totalement séparé)
    const owner = await newPage(browser);
    await adminLogin(owner.page);
    await owner.page.waitForURL("**/admin/dashboard");
    await owner.page.goto(`/admin/dashboard/orders?search=${number}`);
    const row = owner.page.getByRole("row", { name: new RegExp(number) });
    await expect(row).toBeVisible();
    await expect(owner.page.getByRole("link", { name: number, exact: true })).toBeVisible();
    await expect(row).toContainText("En attente");
    await expect(row).toContainText("Testeur");

    // Le propriétaire confirme la commande
    await owner.page.getByRole("link", { name: number, exact: true }).click();
    await owner.page.getByRole("combobox", { name: /statut/i }).click();
    await owner.page.getByRole("option", { name: "Confirmée" }).click();
    await owner.page.getByRole("button", { name: /mettre à jour/i }).first().click();
    // « Confirmée » est un changement courant : pas de boîte de dialogue ; sinon on valide la dernière action proposée.
    const confirm = owner.page.getByRole("alertdialog");
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole("button").last().click();
    await expect(owner.page.getByText("Confirmée").first()).toBeVisible();

    // Le client voit le nouveau statut depuis son appareil
    await client.page.goto(`/order-confirmation?number=${number}`);
    await expect(client.page.getByText(/confirmée/i).first()).toBeVisible({ timeout: 15_000 });

    // Un inconnu qui ne donne pas le bon téléphone ne voit rien
    const stranger = await newPage(browser);
    const wrong = await stranger.ctx.request.get(`/api/orders/track?number=${number}&phone=0661000000`);
    expect(wrong.status()).toBe(404);
    const right = await stranger.ctx.request.get(`/api/orders/track?number=${number}&phone=${encodeURIComponent(phone)}`);
    expect(right.status()).toBe(200);

    await Promise.all([client.ctx.close(), owner.ctx.close(), stranger.ctx.close()]);
  });

  test("produit créé dans l'admin avec une vraie image téléversée : visible sur le site d'un visiteur sans stockage local", async ({ browser }) => {
    const owner = await newPage(browser);
    await adminLogin(owner.page);
    await owner.page.waitForURL("**/admin/dashboard");
    await owner.page.goto("/admin/dashboard/products/new");

    const name = `Gilet réel ${Date.now().toString().slice(-6)}`;
    await owner.page.getByRole("textbox", { name: "Nom du produit" }).fill(name);
    await owner.page.getByRole("textbox", { name: "Référence" }).fill(`REL-${Date.now().toString().slice(-6)}`);
    await owner.page.getByRole("textbox", { name: "Description" }).fill("Produit créé par le test E2E contre le vrai serveur.");
    await owner.page.getByRole("combobox", { name: "Catégorie" }).click();
    await owner.page.getByRole("option", { name: "Hauts & blouses" }).click();
    await owner.page.getByRole("spinbutton", { name: "Prix de vente" }).fill("5000");
    await owner.page.getByRole("spinbutton", { name: "Prix d'achat (coût)" }).fill("2000");

    // Vraie image PNG 1×1 envoyée au serveur (upload multipart)
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await owner.page.locator("input[type='file']").first().setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
    await expect(owner.page.getByText(/1 \/ 8 images/)).toBeVisible({ timeout: 15_000 });

    await owner.page.getByRole("list", { name: "Couleurs disponibles" }).getByRole("button", { name: "Noir" }).click();
    for (const size of ["S", "M"]) await owner.page.getByRole("list", { name: "Tailles disponibles" }).getByRole("button", { name: size, exact: true }).click();
    const stocks = owner.page.getByRole("spinbutton", { name: /^Stock/ });
    await expect(stocks).toHaveCount(2);
    for (let i = 0; i < 2; i++) await stocks.nth(i).fill("7");
    // Un produit neuf est un brouillon : on le publie pour qu'il apparaisse sur le site.
    await owner.page.getByRole("switch", { name: "Publié" }).check();
    await owner.page.getByRole("button", { name: /enregistrer le produit/i }).first().click();
    await expect(owner.page).toHaveURL(/\/admin\/dashboard\/products$/);

    // Un visiteur tout neuf (aucune donnée locale) trouve le produit
    const visitor = await newPage(browser);
    await visitor.page.goto(`/shop?search=${encodeURIComponent(name)}`);
    await expect(visitor.page.getByRole("link", { name }).first()).toBeVisible();
    await visitor.page.getByRole("link", { name }).first().click();
    await expect(visitor.page.getByRole("heading", { level: 1 })).toContainText(name);
    // L'image téléversée est servie par le serveur (/uploads/…)
    const src = await visitor.page.locator("main img").first().getAttribute("src");
    expect(src ?? "").toMatch(/uploads|_next\/image/);
    const imgRes = await visitor.page.request.get(src!);
    expect(imgRes.status()).toBe(200);

    await Promise.all([owner.ctx.close(), visitor.ctx.close()]);
  });

  test("les paramètres modifiés dans l'admin s'appliquent au site d'un autre appareil", async ({ browser }) => {
    const owner = await newPage(browser);
    await adminLogin(owner.page);
    await owner.page.waitForURL("**/admin/dashboard");
    await owner.page.goto("/admin/dashboard/settings");
    const tagline = `Slogan test ${Date.now().toString().slice(-5)}`;
    const field = owner.page.getByRole("textbox", { name: "Slogan" });
    const original = await field.inputValue();
    await field.fill(tagline);
    await owner.page.getByRole("button", { name: /enregistrer les paramètres/i }).click();
    await expect(owner.page.getByText(/enregistr/i).first()).toBeVisible();

    const visitor = await newPage(browser);
    await visitor.page.goto("/");
    await expect(visitor.page.getByRole("contentinfo")).toContainText(tagline);

    // Remise en l'état
    await field.fill(original);
    await owner.page.getByRole("button", { name: /enregistrer les paramètres/i }).click();
    await Promise.all([owner.ctx.close(), visitor.ctx.close()]);
  });

  test("le stock est décrémenté par une commande et restitué si elle est refusée", async ({ browser, request }) => {
    const readStock = async () => {
      const list = (await (await request.get("/api/products/by-slug/pantalon-chino")).json()) as { variants: Array<{ id: string; stock: number }> };
      return list.variants.reduce((s, v) => s + v.stock, 0);
    };
    const before = await readStock();

    const client = await newPage(browser);
    const number = await placeGuestOrder(client.page, { last: "Stock", first: "Test", phone: "0556 11 22 33" });
    const afterOrder = await readStock();
    expect(afterOrder).toBe(before - 1);

    const owner = await newPage(browser);
    await adminLogin(owner.page);
    await owner.page.waitForURL("**/admin/dashboard");
    await owner.page.goto(`/admin/dashboard/orders?search=${number}`);
    await owner.page.getByRole("link", { name: number, exact: true }).click();
    await owner.page.getByRole("combobox", { name: /statut/i }).click();
    await owner.page.getByRole("option", { name: "Refusée" }).click();
    await owner.page.getByRole("button", { name: /mettre à jour/i }).first().click();
    // Changement sensible : confirmation obligatoire (le bouton d'action est le dernier du dialogue).
    await owner.page.getByRole("alertdialog").getByRole("button", { name: /refuser la commande/i }).click();
    await expect(owner.page.getByText("Refusée").first()).toBeVisible();

    expect(await readStock()).toBe(before);
    await Promise.all([client.ctx.close(), owner.ctx.close()]);
  });
});
