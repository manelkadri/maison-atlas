export type ShippingZoneFees = {
  /** Livraison à domicile (DZD). */
  home: number;
  /** Livraison en bureau (DZD). */
  pickupPoint: number;
};

export type StoreSettings = {
  storeName: string;
  tagline: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  /** Horaires d'ouverture, texte libre affiché sur la boutique (ex. « Tous les jours : 9h00 – 20h30 »). */
  openingHours: string;
  /** Plus Code Google Maps (ex. « 8V36+H8 Aïn Témouchent »). Sert à placer la carte ; à défaut, l'adresse est utilisée. */
  plusCode: string;
  /** Numéro WhatsApp de contact (format national, ex. « 0552 82 60 75 »). Vide = bouton masqué. */
  whatsapp: string;
  social: {
    instagram: string;
    tiktok: string;
  };
  currency: "DZD";
  /** Tarifs de livraison par zone (1 = proche, 2 = intermédiaire, 3 = éloignée / sud). */
  shippingFees: Record<"1" | "2" | "3", ShippingZoneFees>;
  /** Seuil de livraison offerte (0 = désactivé). */
  freeShippingThreshold: number;
  /** Seuil d'alerte appliqué par défaut aux nouvelles variantes. */
  defaultAlertThreshold: number;
};
