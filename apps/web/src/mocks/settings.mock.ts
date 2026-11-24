import type { StoreSettings } from "@/types/settings.types";

/** Paramètres de démonstration. Les coordonnées sont fictives. */
export const settingsMock: StoreSettings = {
  storeName: "Ali Prestige",
  tagline: "Prêt-à-porter essentiel, livré partout en Algérie.",
  logoUrl: "",
  // Coordonnées réelles de la boutique. Seul l'e-mail reste fictif.
  phone: "0552 82 60 75",
  email: "contact@ali-prestige.example",
  address: "mizan, Rue, Aïn Témouchent 46000",
  openingHours: "Ouvert tous les jours · fermeture à 20h30",
  plusCode: "8V36+H8 Aïn Témouchent",
  whatsapp: "0552 82 60 75",
  // Liens nettoyés de leurs paramètres de suivi (?gwpx=…, ?_r=…&_t=…) : ils mènent aux mêmes profils.
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
