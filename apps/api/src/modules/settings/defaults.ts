import type { StoreSettings } from "@fashion/types";

/**
 * Valeurs par défaut de la boutique (copie de apps/web/src/mocks/settings.mock.ts).
 * Adresse, téléphone et WhatsApp sont réels ; l'e-mail est fictif et doit être remplacé depuis l'administration.
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Ali Prestige",
  tagline: "Prêt-à-porter essentiel, livré partout en Algérie.",
  logoUrl: "",
  phone: "0552 82 60 75",
  email: "contact@ali-prestige.example",
  address: "mizan, Rue, Aïn Témouchent 46000",
  openingHours: "Ouvert tous les jours sauf le vendredi · de 9h00 à 19h00",
  plusCode: "8V36+H8 Aïn Témouchent",
  whatsapp: "0552 82 60 75",
  social: {
    instagram: "https://www.instagram.com/ali_prestige46",
    tiktok: "https://www.tiktok.com/@boutique.ali.pres",
  },
  currency: "DZD",
  shippingFees: {
    "1": { home: 450, pickupPoint: 300 },
    "2": { home: 700, pickupPoint: 450 },
    "3": { home: 1200, pickupPoint: 800 },
  },
  freeShippingThreshold: 0,
  defaultAlertThreshold: 3,
};
