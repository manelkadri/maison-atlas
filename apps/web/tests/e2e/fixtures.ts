import { test as base, expect } from "@playwright/test";

/**
 * `test` Playwright avec un réseau hermétique : les services tiers (carte Google Maps intégrée)
 * sont bloqués. Les tests restent rapides et ne dépendent pas d'Internet ; l'iframe de la carte
 * reste présente dans le DOM (son attribut `src` est vérifié par les tests unitaires).
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(/^https?:\/\/([^/]+\.)?(google\.com|gstatic\.com|googleapis\.com|googleusercontent\.com)\//, (route) => route.abort());
    await provide(page);
  },
});

export { expect };
