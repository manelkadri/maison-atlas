"use client";

import { formatDZD } from "@fashion/shared";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColor } from "./chart-palette";
import type { DeliveredTopProduct } from "@/features/analytics/breakdowns";
import type { CategoryBreakdownItem, StatusBreakdownItem, TimeSeriesPoint } from "@/types/analytics.types";

/**
 * Graphiques Recharts (chargés côté client uniquement via next/dynamic).
 * Couleurs : variables du thème (--chart-n). Chaque graphique est accompagné d'un tableau `sr-only`
 * fourni par le parent pour les lecteurs d'écran.
 */

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--chart-3)",
  confirmed: "var(--chart-4)",
  processing: "var(--chart-4)",
  shipped: "var(--chart-1)",
  delivered: "var(--chart-2)",
  cancelled: "var(--chart-5)",
  rejected: "var(--chart-5)",
  delivery_failed: "var(--chart-5)",
  returned: "var(--chart-5)",
};

const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(".", ",")} M` : v >= 1000 ? `${Math.round(v / 1000)} k` : String(v));

type TipRow = { name?: unknown; value?: unknown; color?: string; payload?: unknown };
type TipProps = { active?: boolean; payload?: ReadonlyArray<TipRow>; label?: unknown };

function TooltipBox({ title, rows }: { title?: string; rows: Array<{ label: string; value: string; color?: string }> }) {
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      {title && <p className="mb-1 font-medium">{title}</p>}
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            {r.color && <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />}
            <span className="text-muted-foreground">{r.label}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ Ventes par période */

export function SalesChart({ data }: { data: TimeSeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} tickMargin={6} />
        <YAxis yAxisId="rev" tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={compact} />
        <YAxis yAxisId="ord" orientation="right" tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={(p: TipProps) =>
            p.active && p.payload?.length ? (
              <TooltipBox
                title={String(p.label ?? "")}
                rows={p.payload.map((r) => ({
                  label: r.name === "revenue" ? "Chiffre d'affaires" : "Commandes",
                  value: r.name === "revenue" ? formatDZD(Number(r.value)) : String(r.value),
                  color: r.color,
                }))}
              />
            ) : null
          }
        />
        <Legend formatter={(v: string) => (v === "revenue" ? "Chiffre d'affaires (livré)" : "Commandes passées")} wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="rev" dataKey="revenue" name="revenue" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Line yAxisId="ord" dataKey="orders" name="orders" type="monotone" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ Répartition par catégorie */

export function CategoryChart({ data }: { data: CategoryBreakdownItem[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="revenue" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="var(--card)">
          {data.map((d, i) => (
            <Cell key={d.categoryId} fill={chartColor(i)} />
          ))}
        </Pie>
        <Tooltip
          content={(p: TipProps) => {
            const row = p.payload?.[0];
            const item = row?.payload as CategoryBreakdownItem | undefined;
            return p.active && item ? (
              <TooltipBox
                title={item.name}
                rows={[
                  { label: "Chiffre d'affaires", value: formatDZD(item.revenue) },
                  { label: "Unités vendues", value: String(item.unitsSold) },
                ]}
              />
            ) : null;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ Produits les plus vendus */

export function TopProductsChart({ data }: { data: DeliveredTopProduct[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={118}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={(p: TipProps) => {
            const item = p.payload?.[0]?.payload as DeliveredTopProduct | undefined;
            return p.active && item ? (
              <TooltipBox
                title={item.name}
                rows={[
                  { label: "Unités vendues", value: String(item.unitsSold) },
                  { label: "Chiffre d'affaires", value: formatDZD(item.revenue) },
                ]}
              />
            ) : null;
          }}
        />
        <Bar dataKey="unitsSold" fill="var(--chart-2)" radius={[0, 3, 3, 0]} maxBarSize={22}>
          <LabelList dataKey="unitsSold" position="right" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ Répartition par statut */

export function StatusChart({ data }: { data: StatusBreakdownItem[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={112} tickLine={false} axisLine={false} fontSize={11} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={(p: TipProps) => {
            const item = p.payload?.[0]?.payload as StatusBreakdownItem | undefined;
            return p.active && item ? <TooltipBox title={item.label} rows={[{ label: "Commandes", value: String(item.count) }]} /> : null;
          }}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={20}>
          {data.map((d) => (
            <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "var(--chart-1)"} />
          ))}
          <LabelList dataKey="count" position="right" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
