"use client";

import { formatDZD } from "@fashion/shared";
import { BarChart3, Banknote, ShoppingBag, TrendingUp, Wallet, XCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PERIOD_LABELS } from "@/features/analytics/compute";
import { buildDeliveredTopProducts, buildProductMargins } from "@/features/analytics/breakdowns";
import { useAnalyticsReport } from "@/features/analytics/hooks";
import { formatPercent } from "@/features/customers/logic";
import { useUrlParams } from "@/features/inventory/use-url-params";
import { useOrders } from "@/features/orders/hooks";
import { getErrorMessage } from "@/services";
import type { AnalyticsPeriod } from "@/types/analytics.types";
import { chartColor } from "./chart-palette";
import { Definitions } from "./definitions";
import { MarginTable } from "./margin-table";

const chartLoading = () => <Skeleton className="h-full w-full" />;
const SalesChart = dynamic(() => import("./charts").then((m) => m.SalesChart), { ssr: false, loading: chartLoading });
const CategoryChart = dynamic(() => import("./charts").then((m) => m.CategoryChart), { ssr: false, loading: chartLoading });
const TopProductsChart = dynamic(() => import("./charts").then((m) => m.TopProductsChart), { ssr: false, loading: chartLoading });
const StatusChart = dynamic(() => import("./charts").then((m) => m.StatusChart), { ssr: false, loading: chartLoading });

const PERIODS: AnalyticsPeriod[] = ["7d", "30d", "90d", "12m", "all"];
const PERIOD_SHORT: Record<AnalyticsPeriod, string> = { "7d": "7 jours", "30d": "30 jours", "90d": "90 jours", "12m": "12 mois", all: "Depuis le début" };

function parsePeriod(value: string | null): AnalyticsPeriod {
  return PERIODS.find((p) => p === value) ?? "30d";
}

