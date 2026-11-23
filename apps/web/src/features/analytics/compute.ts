/**
 * Les calculs statistiques vivent dans `@fashion/shared` (partagés avec le serveur, qui doit produire
 * exactement les mêmes chiffres). Ce fichier conserve l'ancien chemin d'import côté interface.
 *
 * Définitions — à ne pas confondre :
 *  - Chiffre d'affaires (CA) : commandes LIVRÉES, remises déduites, hors frais de livraison.
 *  - Bénéfice brut : CA − coût d'achat des marchandises vendues.
 *  - Bénéfice net : non calculable ici (charges, loyer, salaires… inconnus).
 */
export {
  PERIOD_LABELS,
  buildActivity,
  buildCategoryBreakdown,
  buildKpis,
  buildReport,
  buildSeries,
  buildStatusBreakdown,
  buildTopProducts,
  filterOrdersByPeriod,
  orderCost,
  orderRevenue,
  periodStart,
} from "@fashion/shared";
