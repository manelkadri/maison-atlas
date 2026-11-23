export type AnalyticsPeriod = "7d" | "30d" | "90d" | "12m" | "all";

export type TimeSeriesPoint = {
  /** Étiquette lisible (ex. "12 oct"). */
  label: string;
  /** Début de période ISO. */
  date: string;
  revenue: number;
  orders: number;
};

export type DashboardKpis = {
  /** CA des commandes livrées (encaissé en COD). */
  revenue: number;
  ordersCount: number;
  pendingOrders: number;
  deliveredOrders: number;
  productsCount: number;
  outOfStockVariants: number;
};

export type StatusBreakdownItem = {
  status: string;
  label: string;
  count: number;
};

export type TopProduct = {
  productId: string;
  name: string;
  imageUrl: string;
  unitsSold: number;
  revenue: number;
};

export type CategoryBreakdownItem = {
  categoryId: string;
  name: string;
  revenue: number;
  unitsSold: number;
};

/**
 * Rappel de définitions (ne pas confondre) :
 * - revenue (chiffre d'affaires) : somme des ventes livrées, hors livraison
 * - grossProfit (bénéfice brut)  : revenue - coût d'achat des marchandises vendues
 * - le bénéfice net (après charges, loyers, salaires, livraison...) n'est PAS calculable ici
 */
export type AnalyticsReport = {
  period: AnalyticsPeriod;
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  grossMarginRate: number;
  ordersCount: number;
  deliveredCount: number;
  averageOrderValue: number;
  cancellationRate: number;
  series: TimeSeriesPoint[];
  topProducts: TopProduct[];
  byCategory: CategoryBreakdownItem[];
  byStatus: StatusBreakdownItem[];
};

export type ActivityEvent = {
  id: string;
  type: "order" | "stock" | "product" | "customer";
  message: string;
  at: string;
};