/** Tableau équivalent du graphique, lisible uniquement par les lecteurs d'écran. */
function SrTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: string[][] }) {
  return (
    <Table className="sr-only">
      <TableCaption>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.join("|")}>
            {r.map((c, i) => (
              <TableCell key={i}>{c}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ChartCard({
  title,
  description,
  summary,
  height = "h-64",
  className,
  children,
  footer,
}: {
  title: string;
  description?: string;
  summary: string;
  height?: string;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className={`gap-3 py-5 ${className ?? ""}`}>
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <figure className="px-3 sm:px-5" aria-label={title}>
        <div className={`${height} w-full`} role="img" aria-label={summary}>
          {children}
        </div>
        {footer}
      </figure>
    </Card>
  );
}

export function AnalyticsView() {
  const { searchParams, setParams } = useUrlParams();
  const period = parsePeriod(searchParams.get("period"));
  const [now] = useState(() => new Date());

  const report = useAnalyticsReport(period);
  const orders = useOrders();
  const topProducts = useMemo(() => buildDeliveredTopProducts(orders.data ?? [], period, 6, now), [orders.data, period, now]);
  const margins = useMemo(() => buildProductMargins(orders.data ?? [], period, now), [orders.data, period, now]);

  const data = report.data;
  const hasSales = !!data && data.ordersCount > 0;
  const categoryTotal = data?.byCategory.reduce((s, c) => s + c.revenue, 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tabs value={period} onValueChange={(v) => setParams({ period: v })}>
          <TabsList aria-label="Période d'analyse" className="w-max">
            {PERIODS.map((p) => (
              <TabsTrigger key={p} value={p} className="min-h-8 px-3" title={PERIOD_LABELS[p]}>
                {PERIOD_SHORT[p]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {report.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Chargement des statistiques">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[102px]" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : report.isError || !data ? (
        <EmptyState
          icon={BarChart3}
          title="Impossible de calculer les statistiques"
          description={getErrorMessage(report.error)}
          action={
            <Button variant="outline" onClick={() => void report.refetch()}>
              Réessayer
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label={`Indicateurs — ${PERIOD_LABELS[period]}`} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Chiffre d'affaires" value={formatDZD(data.revenue)} hint="Commandes livrées, hors livraison" icon={Banknote} tone="success" className="col-span-2 lg:col-span-1" />
            <StatCard
              label="Bénéfice brut estimé"
              value={formatDZD(data.grossProfit)}
              hint={`Marge brute ${formatPercent(data.grossMarginRate)} · avant charges`}
              icon={TrendingUp}
            />
            <StatCard label="Commandes" value={String(data.ordersCount)} hint={`${data.deliveredCount} livrée(s)`} icon={ShoppingBag} />
            <StatCard label="Valeur moyenne" value={formatDZD(data.averageOrderValue)} hint="Par commande livrée" icon={Wallet} />
            <StatCard
              label="Taux d'annulation"
              value={formatPercent(data.cancellationRate)}
              hint="Annulées, refusées, échecs, retours"
              icon={XCircle}
              tone={data.cancellationRate >= 0.25 ? "danger" : data.cancellationRate > 0 ? "warning" : "default"}
            />
          </section>

          <Definitions />

          {!hasSales ? (
            <EmptyState icon={BarChart3} title="Aucune commande sur cette période" description="Choisissez une période plus large pour afficher les ventes." />
          ) : (
            <>
              <ChartCard
                title="Ventes par période"
                description="Chiffre d'affaires livré (barres, DA) et nombre de commandes passées (courbe)."
                summary={`Ventes ${PERIOD_LABELS[period].toLowerCase()} : chiffre d'affaires ${formatDZD(data.revenue)} pour ${data.ordersCount} commande(s). Détail dans le tableau ci-dessous.`}
                height="h-72"
                footer={
                  <SrTable
                    caption={`Ventes par période — ${PERIOD_LABELS[period]}`}
                    headers={["Période", "Chiffre d'affaires", "Commandes"]}
                    rows={data.series.map((s) => [s.label, formatDZD(s.revenue), String(s.orders)])}
                  />
                }
              >
                <SalesChart data={data.series} />
              </ChartCard>

              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                  title="Chiffre d'affaires par catégorie"
                  description="Catégories principales, commandes livrées."
                  summary={`Répartition du chiffre d'affaires par catégorie : ${data.byCategory.map((c) => `${c.name} ${formatDZD(c.revenue)}`).join(", ") || "aucune vente livrée"}.`}
                  height="h-56"
                  footer={
                    <>
                      <ul className="mt-3 space-y-1.5 text-sm" aria-label="Légende des catégories">
                        {data.byCategory.map((c, i) => (
                          <li key={c.categoryId} className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColor(i) }} aria-hidden />
                            <span className="flex-1 truncate">{c.name}</span>
                            <span className="text-muted-foreground tabular-nums">{categoryTotal > 0 ? formatPercent(c.revenue / categoryTotal, 0) : "—"}</span>
                            <span className="w-24 text-right font-medium tabular-nums">{formatDZD(c.revenue)}</span>
                          </li>
                        ))}
                      </ul>
                      <SrTable
                        caption="Chiffre d'affaires par catégorie"
                        headers={["Catégorie", "Chiffre d'affaires", "Unités"]}
                        rows={data.byCategory.map((c) => [c.name, formatDZD(c.revenue), String(c.unitsSold)])}
                      />
                    </>
                  }
                >
                  {data.byCategory.length > 0 ? (
                    <CategoryChart data={data.byCategory} />
                  ) : (
                    <p className="text-muted-foreground flex h-full items-center justify-center text-sm">Aucune vente livrée sur la période.</p>
                  )}
                </ChartCard>

                <ChartCard
                  title="Produits les plus vendus"
                  description="Unités vendues, commandes livrées (infobulle : chiffre d'affaires)."
                  summary={`Produits les plus vendus : ${topProducts.map((p) => `${p.name} ${p.unitsSold} unités, ${formatDZD(p.revenue)}`).join(" ; ") || "aucune vente livrée"}.`}
                  height="h-64"
                  footer={
                    <SrTable
                      caption="Produits les plus vendus"
                      headers={["Produit", "Unités", "Chiffre d'affaires"]}
                      rows={topProducts.map((p) => [p.name, String(p.unitsSold), formatDZD(p.revenue)])}
                    />
                  }
                >
                  {topProducts.length > 0 ? (
                    <TopProductsChart data={topProducts} />
                  ) : (
                    <p className="text-muted-foreground flex h-full items-center justify-center text-sm">Aucune vente livrée sur la période.</p>
                  )}
                </ChartCard>
              </div>

              <ChartCard
                title="Répartition des commandes par statut"
                description="Toutes les commandes passées sur la période."
                summary={`Commandes par statut : ${data.byStatus.map((s) => `${s.label} ${s.count}`).join(", ")}.`}
                height="h-72"
                footer={
                  <SrTable caption="Commandes par statut" headers={["Statut", "Commandes"]} rows={data.byStatus.map((s) => [s.label, String(s.count)])} />
                }
              >
                <StatusChart data={data.byStatus} />
              </ChartCard>

              {margins.length > 0 && <MarginTable margins={margins} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
