import {
  BadgePercent,
  ChartColumn,
  FolderTree,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Shirt,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export const ADMIN_ROOT = "/admin/dashboard";

export type AdminNavBadgeKey = "pendingOrders" | "outOfStock";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Badge optionnel (compteur) alimenté par le dashboard. */
  badge?: AdminNavBadgeKey;
  /** Si vrai, l'entrée n'est active que sur l'URL exacte (Dashboard). */
  exact?: boolean;
};

/** Navigation latérale de l'administration : 9 entrées. */
export const adminNav: AdminNavItem[] = [
  { label: "Dashboard", href: ADMIN_ROOT, icon: LayoutDashboard, exact: true },
  { label: "Produits", href: `${ADMIN_ROOT}/products`, icon: Shirt },
  { label: "Catégories", href: `${ADMIN_ROOT}/categories`, icon: FolderTree },
  { label: "Gestion des stocks", href: `${ADMIN_ROOT}/inventory`, icon: Warehouse, badge: "outOfStock" },
  { label: "Commandes", href: `${ADMIN_ROOT}/orders`, icon: ShoppingBag, badge: "pendingOrders" },
  { label: "Clients", href: `${ADMIN_ROOT}/customers`, icon: Users },
  { label: "Promotions", href: `${ADMIN_ROOT}/promotions`, icon: BadgePercent },
  { label: "Statistiques", href: `${ADMIN_ROOT}/analytics`, icon: ChartColumn },
  { label: "Paramètres", href: `${ADMIN_ROOT}/settings`, icon: Settings },
];

/** Libellés français des segments d'URL connus (fil d'Ariane). */
export const ADMIN_SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Tableau de bord",
  products: "Produits",
  categories: "Catégories",
  inventory: "Gestion des stocks",
  orders: "Commandes",
  customers: "Clients",
  promotions: "Promotions",
  analytics: "Statistiques",
  settings: "Paramètres",
  new: "Nouveau",
  edit: "Modifier",
};

export function isNavItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
