"use client";

import { useId, type ReactNode } from "react";
import { formatDZD } from "@fashion/shared";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import type { StatusBreakdownItem, TimeSeriesPoint, TopProduct } from "@/types/analytics.types";

/* Les couleurs viennent des variables CSS du thème (jamais codées en dur). */
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 } as const;
const GRID_STROKE = "var(--border)";
const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

const STATUS_COLORS: Record<string, { fill: string; opacity: number }> = {
  pending: { fill: "var(--warning)", opacity: 1 },
  confirmed: { fill: "var(--info)", opacity: 1 },
  processing: { fill: "var(--info)", opacity: 0.55 },
  shipped: { fill: "var(--brand)", opacity: 1 },
  delivered: { fill: "var(--success)", opacity: 1 },
  cancelled: { fill: "var(--muted-foreground)", opacity: 0.6 },
  rejected: { fill: "var(--destructive)", opacity: 1 },
  delivery_failed: { fill: "var(--destructive)", opacity: 0.55 },
  returned: { fill: "var(--brand)", opacity: 0.5 },
};

/** Valeur d'axe compacte : 12 500 → « 13 k ». */
export function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${Math.round((value / 1_000_000) * 10) / 10} M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k`;
  return String(value);
}

function ChartCard({ title, description, summary, children, footer }: { title: string; description: string; summary: string; children: ReactNode; footer?: ReactNode }) {
  const id = useId();
  return (
    <Card className="gap-3 px-4 py-4 sm:px-5">
      <div>
        <h2 id={`${id}-title`} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} className="h-60 w-full">
        {children}
      </div>
      <p id={`${id}-desc`} className="sr-only">
        {summary}
      </p>
      {footer}
    </Card>
  );
}

function RevenueChart({ data }: { data: TimeSeriesPoint[] }) {
  const total = data.reduce((s, p) => s + p.revenue, 0);
  const best = data.reduce<TimeSeriesPoint | null>((b, p) => (!b || p.revenue > b.revenue ? p : b), null);
  const summary = `Chiffre d'affaires des 30 derniers jours : ${formatDZD(total)}.${best && best.revenue > 0 ? ` Meilleur jour : ${best.label} avec ${formatDZD(best.revenue)}.` : ""}`;
  return (
    <ChartCard title="Chiffre d'affaires" description="30 derniers jours · commandes livrées, hors livraison" summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval="preserveStartEnd" minTickGap={28} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => compactNumber(v)} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatDZD(Number(value)), "Chiffre d'affaires"]} />
          <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#revenue-fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function OrdersChart({ data }: { data: TimeSeriesPoint[] }) {
  const total = data.reduce((s, p) => s + p.orders, 0);
  const peak = data.reduce<TimeSeriesPoint | null>((b, p) => (!b || p.orders > b.orders ? p : b), null);
  const summary = `${total} commande${total > 1 ? "s" : ""} sur les 30 derniers jours.${peak && peak.orders > 0 ? ` Pic : ${peak.orders} le ${peak.label}.` : ""}`;
  return (
    <ChartCard title="Commandes" description="30 derniers jours · toutes commandes confondues" summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval="preserveStartEnd" minTickGap={28} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} formatter={(value) => [String(value), "Commandes"]} />
          <Bar dataKey="orders" fill="var(--chart-4)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function StatusDonut({ data }: { data: StatusBreakdownItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({ ...d, fill: STATUS_COLORS[d.status]?.fill ?? "var(--chart-1)", fillOpacity: STATUS_COLORS[d.status]?.opacity ?? 1 }));
  const summary = `Répartition de ${total} commande${total > 1 ? "s" : ""} par statut : ${data.map((d) => `${d.label} ${d.count}`).join(", ")}.`;
  return (
    <ChartCard
      title="Répartition par statut"
      description="Toutes les commandes"
      summary={summary}
      footer={
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {chartData.map((d) => (
            <li key={d.status} className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.fill, opacity: d.fillOpacity }} />
              <span className="truncate">{d.label}</span>
              <span className="text-muted-foreground ml-auto tabular-nums">
                {d.count}
                {total > 0 && ` (${Math.round((d.count / total) * 100)} %)`}
              </span>
            </li>
          ))}
        </ul>
      }
    >
      {total === 0 ? (
        <p className="text-muted-foreground flex h-full items-center justify-center text-sm">Aucune commande pour le moment.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="count" nameKey="label" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="var(--card)" strokeWidth={2} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [String(value), String(name)]} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function TopProductsChart({ data }: { data: TopProduct[] }) {
  const rows = data.map((p) => ({ ...p, short: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name }));
  const summary = rows.length
    ? `Produits les plus vendus : ${data.map((p) => `${p.name}, ${p.unitsSold} unité${p.unitsSold > 1 ? "s" : ""}`).join(" ; ")}.`
    : "Aucune vente enregistrée.";
  return (
    <ChartCard title="Produits les plus vendus" description="En unités, commandes non échouées" summary={summary}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground flex h-full items-center justify-center text-sm">Aucune vente pour le moment.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} allowDecimals={false} />
            <YAxis type="category" dataKey="short" tick={AXIS_TICK} tickLine={false} axisLine={false} width={118} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: "var(--muted)" }}
              formatter={(value, _name, item) => [`${value} unité${Number(value) > 1 ? "s" : ""} · ${formatDZD((item?.payload as TopProduct | undefined)?.revenue ?? 0)}`, "Ventes"]}
              labelFormatter={(_label, payload) => (payload?.[0]?.payload as TopProduct | undefined)?.name ?? ""}
            />
            <Bar dataKey="unitsSold" fill="var(--chart-2)" radius={[0, 3, 3, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export default function DashboardCharts({ revenueSeries, statusBreakdown, topProducts }: { revenueSeries: TimeSeriesPoint[]; statusBreakdown: StatusBreakdownItem[]; topProducts: TopProduct[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RevenueChart data={revenueSeries} />
      <OrdersChart data={revenueSeries} />
      <StatusDonut data={statusBreakdown} />
      <TopProductsChart data={topProducts} />
    </div>
  );
}
