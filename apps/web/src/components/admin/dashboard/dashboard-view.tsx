"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { formatDZD } from "@fashion/shared";
import { Banknote, CheckCircle2, Clock, Info, PackageX, Plus, RefreshCw, Shirt, ShoppingBag, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { useDashboard } from "@/features/analytics/hooks";
import { isApiMode } from "@/lib/api-config";
import { getErrorMessage } from "@/services";
import { ChartsSkeleton, DashboardSkeleton } from "./dashboard-skeleton";
import { RecentOrders } from "./recent-orders";
import { ActivityFeed, OutOfStockList } from "./stock-and-activity";

// Recharts est chargé à la demande (côté client uniquement) pour alléger le bundle initial.
const DashboardCharts = dynamic(() => import("./dashboard-charts"), { ssr: false, loading: () => <ChartsSkeleton /> });

export function DashboardView() {
  const { data, isPending, isError, error, refetch, isFetching } = useDashboard();

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de l'activité de la boutique."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`${ADMIN_ROOT}/orders`}>
                <ShoppingBag aria-hidden /> Commandes
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`${ADMIN_ROOT}/products/new`}>
                <Plus aria-hidden /> Ajouter un produit
              </Link>
            </Button>
          </>
        }
      />

      {!isApiMode() && (
        <p className="text-muted-foreground bg-secondary mb-6 flex items-start gap-2 rounded-md px-3 py-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="text-foreground font-medium">Données de démonstration</strong> : les chiffres sont calculés à partir de commandes fictives enregistrées dans votre
            navigateur.
          </span>
        </p>
      )}

      {isPending && <DashboardSkeleton />}

      {isError && (
        <div role="alert" className="border-destructive/30 bg-destructive-soft flex flex-col items-start gap-3 rounded-lg border p-5 sm:flex-row sm:items-center">
          <TriangleAlert className="text-destructive size-5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-medium">Impossible de charger le tableau de bord.</p>
            <p className="text-muted-foreground text-sm">{getErrorMessage(error)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden /> Réessayer
          </Button>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <section aria-label="Indicateurs clés" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard
              label="Chiffre d'affaires"
              value={formatDZD(data.kpis.revenue)}
              hint="Commandes livrées, remises déduites, hors frais de livraison"
              icon={Banknote}
              tone="success"
            />
            <StatCard label="Commandes" value={String(data.kpis.ordersCount)} hint="Toutes commandes confondues" icon={ShoppingBag} />
            <StatCard
              label="En attente"
              value={String(data.kpis.pendingOrders)}
              hint="À confirmer"
              icon={Clock}
              tone={data.kpis.pendingOrders > 0 ? "warning" : "default"}
            />
            <StatCard label="Livrées" value={String(data.kpis.deliveredOrders)} hint="Encaissées à la livraison" icon={CheckCircle2} tone="success" />
            <StatCard label="Produits actifs" value={String(data.kpis.productsCount)} hint="Non archivés (publiés ou brouillons)" icon={Shirt} />
            <StatCard
              label="Variantes en rupture"
              value={String(data.kpis.outOfStockVariants)}
              hint="Combinaisons couleur/taille à 0"
              icon={PackageX}
              tone={data.kpis.outOfStockVariants > 0 ? "danger" : "default"}
            />
          </section>

          <DashboardCharts revenueSeries={data.revenueSeries} statusBreakdown={data.statusBreakdown} topProducts={data.topProducts} />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RecentOrders orders={data.recentOrders} />
            </div>
            <OutOfStockList items={data.outOfStock} total={data.kpis.outOfStockVariants} />
          </div>

          <ActivityFeed events={data.activity} />
        </div>
      )}
    </>
  );
}
