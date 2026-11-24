/** Configuration statique du site (le contenu éditable par le propriétaire vit dans StoreSettings). */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Maison Atlas",
  description:
    "Prêt-à-porter féminin et accessoires. Paiement à la livraison, livraison à domicile ou en bureau partout en Algérie.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "fr_DZ",
  currency: "DZD",
  /** Nombre de produits par page du catalogue. */
  pageSize: 12,
} as const;

export type NavItem = { label: string; href: string };

/** Navigation principale de la boutique (aucun lien "#"). */
export const storeNav: NavItem[] = [
  { label: "Accueil", href: "/" },
  { label: "Nouveautés", href: "/shop?collection=new" },
  { label: "À propos de nous", href: "/info/a-propos" },
  { label: "Contact", href: "/contact" },
];

export const footerLinks = {
  shop: [
    { label: "Toute la boutique", href: "/shop" },
    { label: "Femme", href: "/shop?category=femme" },
    { label: "Accessoires", href: "/shop?category=accessoires" },
    { label: "Nouveautés", href: "/shop?collection=new" },
  ],
  help: [
    { label: "Livraison", href: "/info/livraison" },
    { label: "Retours & échanges", href: "/info/retours" },
    { label: "Guide des tailles", href: "/info/guide-des-tailles" },
    { label: "Suivre ma commande", href: "/account/orders" },
    { label: "Nous trouver", href: "/contact" },
  ],
  legal: [
    { label: "Mentions légales", href: "/info/mentions-legales" },
    { label: "Conditions générales de vente", href: "/info/conditions-generales" },
    { label: "Politique de confidentialité", href: "/info/confidentialite" },
  ],
} satisfies Record<string, NavItem[]>;

/** Tailles standard proposées dans le formulaire produit admin. */
export const STANDARD_SIZES = {
  clothing: ["XS", "S", "M", "L", "XL", "XXL"],
  numeric: ["36", "38", "40", "42", "44", "46"],
  accessories: ["Unique"],
} as const;

/** Palette de couleurs proposée dans l'admin pour créer des variantes. */
export const PRESET_COLORS = [
  { name: "Noir", code: "#1a1a1a" },
  { name: "Blanc", code: "#ffffff" },
  { name: "Beige", code: "#d8c3a5" },
  { name: "Camel", code: "#b08a5b" },
  { name: "Gris", code: "#8a8a88" },
  { name: "Marine", code: "#1f2f4a" },
  { name: "Bleu ciel", code: "#bcd0e0" },
  { name: "Olive", code: "#6b6a3f" },
  { name: "Bordeaux", code: "#6d1f2c" },
  { name: "Terracotta", code: "#b4654a" },
  { name: "Sauge", code: "#9aa58c" },
  { name: "Brun", code: "#4a3426" },
] as const;
