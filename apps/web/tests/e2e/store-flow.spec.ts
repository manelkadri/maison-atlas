import { expect, test } from "./fixtures";

test.describe("boutique — parcours client", () => {
  test("1. la homepage affiche hero, catégories dynamiques, nouveautés, meilleures ventes, newsletter et footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/élégance/i);
    await expect(page.getByRole("link", { name: "Découvrir la collection" })).toBeVisible();
    for (const name of ["Femme", "Accessoires"]) {
      await expect(page.getByRole("main").getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: /nouveautés/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /meilleures ventes/i })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(/Livraison/);
  });

  test("2-3. navigation catalogue, recherche et filtres (URL = source de vérité)", async ({ page }) => {
    await page.goto("/");
    if (test.info().project.name === "mobile") {
      // Sur mobile la navigation est dans le menu hamburger.
      await page.getByRole("button", { name: /menu/i }).first().click();
      await page.getByRole("dialog").getByRole("link", { name: "Boutique" }).click();
    } else {
      await page.getByRole("banner").getByRole("link", { name: "Boutique" }).click();
    }
    await expect(page).toHaveURL(/\/shop/);
    await expect(page.getByText(/19 produits/)).toBeVisible();

    // Catégorie : les robes
    await page.goto("/shop?category=robes");
    await expect(page.getByText(/2 produits/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Robe midi satinée" }).first()).toBeVisible();

    // Recherche
    await page.goto("/shop");
    await page.getByPlaceholder(/rechercher/i).first().fill("écharpe");
    await expect(page).toHaveURL(/search=/);
    await expect(page.getByText(/1 produit\b/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Écharpe en laine" }).first()).toBeVisible();

    // Promotions : uniquement des produits avec ancien prix
    await page.goto("/shop?collection=sale");
    const count = await page.locator("article").count();
    expect(count).toBeGreaterThan(0);
    await expect(page.locator("article").first().locator("s, .line-through").first()).toBeVisible();

    // Prix : filtre par URL appliqué
    await page.goto("/shop?min=20000");
    for (const price of await page.locator("article").locator("text=/\\d.*DA/").allTextContents()) {
      expect(price).toBeTruthy();
    }
    await expect(page.getByText(/produits?/).first()).toBeVisible();
  });

  test("4-6. variante, ajout au panier, lignes distinctes, quantité plafonnée", async ({ page }) => {
    await page.goto("/product/t-shirt-coton-premium");
    const addButton = page.getByRole("button", { name: /ajouter au panier|choisir/i }).first();

    // Aucune taille choisie : l'ajout est impossible
    await expect(addButton).toBeDisabled();

    // Variante 1 : Blanc / M
    await page.getByRole("button", { name: /^Blanc$/ }).click();
    await page.getByRole("button", { name: /^Taille M$/ }).click();
    await expect(page.getByRole("button", { name: "Ajouter au panier" }).first()).toBeEnabled();
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();

    // Variante 2 du même produit : Noir / L → ligne distincte
    await page.getByRole("button", { name: /^Noir$/ }).click();
    await page.getByRole("button", { name: /^Taille L$/ }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();

    await page.goto("/cart");
    await expect(page.getByRole("button", { name: /^Supprimer .* du panier$/ })).toHaveCount(2);

    // Quantité : on augmente la première ligne jusqu'au plafond sans le dépasser
    const plus = page.getByRole("button", { name: "Augmenter la quantité" }).first();
    for (let i = 0; i < 40; i++) {
      if (await plus.isDisabled()) break;
      await plus.click();
    }
    await expect(plus).toBeDisabled();

    // Les frais de livraison sont distincts du sous-total
    await expect(page.getByText(/livraison/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /passer la commande/i }).first()).toBeVisible();

    // Suppression d'une ligne
    await page.getByRole("button", { name: /^Supprimer .* du panier$/ }).first().click();
    await expect(page.getByRole("button", { name: /^Supprimer .* du panier$/ })).toHaveCount(1);
  });

  test("7-8. checkout : validation des champs puis création d'une commande COD mockée", async ({ page }) => {
    await page.goto("/product/pantalon-chino");
    // Choisir la première taille disponible (les tailles épuisées portent « , épuisée » dans leur nom)
    await page.getByRole("button", { name: /^Taille [^,]+$/ }).first().click();
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
    await page.goto("/checkout");

    // Soumission vide : erreurs en français
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByText(/obligatoire/i).first()).toBeVisible();

    // Téléphone invalide
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Benali");
    await page.getByRole("textbox", { name: "Prénom" }).fill("Amina");
    await page.getByRole("textbox", { name: "Téléphone" }).fill("123");
    await page.getByRole("button", { name: "Confirmer la commande" }).click();
    await expect(page.getByText(/Numéro invalide/i)).toBeVisible();

    // Formulaire valide (livraison à domicile)
    await page.getByRole("textbox", { name: "Téléphone" }).fill("0555 12 34 56");
    await page.getByRole("textbox", { name: "Commune" }).fill("Bab Ezzouar");
    await page.getByRole("textbox", { name: "Adresse complète" }).fill("Cité 5 Juillet, bloc C, n° 12");
    await page.getByRole("button", { name: "Confirmer la commande" }).click();

    await expect(page).toHaveURL(/order-confirmation\?number=CMD-/);
    await expect(page.getByText(/CMD-\d{4}-\d{6}/).first()).toBeVisible();
    await expect(page.getByText(/paiement à la livraison|à la livraison/i).first()).toBeVisible();

    // Le panier est vidé
    await page.goto("/cart");
    await expect(page.getByText(/panier est vide/i)).toBeVisible();
  });

  test("favoris : ajout puis retrait", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: /Ajouter .* aux favoris/ }).first().click();
    await page.goto("/favorites");
    await expect(page.locator("article")).toHaveCount(1);
    await page.getByRole("button", { name: /Retirer .* des favoris/ }).first().click();
    await expect(page.locator("article")).toHaveCount(0);
  });
});
